// GCC - exact player aggregates from recorded match results.
//
// The same matches always produce the same totals. Nothing is incremented in
// place: a caller re-reads the player's completed matches and replaces the
// stored stats document with the result of this function.

import type { GameId } from "@/lib/config/games";
import type { ProfileStatTotals } from "@/types/domain";
import type { ComputedPlayerStats, StatsMatch } from "@/lib/stats/types";

interface MutableTotals {
  tournaments: Set<string>;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  titles: number;
}

function createMutable(): MutableTotals {
  return {
    tournaments: new Set<string>(),
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    titles: 0,
  };
}

function addMatch(totals: MutableTotals, match: StatsMatch, uid: string): void {
  const isHome = match.homeUid === uid;
  const own = isHome ? match.homeGoals : match.awayGoals;
  const other = isHome ? match.awayGoals : match.homeGoals;

  totals.tournaments.add(match.tournamentId);
  totals.played += 1;
  totals.goalsFor += own;
  totals.goalsAgainst += other;

  if (own > other) totals.wins += 1;
  else if (own < other) totals.losses += 1;
  else totals.draws += 1;
}

function finish(totals: MutableTotals): ProfileStatTotals {
  return {
    tournaments: totals.tournaments.size,
    played: totals.played,
    wins: totals.wins,
    draws: totals.draws,
    losses: totals.losses,
    goalsFor: totals.goalsFor,
    goalsAgainst: totals.goalsAgainst,
    titles: totals.titles,
    winRate: totals.played > 0 ? totals.wins / totals.played : 0,
  };
}

/**
 * Aggregates every match the player actually appeared in. Matches from other
 * players are ignored, and a malformed match (the player in neither side) is
 * skipped rather than guessed at.
 *
 * `titleTournamentIds` is the list of tournaments this player won, read from
 * the Hall of Fame. It is separate because a title is a competition outcome,
 * not a match statistic.
 */
export function computePlayerStats(
  matches: readonly StatsMatch[],
  uid: string,
  options: { readonly titleTournamentIds?: readonly string[] } = {},
): ComputedPlayerStats {
  const overall = createMutable();
  const byGame = new Map<GameId, MutableTotals>();
  const byTournament = new Map<string, MutableTotals>();
  const gamesByTournament = new Map<string, GameId>();

  for (const match of matches) {
    if (match.homeUid !== uid && match.awayUid !== uid) {
      continue;
    }

    addMatch(overall, match, uid);

    const game = byGame.get(match.gameId) ?? createMutable();
    addMatch(game, match, uid);
    byGame.set(match.gameId, game);

    const tournament = byTournament.get(match.tournamentId) ?? createMutable();
    addMatch(tournament, match, uid);
    byTournament.set(match.tournamentId, tournament);
    gamesByTournament.set(match.tournamentId, match.gameId);
  }

  const titles = new Set(options.titleTournamentIds ?? []);
  overall.titles = titles.size;

  for (const tournamentId of titles) {
    const gameId = gamesByTournament.get(tournamentId);

    if (gameId) {
      const game = byGame.get(gameId) ?? createMutable();
      game.titles += 1;
      byGame.set(gameId, game);
    }
  }

  const gameEntries = [...byGame.entries()].map(
    ([gameId, totals]) => [gameId, finish(totals)] as const,
  );
  const tournamentEntries = [...byTournament.entries()].map(
    ([tournamentId, totals]) => [tournamentId, finish(totals)] as const,
  );

  return {
    overall: finish(overall),
    byGame: Object.fromEntries(gameEntries) as Partial<Record<GameId, ProfileStatTotals>>,
    byTournament: Object.fromEntries(tournamentEntries),
  };
}
