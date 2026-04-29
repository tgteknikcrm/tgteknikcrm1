import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Authenticated, token-less attachment proxy.
 *
 * Architecture:
 *  1. SSR Supabase client → auth check via cookies (cheap; same call
 *     middleware just made, but the RLS step still needs the row).
 *  2. `.select()` on `message_attachments` runs RLS — if the user
 *     can't see this attachment we 404.
 *  3. Manual upstream `fetch()` to Supabase storage with the service-
 *     role key, then we stream `upstream.body` straight back to the
 *     client. **Critical**: we do NOT use `admin.storage.download()`
 *     because that returns a Blob, which forces Vercel to buffer the
 *     whole file in memory before responding (slow + RAM hungry).
 *     Streaming cuts time-to-first-byte from ~1s to ~150ms for big
 *     files.
 *  4. `?dl=1` returns a 302 to a freshly-signed Supabase URL so the
 *     browser fetches the file *directly* from Supabase — even
 *     faster, since our function is no longer in the bandwidth path.
 *
 * Cache: stable URL + `Cache-Control: max-age=31536000, immutable`
 * means re-opens, refreshes, and tab restores all hit disk.
 */

const ALLOWED_WIDTHS = new Set([200, 400, 600, 900, 1200]);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("bad request", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

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

  // ── Mode 1: ?dl=1 → redirect to a short-lived signed URL.
  // The browser then pulls the file from Supabase directly, so this
  // function isn't in the bandwidth path. Best for big originals.
  if (url.searchParams.get("dl") === "1") {
    const admin = createAdminClient();
    const { data: signed, error: sErr } = await admin.storage
      .from("message-attachments")
      .createSignedUrl(row.storage_path, 600); // 10 min — plenty
    if (sErr || !signed?.signedUrl) {
      return new Response("sign error", { status: 500 });
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: signed.signedUrl,
        // The redirect target itself is short-lived, but the redirect
        // response can be cached briefly so re-clicks don't re-roundtrip.
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  // ── Mode 2: stream-proxy upstream → client.
  // We hand-roll the upstream fetch instead of `admin.storage.download()`
  // so that `upstream.body` (a ReadableStream) flows straight through
  // without buffering. Auth uses the service-role key in a header.
  const upstreamPath = wantTransform
    ? `${SUPABASE_URL}/storage/v1/render/image/authenticated/message-attachments/${encodeURI(row.storage_path)}?width=${wRaw}&quality=${quality}&resize=contain`
    : `${SUPABASE_URL}/storage/v1/object/authenticated/message-attachments/${encodeURI(row.storage_path)}`;

  const upstream = await fetch(upstreamPath, {
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    // Pass through Range requests so videos / big files can seek.
    ...(req.headers.get("range") && {
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        Range: req.headers.get("range")!,
      },
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(`upstream ${upstream.status}`, {
      status: upstream.status >= 500 ? 502 : upstream.status,
    });
  }

  const upstreamMime = upstream.headers.get("content-type") || row.mime_type;
  const upstreamLength = upstream.headers.get("content-length");
  const upstreamRange = upstream.headers.get("content-range");

  const headers: Record<string, string> = {
    "Content-Type": upstreamMime || "application/octet-stream",
    "Cache-Control": "private, max-age=31536000, immutable",
    "Content-Disposition": `inline; filename="${encodeURIComponent(
      row.file_name || "file",
    )}"`,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };
  if (upstreamLength) headers["Content-Length"] = upstreamLength;
  if (upstreamRange) headers["Content-Range"] = upstreamRange;

  // Stream straight through — no buffering, no Blob materialization.
  return new Response(upstream.body, {
    status: upstream.status, // preserves 206 Partial Content for ranges
    headers,
  });
}
