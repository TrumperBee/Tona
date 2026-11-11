import { describe, expect, it } from "vitest";

import { isNaiveDateTime, utcIsoToZonedNaive, zonedToUtcIso } from "@/lib/utils/zoned-dates";

describe("isNaiveDateTime", () => {
  it("accepts datetime-local strings", () => {
    expect(isNaiveDateTime("2026-11-10T14:30")).toBe(true);
    expect(isNaiveDateTime("2027-01-05T00:00")).toBe(true);
  });

  it("rejects other shapes", () => {
    expect(isNaiveDateTime("2026-11-10")).toBe(false);
    expect(isNaiveDateTime("2026-11-10T14:30:00")).toBe(false);
    expect(isNaiveDateTime("2026-11-10 14:30")).toBe(false);
    expect(isNaiveDateTime("")).toBe(false);
  });
});

describe("zonedToUtcIso", () => {
  it("converts Nairobi wall-clock to UTC (UTC+3, no DST)", () => {
    // 14:30 in Nairobi is 11:30 UTC.
    expect(zonedToUtcIso("2026-06-15T14:30", "Africa/Nairobi")).toBe("2026-06-15T11:30:00.000Z");
  });

  it("converts London wall-clock across the DST boundary", () => {
    // July is British Summer Time (UTC+1): 14:30 local is 13:30 UTC.
    expect(zonedToUtcIso("2026-07-15T14:30", "Europe/London")).toBe("2026-07-15T13:30:00.000Z");
    // January is UTC+0: the wall clock maps straight through.
    expect(zonedToUtcIso("2026-01-15T14:30", "Europe/London")).toBe("2026-01-15T14:30:00.000Z");
  });

  it("is the inverse of utcIsoToZonedNaive", () => {
    const iso = "2026-12-01T09:45:00.000Z";

    expect(zonedToUtcIso(utcIsoToZonedNaive(iso, "Africa/Nairobi"), "Africa/Nairobi")).toBe(iso);
    expect(zonedToUtcIso(utcIsoToZonedNaive(iso, "America/New_York"), "America/New_York")).toBe(
      iso,
    );
  });

  it("throws on a non-naive input", () => {
    expect(() => zonedToUtcIso("not-a-date", "UTC")).toThrow(RangeError);
  });
});

describe("utcIsoToZonedNaive", () => {
  it("renders UTC instants as Nairobi wall-clock", () => {
    expect(utcIsoToZonedNaive("2026-06-15T11:30:00.000Z", "Africa/Nairobi")).toBe(
      "2026-06-15T14:30",
    );
  });

  it("renders UTC instants as New York wall-clock", () => {
    // 2026-06-15 23:05 UTC is 19:05 in New York (UTC-4, EDT).
    expect(utcIsoToZonedNaive("2026-06-15T23:05:00.000Z", "America/New_York")).toBe(
      "2026-06-15T19:05",
    );
  });

  it("throws on an invalid instant", () => {
    expect(() => utcIsoToZonedNaive("nope", "UTC")).toThrow(RangeError);
  });
});
