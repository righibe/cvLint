import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, negotiateLocale } from "./i18n/config";
import { buildCsp, createNonce } from "./lib/security/csp";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Malformed percent-encoding ("/en/%") would otherwise surface as a 500.
  try {
    decodeURIComponent(pathname);
  } catch {
    return new NextResponse("Bad Request", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const first = pathname.split("/")[1] ?? "";

  if (!isLocale(first)) {
    const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(cookie) ? cookie : negotiateLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    const redirect = NextResponse.redirect(url, 307);
    // The target depends on the cookie and Accept-Language: never let a shared cache reuse it.
    redirect.headers.set("Cache-Control", "private, no-store");
    redirect.headers.set("Vary", "Cookie, Accept-Language");
    return redirect;
  }

  const nonce = createNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  // Per-request nonces make HTML uncacheable by design.
  response.headers.set("Cache-Control", "private, no-store");

  if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
    response.cookies.set(LOCALE_COOKIE, first, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });
  }
  return response;
}

export const config = {
  // Everything except exact static assets goes through the proxy, so every HTML
  // response (including 404s) carries the nonce CSP. Exclusions are anchored: a
  // prefix such as "/robots.txtX" must not skip the proxy. No header-based
  // exclusions either: request headers are attacker-controlled.
  matcher: [
    "/((?!_next/static/|_next/image$|pdfjs/pdf\\.worker\\.[0-9.]+\\.min\\.mjs$|icon\\.svg$|robots\\.txt$|sitemap\\.xml$).*)",
  ],
};
