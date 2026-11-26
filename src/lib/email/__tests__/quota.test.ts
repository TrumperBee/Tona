// GCC - quota helpers and suppression hashing unit tests.
//
// These are the pure parts of the delivery pipeline: the 80% normal cap, the
// monthly warning point, the UTC document keys and the SHA-256 id used instead
// of a readable address.
import { describe, expect, it } from "vitest";

import { maskEmail } from "@/lib/email/client";
import {
  dailyNormalCap,
  monthlyWarnThreshold,
  NORMAL_QUOTA_FRACTION,
  utcDayKey,
  utcMonthKey,
} from "@/lib/email/quota";
import { suppressionId } from "@/lib/email/suppression";

describe("quota keys", () => {
  it("builds UTC day and month document ids", () => {
    const now = new Date("2026-11-17T23:59:59.000Z");

    expect(utcDayKey(now)).toBe("20261117");
    expect(utcMonthKey(now)).toBe("month-202611");
    expect(utcDayKey(new Date("2026-01-02T00:00:00.000Z"))).toBe("20260102");
    expect(utcMonthKey(new Date("2026-01-02T00:00:00.000Z"))).toBe("month-202601");
  });

  it("uses a fixed 80% normal fraction", () => {
    expect(NORMAL_QUOTA_FRACTION).toBe(0.8);
  });
});

describe("dailyNormalCap", () => {
  it("stops normal mail at 80% of the daily limit", () => {
    expect(dailyNormalCap(100)).toBe(80);
    expect(dailyNormalCap(1000)).toBe(800);
    expect(dailyNormalCap(10)).toBe(8);
  });

  it("rounds down and never returns a negative cap", () => {
    expect(dailyNormalCap(9)).toBe(7);
    expect(dailyNormalCap(1)).toBe(0);
    expect(dailyNormalCap(0)).toBe(0);
    expect(dailyNormalCap(-5)).toBe(0);
  });
});

describe("monthlyWarnThreshold", () => {
  it("warns at 80% of the monthly reference, rounded up", () => {
    expect(monthlyWarnThreshold(3000)).toBe(2400);
    expect(monthlyWarnThreshold(100)).toBe(80);
    expect(monthlyWarnThreshold(9)).toBe(8);
    expect(monthlyWarnThreshold(1)).toBe(1);
  });
});

describe("suppressionId", () => {
  it("is a stable SHA-256 hex digest of the normalised address", () => {
    const id = suppressionId("Player@Example.com");

    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(suppressionId("player@example.com")).toBe(id);
    expect(suppressionId("  PLAYER@EXAMPLE.COM  ")).toBe(id);
    expect(suppressionId("player@example.com ")).toBe(id);
  });

  it("never contains the readable address and differs per address", () => {
    const id = suppressionId("player@example.com");

    expect(id).not.toContain("player");
    expect(id).not.toContain("example");
    expect(suppressionId("other@example.com")).not.toBe(id);
  });
});

describe("maskEmail", () => {
  it("keeps only the first local character and the domain", () => {
    expect(maskEmail("player@example.com")).toBe("p***@example.com");
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
  });

  it("never returns a full address for malformed input", () => {
    expect(maskEmail("not-an-email")).toBe("***");
    expect(maskEmail(null)).toBe("");
    expect(maskEmail("")).toBe("");
    expect(maskEmail("@example.com")).toBe("***");
  });
});
