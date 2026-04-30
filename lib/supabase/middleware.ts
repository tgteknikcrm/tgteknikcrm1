import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/workbox-") ||
    pathname.startsWith("/icons");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  // ── Cookie bridge for Cloudflare R2 worker ──────────────────────
  // The R2 attachment worker (cdn.<your-domain>) verifies a Supabase
  // JWT to enforce RLS, but <img> tags can't add Authorization
  // headers. Mirror the access_token into a cross-subdomain cookie
  // (`tg_jwt`) so the worker can read it on every fetch.
  // Requires the app + worker to share a parent domain — when running
  // on `vercel.app` this cookie won't reach the worker, so set
  // `R2_COOKIE_DOMAIN` (e.g. `.tgteknik.com.tr`) once a custom domain
  // is in place.
  if (user) {
    const cookieDomain = process.env.R2_COOKIE_DOMAIN; // e.g. ".tgteknik.com.tr"
    if (cookieDomain) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      const expiresAt = session?.expires_at
        ? new Date(session.expires_at * 1000)
        : undefined;
      if (accessToken) {
        response.cookies.set("tg_jwt", accessToken, {
          domain: cookieDomain,
          path: "/",
          httpOnly: false, // worker reads via Cookie header; this is fine
          secure: true,
          sameSite: "lax",
          ...(expiresAt && { expires: expiresAt }),
        });
      }
    }
  }

  return response;
}
