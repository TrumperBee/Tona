// GCC — the TTL field must be a Firestore Timestamp, not epoch milliseconds.
import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import { rateLimitExpiryTimestamp } from "@/lib/rate-limit";

describe("rate-limit expiry", () => {
  it("returns a Firestore Timestamp at the end of the fixed window", () => {
    const windowStart = 1_700_000_000_000;
    const windowMs = 60_000;

    const expiry = rateLimitExpiryTimestamp(windowStart, windowMs);

    expect(expiry).toBeInstanceOf(Timestamp);
    expect(expiry.toMillis()).toBe(windowStart + windowMs);
  });
});
