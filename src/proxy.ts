// GCC — Next.js 16 Proxy (formerly middleware).
//
// Two responsibilities:
// 1. Lightweight navigation guard: a missing session cookie redirects protected
//    areas to /login. This is NOT authorisation. Real role and ownership checks
//    run in server guards against Firebase Auth, and Firestore Security Rules
//    deny client writes.
// 2. Per-request Content-Security-Policy nonce. Next reads the CSP request
//    header and stamps the nonce onto its own scripts. The response always
//    carries the policy, including on redirects and API responses.
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { buildContentSecurityPolicy, cspHeaderName, resolveCspMode } from "@/lib/security/csp";
import { safeRedirectPath } from "@/lib/security/redirect";

const PROTECTED_PREFIXES = ["/dashboard", "/organiser", "/super-admin"] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function createNonce(): string {
  // 128 bits of randomness, base64-safe. crypto.randomUUID is available in the
  // Proxy runtime and avoids Buffer (which is not guaranteed on every target).
  return crypto.randomUUID().replace(/-/g, "");
}

function applySecurityHeaders(
  response: NextResponse,
  csp: string,
  mode: "report-only" | "enforce",
): void {
  response.headers.set(cspHeaderName(mode), csp);
  // The nonce value is also readable by the app if a component ever needs it.
  response.headers.set("X-CSP-Mode", mode);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === "production";
  const mode = resolveCspMode(process.env.CSP_MODE, isProduction);
  const nonce = createNonce();
  const csp = buildContentSecurityPolicy({ nonce, mode, isProduction });

  // Next.js reads the Content-Security-Policy request header (regardless of the
  // response mode) to stamp the nonce on its own scripts and next/script tags.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  if (!isProtectedPath(pathname)) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    applySecurityHeaders(response, csp, mode);
    return response;
  }

  if (request.cookies.has(SESSION_COOKIE_NAME)) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    applySecurityHeaders(response, csp, mode);
    return response;
  }

  const loginUrl = new URL("/login", request.url);
  const safeNext = safeRedirectPath(pathname);

  if (safeNext) {
    loginUrl.searchParams.set("next", safeNext);
  }

  const response = NextResponse.redirect(loginUrl);
  applySecurityHeaders(response, csp, mode);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
