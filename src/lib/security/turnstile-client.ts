"use client";

// GCC - browser helper for Turnstile challenges that Firebase handles itself.
//
// Registration and organiser applications verify the token inside their own
// server routes. Password reset and the post-failure login challenge call this
// first because Firebase sends the email / accepts the password directly in
// the browser.
import type { TurnstileAction } from "@/lib/security/turnstile";

/** Generic client-side message; never includes Cloudflare error details. */
export const TURNSTILE_CLIENT_FAILURE_MESSAGE =
  "Complete the security check and try again. If it keeps failing, reload the page.";

/** True when a Turnstile token passed server-side verification. */
export async function verifyClientTurnstile(
  action: Extract<TurnstileAction, "forgot_password" | "login">,
  token: string | null,
): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/turnstile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token: token ?? undefined }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/** Reports sign-in challenge state to the server-side failure counter. */
export async function reportLoginAttempt(
  email: string,
  event: "check" | "failed" | "success",
): Promise<{ challengeRequired: boolean }> {
  try {
    const response = await fetch("/api/auth/login-attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, event }),
    });

    if (!response.ok) {
      return { challengeRequired: false };
    }

    const body = (await response.json()) as { challengeRequired?: unknown };

    return { challengeRequired: body.challengeRequired === true };
  } catch {
    // A failure counter outage must not lock out password sign-in. Firebase's
    // own throttling remains active.
    return { challengeRequired: false };
  }
}
