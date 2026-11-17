// GCC - deterministic replay of one completed tournament into Elo.
//
// Order is fixed so two servers replaying the same results reach the same
// ladder: league matches by matchday, then knockout rounds and legs, with the
// match id as the final tie-break. Goal margin is ignored by `applyElo`.

import { applyElo, DEFAULT_ELO_RATING, type EloScore } from "@/lib/stats/elo";
import type { StatsMatch, TournamentReplay } from "@/lib/stats/types";
import type { StageType } from "@/types/domain";

const STAGE_ORDER: Readonly<Record<StageType, number>> = {
  league: 0,
  playoff: 1,
  r16: 2,
  qf: 3,
  sf: 4,
  final: 5,
};

/** The one canonical match order used by every rating replay. */
export function compareStatsMatches(left: StatsMatch, right: StatsMatch): number {
  const stage = STAGE_ORDER[left.stage] - STAGE_ORDER[right.stage];

  if (stage !== 0) return stage;

  if (left.stage === "league") {
    const matchday = left.matchday - right.matchday;
    if (matchday !== 0) return matchday;
  } else {
    const leg = (left.leg ?? 1) - (right.leg ?? 1);
    if (leg !== 0) return leg;
  }

  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export interface ReplayTournamentInput {
  readonly matches: readonly StatsMatch[];
  readonly initialRatings: Readonly<Record<string, number>>;
  readonly kFactor?: number;
}

interface MutableReplayRecord {
  played: number;
  wins: number;
  draws: number;
  losses: number;
}

function emptyRecord(): MutableReplayRecord {
  return { played: 0, wins: 0, draws: 0, losses: 0 };
}

/**
 * Replays one tournament from the supplied pre-tournament ratings. Only
 * players with a match are present in the result; every other player keeps
 * their stored rating.
 */
export function replayTournament(input: ReplayTournamentInput): TournamentReplay {
  const ratings: Record<string, number> = {};
  const deltas: Record<string, number> = {};
  const records: Record<string, MutableReplayRecord> = {};
  const ordered = [...input.matches].sort(compareStatsMatches);
  let applied = 0;

  const ratingFor = (uid: string): number =>
    ratings[uid] ?? input.initialRatings[uid] ?? DEFAULT_ELO_RATING;

  for (const match of ordered) {
    if (!match.homeUid || !match.awayUid || match.homeUid === match.awayUid) {
      continue;
    }

    if (!Number.isFinite(match.homeGoals) || !Number.isFinite(match.awayGoals)) {
      continue;
    }

    const homeRating = ratingFor(match.homeUid);
    const awayRating = ratingFor(match.awayUid);
    const home = applyElo({
      rating: homeRating,
      opponentRating: awayRating,
      goalsFor: match.homeGoals,
      goalsAgainst: match.awayGoals,
      kFactor: input.kFactor,
    });
    const away = applyElo({
      rating: awayRating,
      opponentRating: homeRating,
      goalsFor: match.awayGoals,
      goalsAgainst: match.homeGoals,
      kFactor: input.kFactor,
    });

    ratings[match.homeUid] = home.rating;
    ratings[match.awayUid] = away.rating;
    records[match.homeUid] = records[match.homeUid] ?? emptyRecord();
    records[match.awayUid] = records[match.awayUid] ?? emptyRecord();

    const homeRecord = records[match.homeUid]!;
    const awayRecord = records[match.awayUid]!;
    homeRecord.played += 1;
    awayRecord.played += 1;
    tally(homeRecord, home.score);
    tally(awayRecord, away.score);
    applied += 1;
  }

  for (const uid of Object.keys(ratings)) {
    const initial = input.initialRatings[uid] ?? DEFAULT_ELO_RATING;
    deltas[uid] = (ratings[uid] ?? initial) - initial;
  }

  return { ratings, deltas, records, appliedMatches: applied };
}

function tally(record: { wins: number; draws: number; losses: number }, score: EloScore): void {
  if (score === 1) record.wins += 1;
  else if (score === 0.5) record.draws += 1;
  else record.losses += 1;
}
