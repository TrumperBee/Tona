// GCC - signed unsubscribe tokens.
//
// A token names one user, one stream and an expiry, and carries an
// HMAC-SHA256 signature keyed by EMAIL_UNSUBSCRIBE_SECRET. Verification is
// constant-time. Critical mail never receives one of these tokens.
import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const UNSUBSCRIBE_CATEGORIES = ["important", "result", "announcement"] as const;
export type UnsubscribeCategory = (typeof UNSUBSCRIBE_CATEGORIES)[number];

export const UNSUBSCRIBE_TOKEN_TTL_DAYS = 60;

interface TokenPayload {
  readonly u: string;
  readonly c: UnsubscribeCategory;
  readonly e: number;
}

export interface UnsubscribeTokenData {
  readonly uid: string;
  readonly category: UnsubscribeCategory;
  readonly expiresAt: number;
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isUnsubscribeCategory(value: unknown): value is UnsubscribeCategory {
  return typeof value === "string" && (UNSUBSCRIBE_CATEGORIES as readonly string[]).includes(value);
}

/** Mints a token. Throws when the secret is missing: callers must fail closed. */
export function signUnsubscribeToken(
  secret: string,
  data: {
    readonly uid: string;
    readonly category: UnsubscribeCategory;
    readonly expiresAt: number;
  },
): string {
  const payload: TokenPayload = {
    u: data.uid,
    c: data.category,
    e: Math.trunc(data.expiresAt),
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(secret, encoded)}`;
}

/** Returns the payload, or null for a malformed, tampered or expired token. */
export function verifyUnsubscribeToken(
  secret: string | null | undefined,
  token: string | null | undefined,
  now: number = Date.now(),
): UnsubscribeTokenData | null {
  if (!secret || !token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const expected = sign(secret, encoded);
  if (!safeEqual(signature, expected)) return null;

  let payload: TokenPayload;

  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TokenPayload;
  } catch {
    return null;
  }

  if (
    typeof payload?.u !== "string" ||
    payload.u.length === 0 ||
    !isUnsubscribeCategory(payload?.c) ||
    typeof payload?.e !== "number" ||
    !Number.isFinite(payload.e)
  ) {
    return null;
  }

  if (payload.e <= now) return null;

  return { uid: payload.u, category: payload.c, expiresAt: payload.e };
}

/** Builds the absolute one-click unsubscribe URL for a non-critical email. */
export function buildUnsubscribeUrl(
  secret: string,
  siteUrl: string,
  data: {
    readonly uid: string;
    readonly category: UnsubscribeCategory;
    readonly now?: number;
  },
): string {
  const expiresAt = (data.now ?? Date.now()) + UNSUBSCRIBE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  const token = signUnsubscribeToken(secret, {
    uid: data.uid,
    category: data.category,
    expiresAt,
  });

  return `${siteUrl.replace(/\/+$/, "")}/unsubscribe?t=${encodeURIComponent(token)}`;
}
