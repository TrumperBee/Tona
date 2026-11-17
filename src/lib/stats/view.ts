// GCC - map stored statistics into the profile UI view models.
//
// Pure mapping only: no Firestore and no derived arithmetic beyond converting a
// stored ratio to the same ratio the panel formats. Both the owner's profile and
// the public profile use this so the two pages cannot drift apart.
import type { GameStatsView, TournamentStatsView } from "@/components/stats/player-stats-panel";
import type { GameId } from "@/lib/config/games";
import type { PlayerFinalStage, ProfileStats } from "@/types/domain";

export interface RatingCardLike {
  readonly gameId: GameId;
  readonly rating: number;
  readonly ratedMatches: number;
  readonly rank: number | null;
  readonly eligible: boolean;
}

export interface HistoryRowLike {
  readonly tournamentId: string;
  readonly tournamentName: string;
  readonly season: string;
  readonly gameId: GameId;
  readonly finalPosition: number;
  readonly finalStage: PlayerFinalStage;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly wonTitle: boolean;
}

export function buildGameStats(
  stats: ProfileStats,
  cards: readonly RatingCardLike[],
): GameStatsView[] {
  return (Object.keys(stats.byGame) as GameId[]).flatMap((gameId) => {
    const totals = stats.byGame[gameId];

    if (!totals) return [];

    const card = cards.find((candidate) => candidate.gameId === gameId);

    return [
      {
        ...totals,
        gameId,
        rating: card?.rating ?? null,
        ratedMatches: card?.ratedMatches ?? 0,
        rank: card?.rank ?? null,
        eligible: card?.eligible ?? false,
      },
    ];
  });
}

export function buildTournamentStats(rows: readonly HistoryRowLike[]): TournamentStatsView[] {
  return rows.map((row) => ({
    tournaments: 1,
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    titles: row.wonTitle ? 1 : 0,
    winRate: row.played > 0 ? row.wins / row.played : 0,
    tournamentId: row.tournamentId,
    name: row.tournamentName,
    season: row.season,
    gameId: row.gameId,
    finalStage: row.finalStage,
    finalPosition: row.finalPosition,
    wonTitle: row.wonTitle,
  }));
}
