// GCC — Firestore-backed fixed-window rate limiting.
//
// Serverless instances do not share memory, so counters live in Firestore and
// every check/update runs in a transaction. This is deliberately simple.
//
// Limitations (documented, not hidden):
// - It is a fixed window, not a sliding window, so a caller can burst around a
//   window boundary.
// - Firestore transactions add latency and can retry under contention.
// - Counter documents are removed by the configured Firestore TTL policy on
//   `expiresAt`; deletion is asynchronous (typically within 24 hours) and the
//   fixed-window logic does not depend on the delete happening promptly.
// - Keys must be derived carefully (IP, user id, endpoint) to avoid one caller
//   exhausting another caller's budget.
// - This is application-level abuse control, not a substitute for a WAF or
//   Firebase Authentication's own quotas.
import "server-only";

import { createHash } from "node:crypto";

import { Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { RateLimitDocument } from "@/types/domain";

export interface RateLimitPolicy {
  readonly key: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

export type RateLimitResult =
  | { readonly allowed: true; readonly remaining: number }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

function validatePolicy(policy: RateLimitPolicy): void {
  if (policy.key.trim().length === 0) {
    throw new Error("Rate-limit key must not be empty.");
  }

  if (!Number.isInteger(policy.limit) || policy.limit < 1) {
    throw new Error("Rate-limit limit must be a positive integer.");
  }

  if (!Number.isInteger(policy.windowSeconds) || policy.windowSeconds < 1) {
    throw new Error("Rate-limit windowSeconds must be a positive integer.");
  }
}

/** Returns a stable, path-safe document id for a caller-supplied rate-limit key. */
export function rateLimitDocumentId(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Firestore TTL policies only expire `Date and time` values. The fixed-window
 * logic still uses numeric `windowStart`, so `expiresAt` exists for TTL only.
 */
export function rateLimitExpiryTimestamp(windowStart: number, windowMs: number): Timestamp {
  return Timestamp.fromMillis(windowStart + windowMs);
}

/**
 * Consumes one unit from a fixed window and reports whether the caller is
 * allowed to continue. Denied calls do not extend the window.
 */
export async function checkRateLimit(policy: RateLimitPolicy): Promise<RateLimitResult> {
  validatePolicy(policy);

  const firestore = getFirebaseAdminFirestore();
  const reference = firestore.collection(paths.rateLimits()).doc(rateLimitDocumentId(policy.key));
  const windowMs = policy.windowSeconds * 1000;

  return firestore.runTransaction<RateLimitResult>(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const now = Date.now();
    const existing = snapshot.exists ? (snapshot.data() as Partial<RateLimitDocument>) : null;

    const existingWindowStart =
      typeof existing?.windowStart === "number" ? existing.windowStart : null;
    const inCurrentWindow = existingWindowStart !== null && now - existingWindowStart < windowMs;

    const windowStart = inCurrentWindow ? existingWindowStart : now;
    const previousCount =
      inCurrentWindow && typeof existing?.count === "number" ? existing.count : 0;
    const count = previousCount + 1;

    if (count > policy.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
      };
    }

    // Never persist the readable key: it can contain an email address or IP.
    // The document id is already a SHA-256 of the key, so this fingerprint is
    // only for operator debugging.
    transaction.set(reference, {
      fingerprint: rateLimitDocumentId(policy.key).slice(0, 12),
      count,
      windowStart,
      expiresAt: rateLimitExpiryTimestamp(windowStart, windowMs),
      updatedAt: now,
    });

    return { allowed: true, remaining: policy.limit - count };
  });
}

/**
 * Reads the current count without consuming a unit. Used by challenge flows
 * (for example "require Turnstile after 3 failed sign-ins") where the caller
 * asks a question instead of making a request.
 */
export async function readRateLimit(policy: RateLimitPolicy): Promise<number> {
  validatePolicy(policy);

  const reference = getFirebaseAdminFirestore()
    .collection(paths.rateLimits())
    .doc(rateLimitDocumentId(policy.key));
  const snapshot = await reference.get();

  if (!snapshot.exists) {
    return 0;
  }

  const existing = snapshot.data() as Partial<RateLimitDocument>;
  const windowStart = typeof existing.windowStart === "number" ? existing.windowStart : 0;
  const windowMs = policy.windowSeconds * 1000;

  if (windowStart === 0 || Date.now() - windowStart >= windowMs) {
    return 0;
  }

  return typeof existing.count === "number" ? existing.count : 0;
}

/** Removes a counter, for example after a successful sign-in. */
export async function clearRateLimit(policy: RateLimitPolicy): Promise<void> {
  validatePolicy(policy);

  await getFirebaseAdminFirestore()
    .collection(paths.rateLimits())
    .doc(rateLimitDocumentId(policy.key))
    .delete();
}

/** Convenience policy factory for endpoint-specific limits. */
export function rateLimitPolicy(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): RateLimitPolicy {
  return {
    key: `${scope}:${identifier}`,
    limit,
    windowSeconds,
  };
}
