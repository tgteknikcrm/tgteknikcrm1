/**
 * tgteknikcrm — R2 attachment delivery worker
 *
 * Routes:
 *   GET /<key...>             → JWT-verified read of an R2 object,
 *                                streamed straight to the client
 *                                with a 1-year immutable cache.
 *   GET /<key...>__600.webp   → handled by the same code path; the
 *                                "variant" naming convention is
 *                                produced at upload time by the
 *                                Vercel server action (sharp).
 *
 * Auth model:
 *   1. Browser sends `Authorization: Bearer <jwt>` OR a `tg_jwt`
 *      cookie. The browser already has a Supabase session from the
 *      Vercel app; we just forward it.
 *   2. Worker verifies the JWT signature against the Supabase JWT
 *      secret (HMAC SHA-256). On failure → 401.
 *   3. Worker calls Supabase REST to confirm the user can see the
 *      parent message_attachments row (RLS does the heavy lifting:
 *      the row is invisible if the user isn't a participant of the
 *      parent conversation).
 *   4. CF cache key includes the JWT user (sub) so different users
 *      get separate cache entries — but per-user cache hits are
 *      effectively free.
 *
 * Why a Worker (and not just public R2 with signed URLs)?
 *   - Token-less URLs survive page reloads → browser cache hits 100%.
 *   - JWT verify + RLS check happens on CF edge (~1ms) instead of in
 *     a Vercel function (~50-150ms cold).
 *   - R2 → Worker is on Cloudflare's private network (0ms transfer).
 *   - First-time miss in TR pulls from CF EU PoP (~30-50ms);
 *     subsequent hits from the IST PoP (~5-15ms).
 *
 * Deployed bindings (set via wrangler.toml + secrets):
 *   env.BUCKET                R2 bucket binding
 *   env.SUPABASE_JWT_SECRET   secret — Supabase project JWT secret
 *   env.SUPABASE_URL          var    — https://xxx.supabase.co
 *   env.SUPABASE_ANON_KEY     var    — anon key for REST calls
 */

export interface Env {
  BUCKET: R2Bucket;
  SUPABASE_JWT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  // Optional: a list of comma-separated origins allowed to embed images.
  ALLOWED_ORIGINS?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") return corsPreflight(request, env);
    if (method !== "GET" && method !== "HEAD") {
      return new Response("method not allowed", { status: 405 });
    }

    // The path after the leading slash is the R2 object key.
    let key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (!key) return new Response("missing key", { status: 400 });
    // Strip a leading "img/" if the worker is mounted under that path.
    if (key.startsWith("img/")) key = key.slice(4);

    // ── Auth ────────────────────────────────────────────────────
    const jwt = readJwtFromRequest(request);
    if (!jwt) return unauthorized();
    const claims = await verifyJwt(jwt, env.SUPABASE_JWT_SECRET);
    if (!claims) return unauthorized();
    const uid = String(claims.sub || "");
    if (!uid) return unauthorized();

    // ── RLS check ───────────────────────────────────────────────
    // Find a message_attachments row whose storage_path matches OR
    // whose storage_path is the prefix of a variant key like
    // `<base>__600.webp`. The user-scoped REST call enforces RLS
    // ("select attachments as participant").
    const baseKey = key.replace(/__\d+\.webp$/, "");
    const allowed = await canSeeAttachment(env, jwt, baseKey);
    if (!allowed) return forbidden();

    // ── R2 fetch ────────────────────────────────────────────────
    // Try cache first. CF caches per (user, url) tuple via cache key.
    const cache = caches.default;
    const cacheKey = new Request(
      `${url.origin}/${encodeURIComponent(uid)}/${encodeURIComponent(key)}`,
      { method: "GET" },
    );
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const obj = await env.BUCKET.get(key, {
      range: parseRange(request.headers.get("range")),
    });
    if (!obj) return new Response("not found", { status: 404 });

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("Cache-Control", "private, max-age=31536000, immutable");
    headers.set("Content-Disposition", `inline; filename="${baseKey.split("/").pop()}"`);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Accept-Ranges", "bytes");
    applyCors(headers, request, env);

    const status =
      request.headers.get("range") && obj.range ? 206 : 200;
    const response = new Response(obj.body, { status, headers });
    // Populate CF cache for future hits.
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};

/* ────────────────────────────────────────────────────────────── */

function readJwtFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7);
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)tg_jwt=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  // Browser may also pass it as a query parameter (last resort, used
  // only by `<img>` tags that can't add Authorization headers).
  const url = new URL(req.url);
  const tok = url.searchParams.get("token");
  if (tok) return tok;
  return null;
}

async function verifyJwt(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const data = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sig = base64UrlDecode(sigB64);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sig,
    new TextEncoder().encode(data),
  );
  if (!ok) return null;
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadB64)),
    );
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function canSeeAttachment(
  env: Env,
  jwt: string,
  baseKey: string,
): Promise<boolean> {
  // PostgREST: tek satır lookup. RLS attachments policy "select
  // attachments as participant" yetkilendirmeyi yapar — yetki yoksa
  // 0 row döner.
  const url = `${env.SUPABASE_URL}/rest/v1/message_attachments?select=id&storage_path=eq.${encodeURIComponent(baseKey)}&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${jwt}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return false;
  const rows = (await res.json()) as Array<{ id: string }>;
  return Array.isArray(rows) && rows.length > 0;
}

function parseRange(header: string | null): R2Range | undefined {
  if (!header) return undefined;
  const m = /^bytes=(\d+)-(\d*)$/.exec(header);
  if (!m) return undefined;
  const offset = Number(m[1]);
  const end = m[2] ? Number(m[2]) : undefined;
  return end !== undefined
    ? { offset, length: end - offset + 1 }
    : { offset };
}

function applyCors(headers: Headers, req: Request, env: Env) {
  const origin = req.headers.get("origin");
  const allowed = (env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.includes("*")) {
    headers.set("Access-Control-Allow-Origin", "*");
  } else if (origin && allowed.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Credentials", "true");
}

function corsPreflight(req: Request, env: Env): Response {
  const headers = new Headers();
  applyCors(headers, req, env);
  headers.set(
    "Access-Control-Allow-Methods",
    "GET, HEAD, OPTIONS",
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "authorization, range, content-type",
  );
  headers.set("Access-Control-Max-Age", "600");
  return new Response(null, { status: 204, headers });
}

function unauthorized(): Response {
  return new Response("unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": "Bearer" },
  });
}
function forbidden(): Response {
  return new Response("forbidden", { status: 403 });
}
