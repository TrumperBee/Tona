// GCC - knockout engine types and constants.
//
// PURE TypeScript: no Firebase, no framework imports, no I/O. The bracket is
// defined by this document, inspired by but not identical to UEFA's path.
export const KNOCKOUT_ROUNDS = ["playoff", "r16", "qf", "sf", "final"] as const;
export type KnockoutRound = (typeof KNOCKOUT_ROUNDS)[number];

export const KNOCKOUT_ROUND_LABELS: Readonly<Record<KnockoutRound, string>> = {
  playoff: "Knockout play-off",
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  final: "Final",
};

export const KNOCKOUT_ROUND_TIE_COUNTS: Readonly<Record<KnockoutRound, number>> = {
  playoff: 8,
  r16: 8,
  qf: 4,
  sf: 2,
  final: 1,
};

/** Three-letter code used in deterministic match ids. */
export const KNOCKOUT_ROUND_SLUGS: Readonly<Record<KnockoutRound, string>> = {
  playoff: "po",
  r16: "r16",
  qf: "qf",
  sf: "sf",
  final: "f",
};

export const PLAYOFF_GROUPS = ["A", "B", "C", "D"] as const;
export type PlayoffGroup = (typeof PLAYOFF_GROUPS)[number];

/**
 * Group definitions. The first pair is seeded (league positions 9-16), the
 * second pair unseeded (17-24). Each group draws two seeded-vs-unseeded ties.
 */
export const PLAYOFF_GROUP_SEEDS: Readonly<
  Record<
    PlayoffGroup,
    { readonly seeded: readonly [number, number]; readonly unseeded: readonly [number, number] }
  >
> = {
  A: { seeded: [9, 10], unseeded: [23, 24] },
  B: { seeded: [11, 12], unseeded: [21, 22] },
  C: { seeded: [13, 14], unseeded: [19, 20] },
  D: { seeded: [15, 16], unseeded: [17, 18] },
};

/**
 * The direct-qualifier bracket order. Adjacent Round-of-16 ties form a
 * quarter-final, adjacent quarter-finals form a semi-final. Seeds 1 and 2 sit
 * at opposite ends and can only meet in the final.
 */
export const R16_BRACKET_ORDER = [1, 8, 4, 5, 2, 7, 3, 6] as const;

/** Which play-off group feeds each direct seed in the Round of 16. */
export const R16_OPPONENT_GROUP: Readonly<Record<number, PlayoffGroup>> = {
  1: "D",
  2: "D",
  3: "C",
  4: "C",
  5: "B",
  6: "B",
  7: "A",
  8: "A",
};

export const KNOCKOUT_LEG_CHOICES = [1, 2] as const;
export type KnockoutLegs = (typeof KNOCKOUT_LEG_CHOICES)[number];

/** Bumped whenever the bracket algorithm changes in a replay-breaking way. */
export const KNOCKOUT_ALGORITHM_VERSION = 2;

export interface KnockoutConfig {
  readonly playoff: KnockoutLegs;
  readonly r16: KnockoutLegs;
  readonly qf: KnockoutLegs;
  readonly sf: KnockoutLegs;
  /** The final is always a single match. */
  readonly final: 1;
}

export const DEFAULT_KNOCKOUT_CONFIG: KnockoutConfig = {
  playoff: 2,
  r16: 2,
  qf: 2,
  sf: 2,
  final: 1,
};

export interface KnockoutPlayer {
  readonly playerId: string;
  /** 1-based league-phase position. */
  readonly position: number;
  readonly gamerTag?: string;
}

/**
 * A bracket slot points either at a fixed league seed or at the winner of an
 * earlier tie. Nothing about a later round is inferred before its source tie
 * completes.
 */
export type KnockoutSlot =
  | { readonly type: "seed"; readonly seed: number }
  | { readonly type: "winnerOf"; readonly tieId: string };

export interface BracketSlot {
  readonly ref: KnockoutSlot;
  /** Known participant, or null while the source tie is undecided. */
  readonly player: KnockoutPlayer | null;
}

/** One tie in the complete bracket, including unresolved later rounds. */
export interface BracketTie {
  readonly tieId: string;
  readonly round: KnockoutRound;
  /** 1-based position inside the round. Adjacent slots form the next round. */
  readonly bracketSlot: number;
  readonly legs: KnockoutLegs;
  readonly higher: BracketSlot;
  readonly lower: BracketSlot;
  /** The play-off group this tie belongs to, or null in later rounds. */
  readonly group: PlayoffGroup | null;
  readonly winner: KnockoutPlayer | null;
}

export interface KnockoutBracket {
  readonly seed: string;
  /** Configured leg count for every round before the final. */
  readonly legs: KnockoutLegs;
  readonly ties: readonly BracketTie[];
}

export interface BracketTieResult {
  readonly tieId: string;
  /** Null clears a previously recorded winner. */
  readonly winner: KnockoutPlayer | null;
}

export interface KnockoutMatch {
  readonly leg: number;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
}

export type KnockoutDecidedBy = "aggregate" | "extra_time" | "penalties";

export const KNOCKOUT_TIE_STATUSES = [
  "pending",
  "in_progress",
  "needs_decider",
  "completed",
] as const;
export type KnockoutTieStatus = (typeof KNOCKOUT_TIE_STATUSES)[number];

export interface KnockoutAggregate {
  readonly higherGoals: number;
  readonly lowerGoals: number;
}

export interface KnockoutDecider {
  readonly winnerUid: string;
  readonly method: Exclude<KnockoutDecidedBy, "aggregate">;
  readonly note: string | null;
  readonly penalties: { readonly higher: number; readonly lower: number } | null;
}

/** Minimal tie shape needed to resolve a stored tie from its leg matches. */
export interface ResolvableTie {
  readonly tieId: string;
  readonly legs: KnockoutLegs;
  readonly higherSeedUid: string;
  readonly lowerSeedUid: string;
}

export type TieResolution =
  | {
      readonly status: "pending" | "in_progress";
      readonly aggregate: KnockoutAggregate;
      readonly legsPlayed: number;
      readonly winnerUid: null;
      readonly decidedBy: null;
    }
  | {
      readonly status: "needs_decider";
      readonly aggregate: KnockoutAggregate;
      readonly legsPlayed: number;
      readonly winnerUid: null;
      readonly decidedBy: null;
    }
  | {
      readonly status: "completed";
      readonly aggregate: KnockoutAggregate;
      readonly legsPlayed: number;
      readonly winnerUid: string;
      readonly decidedBy: KnockoutDecidedBy;
    };

export type KnockoutValidationCode =
  | "tie-count-invalid"
  | "tie-id-duplicate"
  | "bracket-slot-invalid"
  | "legs-invalid"
  | "final-legs-invalid"
  | "self-tie"
  | "rank-invalid"
  | "participant-duplicate"
  | "participant-unknown"
  | "playoff-group-invalid"
  | "playoff-pair-invalid"
  | "r16-direct-seed-invalid"
  | "r16-opponent-invalid"
  | "r16-group-invalid"
  | "slot-reference-invalid"
  | "slot-unresolved-invalid"
  | "winner-invalid";

export interface KnockoutValidationIssue {
  readonly code: KnockoutValidationCode;
  readonly message: string;
  readonly tieId?: string;
}

export interface KnockoutValidation {
  readonly valid: boolean;
  readonly issues: readonly KnockoutValidationIssue[];
}
