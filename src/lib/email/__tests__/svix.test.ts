// GCC - Resend (Svix) webhook signature unit tests.
//
// A webhook can suppress an address and mark an account undeliverable, so a
// forged or replayed request must be rejected before any write happens.
import { describe, expect, it } from "vitest";

import { computeSvixSignature, SVIX_REPLAY_WINDOW_MS, verifySvixSignature } from "@/lib/email/svix";

const SECRET = `whsec_${Buffer.from("unit-test-webhook-secret").toString("base64")}`;
const NOW = new Date("2026-11-17T12:00:00.000Z");
const TIMESTAMP = String(Math.floor(NOW.getTime() / 1000));
const BODY = JSON.stringify({ type: "email.bounced", data: { to: "player@example.com" } });
const ID = "msg_123";

function signature(body = BODY, timestamp = TIMESTAMP, secret = SECRET, id = ID): string {
  return `v1,${computeSvixSignature(secret, id, timestamp, body)}`;
}

function verify(overrides: Partial<Parameters<typeof verifySvixSignature>[0]> = {}) {
  return verifySvixSignature({
    secret: SECRET,
    headers: { id: ID, timestamp: TIMESTAMP, signature: signature() },
    rawBody: BODY,
    now: NOW,
    ...overrides,
  });
}

describe("verifySvixSignature", () => {
  it("accepts a correctly signed body", () => {
    expect(verify()).toBe(true);
  });

  it("accepts a signature with several space-separated versions", () => {
    expect(
      verify({
        headers: {
          id: ID,
          timestamp: TIMESTAMP,
          signature: `v1,${Buffer.from("wrong").toString("base64")} ${signature()} v2,ignored`,
        },
      }),
    ).toBe(true);
  });

  it("rejects a wrong, missing or malformed signature", () => {
    expect(verify({ headers: { id: ID, timestamp: TIMESTAMP, signature: "v1,AAAA" } })).toBe(false);
    expect(verify({ headers: { id: ID, timestamp: TIMESTAMP, signature: "" } })).toBe(false);
    expect(verify({ headers: { id: ID, timestamp: TIMESTAMP, signature: "v2,whatever" } })).toBe(
      false,
    );
    expect(verify({ headers: { id: null, timestamp: TIMESTAMP, signature: signature() } })).toBe(
      false,
    );
    expect(verify({ headers: { id: ID, timestamp: null, signature: signature() } })).toBe(false);
    expect(verify({ headers: { id: ID, timestamp: TIMESTAMP, signature: null } })).toBe(false);
  });

  it("rejects a body that was changed after signing", () => {
    expect(verify({ rawBody: `${BODY} ` })).toBe(false);
  });

  it("rejects a missing or wrong secret", () => {
    expect(verify({ secret: null })).toBe(false);
    expect(verify({ secret: "" })).toBe(false);

    const other = `whsec_${Buffer.from("another-secret").toString("base64")}`;
    expect(
      verify({
        headers: {
          id: ID,
          timestamp: TIMESTAMP,
          signature: signature(BODY, TIMESTAMP, other),
        },
      }),
    ).toBe(false);
  });

  it("rejects a timestamp outside the five-minute replay window", () => {
    const old = String(Math.floor((NOW.getTime() - SVIX_REPLAY_WINDOW_MS - 1000) / 1000));
    const future = String(Math.floor((NOW.getTime() + SVIX_REPLAY_WINDOW_MS + 1000) / 1000));

    expect(
      verify({
        headers: { id: ID, timestamp: old, signature: signature(BODY, old) },
      }),
    ).toBe(false);
    expect(
      verify({
        headers: { id: ID, timestamp: future, signature: signature(BODY, future) },
      }),
    ).toBe(false);
  });

  it("accepts a timestamp exactly on the replay boundary", () => {
    const boundary = String(Math.floor((NOW.getTime() - SVIX_REPLAY_WINDOW_MS) / 1000));

    expect(
      verify({
        headers: { id: ID, timestamp: boundary, signature: signature(BODY, boundary) },
      }),
    ).toBe(true);
  });

  it("rejects a non-numeric timestamp", () => {
    expect(
      verify({
        headers: { id: ID, timestamp: "yesterday", signature: signature() },
      }),
    ).toBe(false);
  });
});
