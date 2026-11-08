// GCC — Next.js 16 Proxy (formerly middleware).
//
// This is a lightweight navigation guard only: it checks whether a session
// cookie exists and redirects unauthenticated visitors to /login. It is NOT
// authorisation. Real role and ownership checks run in server guards against
// Firebase Auth in Phase 2, and Firestore Security Rules deny client writes.
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { safeRedirectPath } from "@/lib/security/redirect";

const PROTECTED_PREFIXES = ["/dashboard", "/organiser", "/super-admin"] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const safeNext = safeRedirectPath(pathname);

  if (safeNext) {
    loginUrl.searchParams.set("next", safeNext);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
