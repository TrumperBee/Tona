// GCC — Firebase session-cookie helpers.
//
// The browser never receives an Admin credential. It exchanges a Firebase ID
// token for an http-only session cookie at /api/auth/session. Guards verify the
// cookie with revocation checks on every request.
import "server-only";

import type { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/config/env.server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import {
  SESSION_COOKIE_MAX_DAYS,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_PATH,
} from "@/lib/auth/constants";
import type { UserRole } from "@/types/domain";

export interface SessionUser {
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
  readonly isSuperAdmin: boolean;
}

/** Clamps a configured lifetime to Firebase's 14-day session-cookie ceiling. */
export function clampSessionMaxAgeSeconds(days: number): number {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(days, SESSION_COOKIE_MAX_DAYS)) : 5;
  return Math.floor(safeDays) * 24 * 60 * 60;
}

export function getSessionMaxAgeSeconds(): number {
  return clampSessionMaxAgeSeconds(getServerEnv().SESSION_COOKIE_MAX_AGE_DAYS);
}

export function getSessionCookieOptions(maxAgeSeconds: number) {
  const e2eLocalHttp =
    process.env.GCC_E2E === "1" &&
    (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("http://127.0.0.1");
  return {
    httpOnly: true,
    // Never send the cookie over plain HTTP in a deployed environment. The
    // explicit check also covers builds where NODE_ENV is set late.
    secure:
      !e2eLocalHttp &&
      (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production"),
    sameSite: "lax" as const,
    path: SESSION_COOKIE_PATH,
    maxAge: maxAgeSeconds,
    priority: "high" as const,
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
