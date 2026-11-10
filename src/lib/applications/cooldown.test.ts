import { describe, expect, it } from "vitest";

import { applicationCooldown, DAY_MS, normaliseCooldownDays } from "./cooldown";

const REJECTED_AT = new Date("2026-11-01T12:00:00.000Z");

describe("application cooldown", () => {
  it("allows an applicant with no rejection", () => {
    expect(applicationCooldown(null, 7, REJECTED_AT)).toEqual({
      allowed: true,
      reapplyAt: null,
    });
  });

  it("blocks until the configured number of days has elapsed", () => {
    const during = applicationCooldown(
      REJECTED_AT,
      7,
      new Date(REJECTED_AT.getTime() + DAY_MS * 3),
    );

    expect(during.allowed).toBe(false);
    expect(during.reapplyAt?.toISOString()).toBe("2026-11-08T12:00:00.000Z");
  });

  it("allows exactly at the reapply instant and afterwards", () => {
    expect(applicationCooldown(REJECTED_AT, 7, new Date("2026-11-08T12:00:00.000Z")).allowed).toBe(
      true,
    );
    expect(applicationCooldown(REJECTED_AT, 7, new Date("2026-11-09T00:00:00.000Z")).allowed).toBe(
      true,
    );
  });

  it("treats a zero-day cooldown as unrestricted", () => {
    expect(applicationCooldown(REJECTED_AT, 0, REJECTED_AT)).toEqual({
      allowed: true,
      reapplyAt: null,
    });
  });

  it("clamps invalid settings instead of failing or locking forever", () => {
    expect(normaliseCooldownDays(Number.NaN)).toBe(7);
    expect(normaliseCooldownDays(-5)).toBe(0);
    expect(normaliseCooldownDays(500)).toBe(90);
    expect(normaliseCooldownDays(7.9)).toBe(7);
  });

  it("calculates the reapply date using whole days", () => {
    const decision = applicationCooldown(REJECTED_AT, 2, REJECTED_AT);

    expect(decision.reapplyAt?.getTime()).toBe(REJECTED_AT.getTime() + 2 * DAY_MS);
  });
});
