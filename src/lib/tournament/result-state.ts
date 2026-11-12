// GCC - pure match result state transitions.
//
// Results are entered by the tournament owner or Super Admin only. This module
// contains no I/O so the legal transitions can be unit-tested directly. Phase 11
// supports league-stage matches; Phase 13 widens the stage list.
import type { MatchStatus, StageType, TournamentStatus } from "@/types/domain";

/** Stages whose results this phase can record. Knockouts arrive in Phase 13. */
export const RESULT_ENTRY_STAGES: readonly StageType[] = ["league"];

/** Tournament statuses in which league results may be entered or corrected. */
export const RESULT_ENTRY_TOURNAMENT_STATUSES: readonly TournamentStatus[] = [
  "fixtures_published",
  "league_phase",
];

export type ResultAction = "enter" | "correct" | "clear";

export interface ResultTransitionInput {
  readonly stage: StageType;
  readonly status: MatchStatus;
  readonly hasResult: boolean;
}

export interface ResultTransitionPlan {
  readonly status: MatchStatus;
  readonly result: "written" | "cleared";
  readonly incrementEditCount: boolean;
  /** +1 when a result is entered, -1 when cleared, 0 otherwise. */
  readonly completedDelta: -1 | 0 | 1;
}

export type ResultTransitionResult =
  | { readonly ok: true; readonly plan: ResultTransitionPlan }
  | { readonly ok: false; readonly message: string };

export function isResultEntryTournamentStatus(status: TournamentStatus): boolean {
  return RESULT_ENTRY_TOURNAMENT_STATUSES.includes(status);
}

/** The tournament status to store after entering one league result. */
export function tournamentStatusAfterResultEntered(status: TournamentStatus): TournamentStatus {
  return status === "fixtures_published" ? "league_phase" : status;
}

/**
 * The tournament status to store after clearing one result. The league returns
 * to `fixtures_published` only when no completed result remains.
 */
export function tournamentStatusAfterResultCleared(
  status: TournamentStatus,
  remainingCompleted: number,
): TournamentStatus {
  return status === "league_phase" && remainingCompleted <= 0 ? "fixtures_published" : status;
}

/**
 * Validates one result transition. Entering needs a scheduled league match with
 * no result; correcting and clearing need a completed league match with a
 * result. Every other combination is refused with an honest message.
 */
export function planResultTransition(
  action: ResultAction,
  input: ResultTransitionInput,
): ResultTransitionResult {
  if (!RESULT_ENTRY_STAGES.includes(input.stage)) {
    return { ok: false, message: "Only league-phase results can be recorded right now." };
  }

  if (action === "enter") {
    if (input.status !== "scheduled" || input.hasResult) {
      return {
        ok: false,
        message: "That result has already been recorded. Use correct instead.",
      };
    }

    return {
      ok: true,
      plan: {
        status: "completed",
        result: "written",
        incrementEditCount: false,
        completedDelta: 1,
      },
    };
  }

  if (input.status !== "completed" || !input.hasResult) {
    return {
      ok: false,
      message:
        action === "correct"
          ? "Only a recorded result can be corrected."
          : "Only a recorded result can be cleared.",
    };
  }

  if (action === "correct") {
    return {
      ok: true,
      plan: {
        status: "completed",
        result: "written",
        incrementEditCount: true,
        completedDelta: 0,
      },
    };
  }

  return {
    ok: true,
    plan: {
      status: "scheduled",
      result: "cleared",
      incrementEditCount: false,
      completedDelta: -1,
    },
  };
}
