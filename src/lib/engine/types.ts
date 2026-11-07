// GCC — competition engine domain types.
//
// PURE TypeScript: no database imports, no framework imports, no I/O.
// These types are provisional and will be refined in Phase 10 alongside the
// fixture generator and standings calculator.
// TODO(phase 10): finalise types and add engine invariants.

export type ParticipantId = string;

export interface EngineParticipant {
  readonly id: ParticipantId;
  readonly name: string;
  /** Optional pre-draw seeding rank (1 = strongest). */
  readonly seed?: number;
}

/** 1-based pot index (1–4 for the launch format). */
export type PotIndex = number;

export interface Fixture {
  readonly id: string;
  /** 1-based matchday. */
  readonly matchday: number;
  readonly homeId: ParticipantId;
  readonly awayId: ParticipantId;
}

export interface MatchScore {
  readonly homeGoals: number;
  readonly awayGoals: number;
}

export interface ConfirmedResult extends MatchScore {
  readonly matchId: string;
  readonly confirmedAt: string;
}

export type QualificationOutcome =
  "round-of-16" | "playoffs-seeded" | "playoffs-unseeded" | "eliminated";

export interface StandingRow {
  readonly participantId: ParticipantId;
  readonly position: number;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
  readonly qualification?: QualificationOutcome;
}

export interface FixtureGenerationConstraints {
  readonly participantsPerPot: number;
  readonly opponentsPerPot: number;
  readonly homeMatches: number;
  readonly awayMatches: number;
}

export interface ValidationIssue {
  readonly code: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}
