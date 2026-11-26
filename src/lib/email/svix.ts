// GCC - Svix-style webhook signature verification for Resend.
//
// Resend signs webhooks the same way Svix does. The signed content is
// `{id}.{timestamp}.{rawBody}` and the secret is base64 after the `whsec_`
// prefix. Signatures are compared in constant time and timestamps older than
// five minutes are rejected to stop replay attacks.
import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const SVIX_REPLAY_WINDOW_MS = 5 * 60 * 1000;

export interface SvixHeaders {
  readonly id: string | null;
  readonly timestamp: string | null;
  readonly signature: string | null;
}

export interface VerifySvixInput {
  readonly secret: string | null | undefined;
  readonly headers: SvixHeaders;
  readonly rawBody: string;
  readonly now?: Date;
}

function decodeSecret(secret: string): Buffer {
  const raw = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  return Buffer.from(raw, "base64");
}

/** Computes the base64 HMAC for the signed content. Exported for tests. */
export function computeSvixSignature(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
): string {
  return createHmac("sha256", decodeSecret(secret))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

/**
 * Verifies a webhook request. `signature` may contain multiple space-separated
 * versions (`v1,base64 v1,other`); any matching `v1` value is accepted.
 */
export function verifySvixSignature(input: VerifySvixInput): boolean {
  const { secret, headers, rawBody } = input;

  if (!secret || !headers.id || !headers.timestamp || !headers.signature) {
    return false;
  }

  const timestamp = Number(headers.timestamp);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const now = (input.now ?? new Date()).getTime();
  const age = Math.abs(now - timestamp * 1000);

  if (age > SVIX_REPLAY_WINDOW_MS) {
    return false;
  }

  let expected: string;

  try {
    expected = computeSvixSignature(secret, headers.id, headers.timestamp, rawBody);
  } catch {
    return false;
  }

  return headers.signature
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .some((part) => safeEqual(part.slice(3), expected));
}
