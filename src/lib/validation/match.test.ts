// GCC - match result schema tests (Phase 11).
import { describe, expect, it } from "vitest";

import {
  matchResultBulkSchema,
  matchResultClearSchema,
  matchResultCorrectionSchema,
  matchResultEntrySchema,
  resultReportCreateSchema,
  resultReportResolveSchema,
  scoreSchema,
} from "@/lib/validation/match";

describe("scoreSchema", () => {
  it("accepts integers from 0 to 99", () => {
    expect(scoreSchema.safeParse(0).success).toBe(true);
    expect(scoreSchema.safeParse(99).success).toBe(true);
  });

  it("rejects negatives, decimals and values above 99", () => {
    expect(scoreSchema.safeParse(-1).success).toBe(false);
    expect(scoreSchema.safeParse(1.5).success).toBe(false);
    expect(scoreSchema.safeParse(100).success).toBe(false);
  });
});

describe("matchResultEntrySchema", () => {
  it("accepts a match id and two scores", () => {
    expect(
      matchResultEntrySchema.safeParse({ matchId: "league-md01-m01", homeGoals: 3, awayGoals: 1 })
        .success,
    ).toBe(true);
  });

  it("rejects a body carrying a tournament id or an unknown field", () => {
    expect(
      matchResultEntrySchema.safeParse({
        tournamentId: "cup",
        matchId: "m1",
        homeGoals: 3,
        awayGoals: 1,
      }).success,
    ).toBe(false);
  });
});

describe("matchResultBulkSchema", () => {
  it("accepts between one and eighteen results", () => {
    const one = [{ matchId: "m1", homeGoals: 1, awayGoals: 0 }];
    const eighteen = Array.from({ length: 18 }, (_, index) => ({
      matchId: `m${index}`,
      homeGoals: 1,
      awayGoals: 0,
    }));

    expect(matchResultBulkSchema.safeParse({ results: one }).success).toBe(true);
    expect(matchResultBulkSchema.safeParse({ results: eighteen }).success).toBe(true);
  });

  it("rejects empty and nineteen-result batches", () => {
    const nineteen = Array.from({ length: 19 }, (_, index) => ({
      matchId: `m${index}`,
      homeGoals: 1,
      awayGoals: 0,
    }));

    expect(matchResultBulkSchema.safeParse({ results: [] }).success).toBe(false);
    expect(matchResultBulkSchema.safeParse({ results: nineteen }).success).toBe(false);
  });
});

describe("matchResultCorrectionSchema and matchResultClearSchema", () => {
  it("requires a reason of 5 to 300 characters", () => {
    const base = { matchId: "m1", homeGoals: 2, awayGoals: 2 };

    expect(matchResultCorrectionSchema.safeParse({ ...base, reason: "typo" }).success).toBe(false);
    expect(
      matchResultCorrectionSchema.safeParse({ ...base, reason: "Wrong final score" }).success,
    ).toBe(true);
    expect(
      matchResultCorrectionSchema.safeParse({ ...base, reason: "x".repeat(301) }).success,
    ).toBe(false);

    expect(matchResultClearSchema.safeParse({ matchId: "m1", reason: "typo" }).success).toBe(false);
    expect(
      matchResultClearSchema.safeParse({ matchId: "m1", reason: "Match was not played" }).success,
    ).toBe(true);
  });
});

describe("result report schemas", () => {
  it("requires a report reason of 10 to 500 characters", () => {
    expect(resultReportCreateSchema.safeParse({ reason: "too short" }).success).toBe(false);
    expect(
      resultReportCreateSchema.safeParse({ reason: "The score is recorded backwards." }).success,
    ).toBe(true);
    expect(resultReportCreateSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
  });

  it("requires an admin note of 5 to 300 characters and a known decision", () => {
    expect(
      resultReportResolveSchema.safeParse({ decision: "resolved", adminNote: "ok" }).success,
    ).toBe(false);
    expect(
      resultReportResolveSchema.safeParse({ decision: "dismissed", adminNote: "No change needed" })
        .success,
    ).toBe(true);
    expect(
      resultReportResolveSchema.safeParse({ decision: "closed", adminNote: "No change needed" })
        .success,
    ).toBe(false);
  });
});
