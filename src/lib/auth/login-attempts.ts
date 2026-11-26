// GCC - failed sign-in tracking that decides when a Turnstile challenge is
// required. The counter is keyed by IP plus a hash of the email so the readable
// address is never stored. Firebase Auth still owns the actual sign-in; this is
// a server-side gate the client asks about before and after an attempt.
import "server-only";

import { createHash } from "node:crypto";

import { checkRateLimit, clearRateLimit, rateLimitPolicy, readRateLimit } from "@/lib/rate-limit";

export const LOGIN_FAILURE_LIMIT = 3;
export const LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60;

export function loginFailurePolicy(ip: string, email: string) {
  const emailHash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return rateLimitPolicy(
    "auth:login-fail",
    `${ip}:${emailHash}`,
    LOGIN_FAILURE_LIMIT,
    LOGIN_FAILURE_WINDOW_SECONDS,
  );
}

/** Number of failures in the current window (does not consume a unit). */
export async function loginFailureCount(ip: string, email: string): Promise<number> {
  return readRateLimit(loginFailurePolicy(ip, email));
}

/** Records one failure and reports whether a challenge is now required. */
export async function recordLoginFailure(
  ip: string,
  email: string,
): Promise<{ challengeRequired: boolean }> {
  const policy = loginFailurePolicy(ip, email);
  const result = await checkRateLimit(policy);

  if (!result.allowed) {
    return { challengeRequired: true };
  }

  return { challengeRequired: result.remaining === 0 };
}

/** Clears the counter after a successful sign-in. */
export async function clearLoginFailures(ip: string, email: string): Promise<void> {
  await clearRateLimit(loginFailurePolicy(ip, email));
}
