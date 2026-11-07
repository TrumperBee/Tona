// GCC — competition format definitions.
//
// Formats are data, not hardcoded logic: the engine reads a format definition
// and additional formats can be added later without rewrites.
// Only the 36-team league-phase format launches with the platform.

export type QualificationDestination =
  "round-of-16" | "playoffs-seeded" | "playoffs-unseeded" | "eliminated";

export interface QualificationBand {
  readonly id: string;
  readonly label: string;
  /** 1-based, inclusive. */
  readonly fromPosition: number;
  /** 1-based, inclusive. */
  readonly toPosition: number;
  readonly destination: QualificationDestination;
}

export interface CompetitionFormat {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly kind: "league-phase-knockout";
  readonly participants: number;
  readonly pots: {
    readonly count: number;
    readonly size: number;
    /** Number of opponents drawn from each pot. */
    readonly opponentsPerPot: number;
  };
  readonly matchesPerParticipant: number;
  readonly homeMatches: number;
  readonly awayMatches: number;
  readonly matchdays: number;
  readonly totalMatches: number;
  readonly qualification: readonly QualificationBand[];
}

export const UCL_LEAGUE_PHASE_36 = {
  id: "ucl-league-phase-36",
  name: "36-Team League Phase",
  description:
    "A single 36-team league phase with four pots of nine. Every participant plays " +
    "eight different opponents (two from each pot), four at home and four away, " +
    "across eight matchdays. Positions 1–8 reach the Round of 16 directly, " +
    "9–16 and 17–24 enter the play-offs as seeded and unseeded teams, and " +
    "25–36 are eliminated.",
  kind: "league-phase-knockout",
  participants: 36,
  pots: {
    count: 4,
    size: 9,
    opponentsPerPot: 2,
  },
  matchesPerParticipant: 8,
  homeMatches: 4,
  awayMatches: 4,
  matchdays: 8,
  totalMatches: 144,
  qualification: [
    {
      id: "direct-round-of-16",
      label: "Round of 16",
      fromPosition: 1,
      toPosition: 8,
      destination: "round-of-16",
    },
    {
      id: "seeded-playoff",
      label: "Seeded play-off",
      fromPosition: 9,
      toPosition: 16,
      destination: "playoffs-seeded",
    },
    {
      id: "unseeded-playoff",
      label: "Unseeded play-off",
      fromPosition: 17,
      toPosition: 24,
      destination: "playoffs-unseeded",
    },
    {
      id: "eliminated",
      label: "Eliminated",
      fromPosition: 25,
      toPosition: 36,
      destination: "eliminated",
    },
  ],
} as const satisfies CompetitionFormat;

export type TournamentFormatId = (typeof UCL_LEAGUE_PHASE_36)["id"];

export const TOURNAMENT_FORMATS = [UCL_LEAGUE_PHASE_36] as const;

export const DEFAULT_TOURNAMENT_FORMAT_ID: TournamentFormatId = "ucl-league-phase-36";

export function getTournamentFormat(id: string): CompetitionFormat | undefined {
  return TOURNAMENT_FORMATS.find((format) => format.id === id);
}
