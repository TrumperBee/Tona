// GCC - standings engine types and constants.
//
// PURE TypeScript: no Firebase, no framework imports, no I/O. A league table is
// derived only from the players entered in a competition and the completed
// league matches between them. The `lot` value is supplied by the caller (the
// server derives it from the draw's stored tie-break seed), so the engine never
// needs randomness of its own and every table is reproducible.

export const TIEBREAKER_PROFILES = ["uefa", "classic"] as const;
export type TiebreakerProfile = (typeof TIEBREAKER_PROFILES)[number];

export const DEFAULT_TIEBREAKER_PROFILE: TiebreakerProfile = "uefa";

export const TIEBREAKER_PROFILE_LABELS: Readonly<Record<TiebreakerProfile, string>> = {
  uefa: "UEFA-style (default)",
  classic: "Classic",
};

export const TIEBREAKER_PROFILE_DESCRIPTIONS: Readonly<Record<TiebreakerProfile, string>> = {
  uefa: "Points, goal difference, goals scored, away goals, wins, away wins, then opponents' aggregate points, goal difference and goals. Finally a drawing of lots.",
  classic: "Points, goal difference, goals scored, wins, then a drawing of lots.",
};

/** The tie-break criteria in the order the UEFA-style profile applies them. */
export const TIE_BREAK_CRITERIA = [
  "points",
  "goalDifference",
  "goalsFor",
  "awayGoals",
  "wins",
  "awayWins",
  "opponentPoints",
  "opponentGoalDifference",
  "opponentGoalsFor",
  "lot",
] as const;
export type TiebreakCriterion = (typeof TIE_BREAK_CRITERIA)[number];

export const CLASSIC_TIE_BREAK_CRITERIA = [
  "points",
  "goalDifference",
  "goalsFor",
  "wins",
  "lot",
] as const satisfies readonly TiebreakCriterion[];

export const TIEBREAK_CRITERION_LABELS: Readonly<Record<TiebreakCriterion, string>> = {
  points: "Points",
  goalDifference: "Goal difference",
  goalsFor: "Goals scored",
  awayGoals: "Away goals scored",
  wins: "Wins",
  awayWins: "Away wins",
  opponentPoints: "Opponents' aggregate points",
  opponentGoalDifference: "Opponents' aggregate goal difference",
  opponentGoalsFor: "Opponents' aggregate goals scored",
  lot: "Drawing of lots",
};

export const STANDING_BANDS = [
  "direct",
  "playoff_seeded",
  "playoff_unseeded",
  "eliminated",
] as const;
export type StandingBand = (typeof STANDING_BANDS)[number];

export const STANDING_BAND_LABELS: Readonly<Record<StandingBand, string>> = {
  direct: "Round of 16",
  playoff_seeded: "Play-off seeded",
  playoff_unseeded: "Play-off unseeded",
  eliminated: "Eliminated",
};

/** Inclusive last position for each band. Every later position is eliminated. */
export const STANDING_BAND_LIMITS: Readonly<Record<Exclude<StandingBand, "eliminated">, number>> = {
  direct: 8,
  playoff_seeded: 16,
  playoff_unseeded: 24,
};

export type StandingsForm = "W" | "D" | "L";

export interface StandingsPlayer {
  readonly id: string;
  /**
   * Deterministic tie-break lot supplied by the server. Lower sorts first.
   * Derived once from the draw's stored tie-break seed and the player id.
   */
  readonly lot: number;
}

export interface StandingsMatch {
  /** Stable identifier, used only to order matches deterministically for form. */
  readonly id: string;
  /** 1-based matchday. Matches without one sort first. */
  readonly matchday?: number;
  readonly homeId: string;
  readonly awayId: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
}

export interface StandingRowBase {
  readonly id: string;
  readonly lot: number;
  readonly position: number;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
  readonly awayGoals: number;
  /** Same as `won`; kept because the documented engine row exposes both. */
  readonly wins: number;
  readonly awayWins: number;
  readonly opponentPoints: number;
  readonly opponentGoalDifference: number;
  readonly opponentGoalsFor: number;
  /** Last five results in chronological order, newest last. */
  readonly form: readonly StandingsForm[];
  /**
   * The first criterion that separated this row from the row above when the
   * two are level on points; null when the row above has different points.
   */
  readonly separatedBy: TiebreakCriterion | null;
}

export interface StandingRow extends StandingRowBase {
  readonly band: StandingBand;
}

export interface ComputeStandingsInput {
  readonly players: readonly StandingsPlayer[];
  readonly matches: readonly StandingsMatch[];
  readonly profile?: TiebreakerProfile;
}
