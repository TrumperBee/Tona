// GCC - signed unsubscribe token unit tests.
//
// A token is the only credential an unauthenticated unsubscribe link carries, so
// tampering, expiry and a missing secret must all fail closed.
import { describe, expect, it } from "vitest";

import {
  buildUnsubscribeUrl,
  isUnsubscribeCategory,
  signUnsubscribeToken,
  UNSUBSCRIBE_TOKEN_TTL_DAYS,
  verifyUnsubscribeToken,
} from "@/lib/email/tokens";

const SECRET = "unit-test-unsubscribe-secret";
const UID = "player-uid";
const NOW = Date.UTC(2026, 10, 17, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function mint(
  overrides: Partial<{ category: "important" | "result" | "announcement"; expiresAt: number }> = {},
) {
  return signUnsubscribeToken(SECRET, {
    uid: UID,
    category: overrides.category ?? "important",
    expiresAt: overrides.expiresAt ?? NOW + DAY,
  });
}

describe("signUnsubscribeToken / verifyUnsubscribeToken", () => {
  it("round-trips the uid, category and expiry", () => {
    const token = mint({ category: "result" });
    const verified = verifyUnsubscribeToken(SECRET, token, NOW);

    expect(verified).toEqual({ uid: UID, category: "result", expiresAt: NOW + DAY });
  });

  it("rejects a token signed with another secret", () => {
    expect(verifyUnsubscribeToken("another-secret", mint(), NOW)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const [encoded, signature] = mint().split(".");
    const forged = Buffer.from(
      JSON.stringify({ u: "someone-else", c: "important", e: NOW + DAY }),
    ).toString("base64url");

    expect(verifyUnsubscribeToken(SECRET, `${forged}.${signature}`, NOW)).toBeNull();
    expect(verifyUnsubscribeToken(SECRET, `${encoded}.${signature}tampered`, NOW)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = mint({ expiresAt: NOW });
    expect(verifyUnsubscribeToken(SECRET, token, NOW)).toBeNull();
    expect(verifyUnsubscribeToken(SECRET, token, NOW + 1)).toBeNull();
    expect(verifyUnsubscribeToken(SECRET, token, NOW - 1)).not.toBeNull();
  });

  it("fails closed without a secret or a token", () => {
    expect(verifyUnsubscribeToken(null, mint(), NOW)).toBeNull();
    expect(verifyUnsubscribeToken(undefined, mint(), NOW)).toBeNull();
    expect(verifyUnsubscribeToken("", mint(), NOW)).toBeNull();
    expect(verifyUnsubscribeToken(SECRET, null, NOW)).toBeNull();
    expect(verifyUnsubscribeToken(SECRET, "", NOW)).toBeNull();
  });

  it("rejects malformed input", () => {
    for (const value of [
      "not-a-token",
      "a.b.c",
      ".",
      "abc.",
      ".def",
      Buffer.from("{}").toString("base64url"),
    ]) {
      expect(verifyUnsubscribeToken(SECRET, value, NOW)).toBeNull();
    }
  });

  it("rejects a valid signature over an unknown category", () => {
    const encoded = Buffer.from(JSON.stringify({ u: UID, c: "everything", e: NOW + DAY })).toString(
      "base64url",
    );
    // Re-sign the forged payload so only category validation can reject it.
    const token = signUnsubscribeToken(SECRET, {
      uid: UID,
      category: "important",
      expiresAt: NOW + DAY,
    });
    const signature = token.split(".")[1];

    expect(verifyUnsubscribeToken(SECRET, `${encoded}.${signature}`, NOW)).toBeNull();
  });
});

describe("buildUnsubscribeUrl", () => {
  it("builds an absolute confirmation URL whose token verifies", () => {
    const url = buildUnsubscribeUrl(SECRET, "https://gcc.example/", {
      uid: UID,
      category: "announcement",
      now: NOW,
    });
    const parsed = new URL(url);
    const rawToken = parsed.searchParams.get("t");
    const verified = verifyUnsubscribeToken(SECRET, rawToken, NOW);

    expect(parsed.pathname).toBe("/unsubscribe");
    expect(verified).toEqual({
      uid: UID,
      category: "announcement",
      expiresAt: NOW + UNSUBSCRIBE_TOKEN_TTL_DAYS * DAY,
    });
  });
});

describe("isUnsubscribeCategory", () => {
  it("accepts only the three streams", () => {
    expect(isUnsubscribeCategory("important")).toBe(true);
    expect(isUnsubscribeCategory("result")).toBe(true);
    expect(isUnsubscribeCategory("announcement")).toBe(true);
    expect(isUnsubscribeCategory("critical")).toBe(false);
    expect(isUnsubscribeCategory(null)).toBe(false);
  });
});
