// GCC - fixture engine types and constants.
//
// PURE TypeScript: no Firebase, no framework imports, no I/O. A league-phase
// schedule is generated from four pots of nine and a recorded seed. The types
// in this module are shared by the generator and the server boundary; the
// independent validator deliberately does not import the generator.
export const FIXTURE_ALGORITHM_VERSION = 1;

export const LEAGUE_POT_COUNT = 4;
export const LEAGUE_POT_SIZE = 9;
export const LEAGUE_PLAYER_COUNT = LEAGUE_POT_COUNT * LEAGUE_POT_SIZE;
export const LEAGUE_MATCHDAY_COUNT = 8;
export const LEAGUE_MATCHES_PER_MATCHDAY = 18;
export const LEAGUE_MATCH_COUNT = LEAGUE_MATCHDAY_COUNT * LEAGUE_MATCHES_PER_MATCHDAY;

/** Exact-cover search budget for one Step B attempt. */
export const FIXTURE_COLOURING_NODE_BUDGET = 50_000;
/** Deterministic retries before the generator gives up loudly. */
export const FIXTURE_MAX_ATTEMPTS = 50;

export type FixtureErrorCode =
  "invalid-pots" | "invalid-seed" | "colouring-failed" | "attempts-exhausted";

/** A typed generation failure. Routes map `message` straight to the user. */
export class FixtureGenerationError extends Error {
  readonly code: FixtureErrorCode;
  readonly attempts: number;

  constructor(code: FixtureErrorCode, message: string, attempts = 0) {
    super(message);
    this.name = "FixtureGenerationError";
    this.code = code;
    this.attempts = attempts;
  }
}

/** One generated match. Matchdays are 1-based. */
export interface GeneratedFixture {
  readonly matchday: number;
  readonly homeId: string;
  readonly awayId: string;
}

export interface LeaguePhaseReport {
  readonly algorithmVersion: number;
  /** The seed that actually produced the schedule (after any retries). */
  readonly attemptSeed: string;
  readonly attempts: number;
  readonly colouringNodes: number;
  /** Longest run of consecutive home or away matches for any player. */
  readonly maxHomeAwayStreak: number;
  /** Players with at least one run of three or more consecutive H or A. */
  readonly playersWithStreak3Plus: number;
  /** Always eight entries; each should equal 18. */
  readonly perMatchdayCounts: readonly number[];
}

export interface LeaguePhaseGeneration {
  readonly fixtures: readonly GeneratedFixture[];
  /** The caller's seed, unchanged. `report.attemptSeed` records a retry. */
  readonly seed: string;
  /** 1-based number of the attempt that succeeded. */
  readonly attempts: number;
  readonly report: LeaguePhaseReport;
}

export interface GenerateLeaguePhaseInput {
  readonly pots: readonly (readonly string[])[];
  readonly seed: string;
}

/** Test-only overrides; production callers use the defaults. */
export interface GenerateLeaguePhaseOptions {
  readonly maxAttempts?: number;
  readonly colourNodeBudget?: number;
}
