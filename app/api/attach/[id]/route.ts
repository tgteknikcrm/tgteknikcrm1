import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Authenticated, token-less attachment proxy.
 *
 * Why: Supabase signed URLs embed a JWT that changes on every sign,
 * so the URL string differs each page load → the browser's HTTP cache
 * keys it as a brand-new resource and re-downloads. A stable
 * application URL (`/api/attach/<uuid>?w=600`) lets the browser cache
 * the asset for a year, so opening a chat or refreshing the page
 * pulls images straight from disk.
 *
 * Pipeline:
 *  1. Verify the caller via the SSR Supabase client (cookies-based).
 *  2. RLS check — `.select()` on `message_attachments` joins messages,
 *     and the existing policy ("select attachments as participant")
 *     decides if this user is allowed to see this attachment.
 *  3. Fetch from storage with the admin client (bypasses RLS for
 *     speed) and stream upstream → client.
 *  4. Long, immutable Cache-Control. Attachments are content-hash-
 *     immutable in practice (the storage_path is unique per upload),
 *     so caching for a year is safe.
 *
 * Optional `?w=` and `?q=` query parameters re-use Supabase's image
 * transform endpoint (resize + re-encode webp).
 */

const ALLOWED_WIDTHS = new Set([200, 400, 600, 900, 1200]);

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("bad request", { status: 400 });
  }

  // 1) Auth — must have a session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  // 2) RLS check via the user-scoped client. If the user can't see this
  //    attachment, the policy returns no row, and we 404 (don't leak
  //    existence).
  type AttachRow = {
    storage_path: string;
    file_name: string;
    mime_type: string;
  };
  const { data: row, error } = await supabase
    .from("message_attachments")
    .select("storage_path, file_name, mime_type")
    .eq("id", id)
    .single<AttachRow>();
  if (error || !row) return new Response("not found", { status: 404 });

  const url = new URL(req.url);
  const wRaw = Number(url.searchParams.get("w") ?? 0);
  const qRaw = Number(url.searchParams.get("q") ?? 80);
  const wantTransform =
    row.mime_type.startsWith("image/") &&
    Number.isFinite(wRaw) &&
    ALLOWED_WIDTHS.has(wRaw);
  const quality =
    Number.isFinite(qRaw) && qRaw >= 30 && qRaw <= 100 ? qRaw : 80;

  // 3) Fetch from storage. Use the admin client to skip an extra RLS
  //    pass and to access the transform/render endpoints.
  const admin = createAdminClient();

  let upstreamBlob: Blob | null = null;
  let upstreamMime = row.mime_type;

  if (wantTransform) {
    // Use signed URL with transform options, then fetch upstream.
    const { data: signed, error: sErr } = await admin.storage
      .from("message-attachments")
      .createSignedUrl(row.storage_path, 60, {
        transform: { width: wRaw, quality },
      });
    if (sErr || !signed?.signedUrl) {
      return new Response("transform error", { status: 500 });
    }
    const upstream = await fetch(signed.signedUrl);
    if (!upstream.ok || !upstream.body) {
      return new Response("upstream error", { status: 502 });
    }
    upstreamMime = upstream.headers.get("content-type") || row.mime_type;
    return new Response(upstream.body, {
      headers: buildHeaders(upstreamMime, row.file_name),
    });
  }

  const { data: blob, error: dlErr } = await admin.storage
    .from("message-attachments")
    .download(row.storage_path);
  if (dlErr || !blob) {
    return new Response("storage error", { status: 500 });
  }
  upstreamBlob = blob;

  // Blob → ReadableStream (Vercel forwards it without buffering)
  return new Response(upstreamBlob.stream(), {
    headers: buildHeaders(upstreamMime, row.file_name),
  });
}

function buildHeaders(mime: string, filename: string): HeadersInit {
  return {
    "Content-Type": mime || "application/octet-stream",
    // Long, immutable cache. The (id, w, q) tuple is a stable key, so
    // we never need to revalidate; the file body never changes.
    "Cache-Control": "private, max-age=31536000, immutable",
    "Content-Disposition": `inline; filename="${encodeURIComponent(
      filename || "file",
    )}"`,
    "X-Content-Type-Options": "nosniff",
  };
}
