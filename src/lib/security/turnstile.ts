// GCC - Cloudflare Turnstile server-side verification.
//
// The browser widget proves a human interaction, but only the server check is
// trusted. Verification uses fetch (no SDK), sends the visitor IP, checks the
// action and fails closed in production when TURNSTILE_SECRET_KEY is missing.
import "server-only";

import { getServerEnv } from "@/lib/config/env.server";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;

export type TurnstileAction =
  "register" | "forgot_password" | "login" | "application" | "unsubscribe";

export interface TurnstileResult {
  readonly ok: boolean;
  /** Short, non-sensitive reason for logs and a generic user message. */
  readonly reason?:
    | "missing-token"
    | "missing-secret"
    | "verification-failed"
    | "action-mismatch"
    | "network-error";
}

let warnedMissingSecret = false;

function turnstileSecret(): string | undefined {
  return getServerEnv().TURNSTILE_SECRET_KEY;
}

/**
 * True when a Turnstile secret is configured. In production a missing secret
 * means every protected form fails closed; in development the check is skipped
 * with one console notice so local work is not blocked.
 */
export function isTurnstileConfigured(): boolean {
  return Boolean(turnstileSecret());
}

export async function verifyTurnstile(options: {
  readonly token: string | undefined | null;
  readonly ip: string;
  readonly action: TurnstileAction;
}): Promise<TurnstileResult> {
  const secret = turnstileSecret();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "missing-secret" };
    }

    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.info(
        "[turnstile] TURNSTILE_SECRET_KEY is not set; skipping bot checks in development.",
      );
    }

    return { ok: true };
  }

  const token = options.token?.trim();

  if (!token) {
    return { ok: false, reason: "missing-token" };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: options.ip,
  });

  let response: Response;

  try {
    response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "network-error" };
  }

  if (!response.ok) {
    return { ok: false, reason: "verification-failed" };
  }

  let result: {
    success?: boolean;
    action?: string;
    "error-codes"?: string[];
  };

  try {
    result = (await response.json()) as typeof result;
  } catch {
    return { ok: false, reason: "verification-failed" };
  }

  if (!result.success) {
    return { ok: false, reason: "verification-failed" };
  }

  // Cloudflare echoes the action set by the widget. An empty action is accepted
  // only when the widget did not set one (older integrations), otherwise it must
  // match the form being protected.
  if (result.action && result.action !== options.action) {
    return { ok: false, reason: "action-mismatch" };
  }

  return { ok: true };
}

/** Generic message returned to the browser; never includes Cloudflare details. */
export const TURNSTILE_FAILURE_MESSAGE =
  "Complete the security check and try again. If it keeps failing, reload the page.";
