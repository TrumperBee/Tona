// GCC - pure match result transition tests (Phase 11).
import { describe, expect, it } from "vitest";

import {
  isResultEntryTournamentStatus,
  planResultTransition,
  tournamentStatusAfterResultCleared,
  tournamentStatusAfterResultEntered,
} from "@/lib/tournament/result-state";

describe("planResultTransition", () => {
  it("enters a result for a scheduled league match", () => {
    const result = planResultTransition("enter", {
      stage: "league",
      status: "scheduled",
      hasResult: false,
    });

    expect(result).toEqual({
      ok: true,
      plan: {
        status: "completed",
        result: "written",
        incrementEditCount: false,
        completedDelta: 1,
      },
    });
  });

  it("refuses to enter a result twice", () => {
    const result = planResultTransition("enter", {
      stage: "league",
      status: "completed",
      hasResult: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Use correct");
    }
  });

  it("corrects and clears only a completed match with a result", () => {
    expect(
      planResultTransition("correct", {
        stage: "league",
        status: "completed",
        hasResult: true,
      }),
    ).toEqual({
      ok: true,
      plan: {
        status: "completed",
        result: "written",
        incrementEditCount: true,
        completedDelta: 0,
      },
    });

    expect(
      planResultTransition("clear", {
        stage: "league",
        status: "completed",
        hasResult: true,
      }),
    ).toEqual({
      ok: true,
      plan: {
        status: "scheduled",
        result: "cleared",
        incrementEditCount: false,
        completedDelta: -1,
      },
    });

    expect(
      planResultTransition("correct", {
        stage: "league",
        status: "scheduled",
        hasResult: false,
      }).ok,
    ).toBe(false);
    expect(
      planResultTransition("clear", {
        stage: "league",
        status: "scheduled",
        hasResult: false,
      }).ok,
    ).toBe(false);
  });

  it("accepts every knockout stage", () => {
    for (const stage of ["playoff", "r16", "qf", "sf", "final"] as const) {
      expect(
        planResultTransition("enter", {
          stage,
          status: "scheduled",
          hasResult: false,
        }).ok,
      ).toBe(true);
    }
  });
});

describe("tournament status helpers", () => {
  it("moves fixtures_published to league_phase on the first result", () => {
    expect(tournamentStatusAfterResultEntered("fixtures_published")).toBe("league_phase");
    expect(tournamentStatusAfterResultEntered("league_phase")).toBe("league_phase");
  });

  it("returns to fixtures_published only when the last result is cleared", () => {
    expect(tournamentStatusAfterResultCleared("league_phase", 0)).toBe("fixtures_published");
    expect(tournamentStatusAfterResultCleared("league_phase", 3)).toBe("league_phase");
    expect(tournamentStatusAfterResultCleared("completed", 0)).toBe("completed");
  });

  it("separates league and knockout result-entry statuses", () => {
    expect(isResultEntryTournamentStatus("fixtures_published")).toBe(true);
    expect(isResultEntryTournamentStatus("league_phase")).toBe(true);
    expect(isResultEntryTournamentStatus("pots_confirmed")).toBe(false);
    expect(isResultEntryTournamentStatus("knockout")).toBe(false);
    expect(isResultEntryTournamentStatus("knockout", "r16")).toBe(true);
    expect(isResultEntryTournamentStatus("league_phase", "r16")).toBe(false);
  });
});
