// GCC — Firebase session-cookie helpers.
//
// The browser never receives an Admin credential. It exchanges a Firebase ID
// token for an http-only session cookie at /api/auth/session. Guards verify the
// cookie with revocation checks on every request.
import "server-only";

import type { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/config/env.server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_PATH } from "@/lib/auth/constants";
import type { UserRole } from "@/types/domain";

export interface SessionUser {
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
  readonly isSuperAdmin: boolean;
}

export function getSessionMaxAgeSeconds(): number {
  return getServerEnv().SESSION_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
}

export function getSessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: SESSION_COOKIE_PATH,
    maxAge: maxAgeSeconds,
  };
}

/** Creates a Firebase session cookie from a freshly verified ID token. */
export async function createSessionCookie(idToken: string): Promise<string> {
  const maxAgeSeconds = getSessionMaxAgeSeconds();

  return getFirebaseAdminAuth().createSessionCookie(idToken, {
    expiresIn: maxAgeSeconds * 1000,
  });
}

/** Sets the session cookie on a route-handler response. */
export function setSessionCookie(response: NextResponse, sessionCookie: string): void {
  response.cookies.set(
    SESSION_COOKIE_NAME,
    sessionCookie,
    getSessionCookieOptions(getSessionMaxAgeSeconds()),
  );
}

/** Clears the session cookie on a route-handler response. */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(0),
    expires: new Date(0),
  });
}
