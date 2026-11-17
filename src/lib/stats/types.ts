// GCC - pure inputs and outputs for player statistics and Elo.
//
// Nothing in this folder touches Firebase or the framework. The server reads
// documents, maps them to these shapes, and stores the result.

import type { GameId } from "@/lib/config/games";
import type { ProfileStatTotals, StageType } from "@/types/domain";

/** One completed match, already reduced to the fields statistics need. */
export interface StatsMatch {
  readonly id: string;
  readonly tournamentId: string;
  readonly gameId: GameId;
  readonly stage: StageType;
  readonly matchday: number;
  /** 1 or 2 for knockout legs, null/omitted for league matches. */
  readonly leg?: number | null;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
}

export interface ComputedPlayerStats {
  readonly overall: ProfileStatTotals;
  readonly byGame: Readonly<Partial<Record<GameId, ProfileStatTotals>>>;
  readonly byTournament: Readonly<Record<string, ProfileStatTotals>>;
}

export interface ReplayPlayerRecord {
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
}

export interface TournamentReplay {
  readonly ratings: Readonly<Record<string, number>>;
  readonly deltas: Readonly<Record<string, number>>;
  readonly records: Readonly<Record<string, ReplayPlayerRecord>>;
  readonly appliedMatches: number;
}
