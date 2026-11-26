// GCC - server-side statistics, ratings and head-to-head reads.
//
// Every number is recomputed from completed match documents. Nothing is
// incremented in place and nothing is invented when a document is missing.
import "server-only";

import type { DocumentSnapshot } from "firebase-admin/firestore";

import { cachePublicData, withPublicInvalidation } from "@/lib/cache/public-data";
import { isFixturesPublicStatus } from "@/lib/data/public-fixtures";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { GAMES, type GameId } from "@/lib/config/games";
import { computePlayerStats } from "@/lib/stats/player-stats";
import { RATED_MATCH_THRESHOLD } from "@/lib/stats/constants";
import type { StatsMatch } from "@/lib/stats/types";
import {
  PLAYER_FINAL_STAGES,
  type PlayerFinalStage,
  type PlayerHistoryDocument,
  type ProfileStats,
  type RankingDocument,
  type TournamentDocument,
} from "@/types/domain";

/** A player appears on a ladder after this many rated matches. */
export { RATED_MATCH_THRESHOLD } from "@/lib/stats/constants";

/** The widest ladder scan used by the public rankings page. */
export const RANKINGS_SCAN_LIMIT = 500;

/** The bounded collection-group window used by head-to-head. */
export const HEAD_TO_HEAD_SCAN_LIMIT = 500;

export const RANKINGS_PAGE_SIZE = 20;

function toIsoString(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readFinalStage(value: unknown, wonTitle: boolean): PlayerFinalStage {
  if (typeof value === "string" && (PLAYER_FINAL_STAGES as readonly string[]).includes(value)) {
    return value as PlayerFinalStage;
  }

  return wonTitle ? "champion" : "league_phase";
}

function readResult(value: unknown): { homeGoals: number; awayGoals: number } | null {
  if (typeof value !== "object" || value === null) return null;
  const data = value as Record<string, unknown>;

  return typeof data.homeGoals === "number" && typeof data.awayGoals === "number"
    ? { homeGoals: data.homeGoals, awayGoals: data.awayGoals }
    : null;
}

function toStatsMatch(
  id: string,
  data: Record<string, unknown>,
  tournament: TournamentDocument,
): StatsMatch | null {
  const result = readResult(data.result);

  if (!result) return null;

  const homeUid = readText(data.homeUid, "");
  const awayUid = readText(data.awayUid, "");

  if (!homeUid || !awayUid || homeUid === awayUid) return null;

  const stage = data.stage;

  return {
    id,
    tournamentId: readText(data.tournamentId, ""),
    gameId: tournament.gameId,
    stage:
      stage === "playoff" ||
      stage === "r16" ||
      stage === "qf" ||
      stage === "sf" ||
      stage === "final"
        ? stage
        : "league",
    matchday: readNumber(data.matchday),
    leg: typeof data.leg === "number" ? data.leg : null,
    homeUid,
    awayUid,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
  };
}

/**
 * Every completed match for one player across the collection group. Matches in
 * a draft, suspended or cancelled tournament never count toward public stats.
 * The Admin SDK bypasses Security Rules, so visibility is checked here.
 */
async function readPlayerStatsMatchesUncached(uid: string): Promise<StatsMatch[]> {
  if (!uid) return [];

  const firestore = getFirebaseAdminFirestore();
  const snapshot = await firestore
    .collectionGroup("matches")
    .where("participants", "array-contains", uid)
    .where("status", "==", "completed")
    .orderBy("updatedAt", "desc")
    .limit(HEAD_TO_HEAD_SCAN_LIMIT)
    .get();
  const tournamentIds = [
    ...new Set(
      snapshot.docs
        .map((document) => readText(document.data().tournamentId, ""))
        .filter((id) => id.length > 0),
    ),
  ];
  const tournaments = new Map<string, TournamentDocument>();
  const tournamentSnapshots = await Promise.all(
    tournamentIds.map((id) => firestore.doc(paths.tournament(id)).get()),
  );

  for (const tournamentSnapshot of tournamentSnapshots) {
    if (!tournamentSnapshot.exists) continue;
    const tournament = tournamentSnapshot.data() as TournamentDocument;

    if (isFixturesPublicStatus(tournament.status)) {
      tournaments.set(tournamentSnapshot.id, tournament);
    }
  }

  return snapshot.docs.flatMap((document) => {
    const data = document.data();
    const tournament = tournaments.get(readText(data.tournamentId, ""));

    if (!tournament) return [];

    const match = toStatsMatch(document.id, data, tournament);
    return match ? [match] : [];
  });
}

export const readPlayerStatsMatches = cachePublicData(readPlayerStatsMatchesUncached, [
  "public-player-stats-matches",
]);

async function readTitleTournamentIds(uid: string): Promise<string[]> {
  if (!uid) return [];

  try {
    const snapshot = await getFirebaseAdminFirestore()
      .collection(paths.hallOfFame())
      .where("championUid", "==", uid)
      .get();

    return snapshot.docs.map((document) => readText(document.data().tournamentId, document.id));
  } catch {
    return [];
  }
}

/**
 * Reads rankings for every game in which the player has a document. Rank is
 * computed at read time so a ladder change never needs a fan-out write.
 */
export interface PlayerRatingCard {
  readonly gameId: GameId;
  readonly rating: number;
  readonly ratedMatches: number;
  readonly rank: number | null;
  readonly eligible: boolean;
}

async function getPlayerRatingCardsUncached(uid: string): Promise<PlayerRatingCard[]> {
  if (!uid) return [];

  const firestore = getFirebaseAdminFirestore();
  const records = await Promise.all(
    GAMES.map(async (game): Promise<PlayerRatingCard | null> => {
      const snapshot = await firestore.doc(paths.ranking(game.id, uid)).get();

      if (!snapshot.exists) return null;

      const data = snapshot.data() as Partial<RankingDocument>;
      const rating = readNumber(data.rating, 1000);
      const ratedMatches = readNumber(data.ratedMatches);
      const eligible = ratedMatches >= RATED_MATCH_THRESHOLD;
      let rank: number | null = null;

      if (eligible) {
        try {
          const higher = await firestore
            .collection(paths.rankingsPlayers(game.id))
            .where("rating", ">", rating)
            .count()
            .get();
          rank = higher.data().count + 1;
        } catch {
          rank = null;
        }
      }

      return { gameId: game.id, rating, ratedMatches, rank, eligible };
    }),
  );

  return records.filter((record): record is PlayerRatingCard => record !== null);
}

export const getPlayerRatingCards = cachePublicData(getPlayerRatingCardsUncached, [
  "public-player-rating-cards",
]);

/** Rebuilds and stores one public profile's statistics. */
async function refreshPlayerStatsWrite(uid: string): Promise<void> {
  if (!uid) return;

  const firestore = getFirebaseAdminFirestore();
  const profileReference = firestore.doc(paths.publicProfile(uid));
  const profileSnapshot = await profileReference.get();

  if (!profileSnapshot.exists) return;

  const [matches, titleTournamentIds] = await Promise.all([
    readPlayerStatsMatches(uid),
    readTitleTournamentIds(uid),
  ]);
  const computed = computePlayerStats(matches, uid, { titleTournamentIds });
  const stats: ProfileStats = { overall: computed.overall, byGame: computed.byGame };

  await profileReference.set({ stats }, { merge: true });
}

export const refreshPlayerStats = withPublicInvalidation(refreshPlayerStatsWrite);

/** Refreshes several players without letting one failure block the rest. */
async function refreshPlayersStatsWrite(uids: readonly string[]): Promise<void> {
  const unique = [...new Set(uids.filter((uid) => uid.length > 0))];

  await Promise.allSettled(unique.map((uid) => refreshPlayerStats(uid)));
}

export const refreshPlayersStats = withPublicInvalidation(refreshPlayersStatsWrite);

export interface PlayerHistoryRow {
  readonly tournamentId: string;
  readonly tournamentName: string;
  readonly slug: string;
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
  readonly ratingAfter: number | null;
  readonly ratingChange: number | null;
  readonly completedAt: string | null;
}

async function getPlayerHistoryUncached(
  uid: string,
  options: { readonly limit?: number } = {},
): Promise<PlayerHistoryRow[]> {
  if (!uid) return [];

  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.publicProfileHistory(uid))
    .orderBy("completedAt", "desc")
    .limit(Math.min(50, Math.max(1, options.limit ?? 25)))
    .get();

  return snapshot.docs.map((document): PlayerHistoryRow => {
    const data = document.data() as Partial<PlayerHistoryDocument>;
    const wonTitle = data.wonTitle === true;

    return {
      tournamentId: readText(data.tournamentId, document.id),
      tournamentName: readText(data.tournamentName, "Tournament"),
      slug: readText(data.slug, ""),
      season: readText(data.season, ""),
      gameId: (data.gameId ?? "efootball") as GameId,
      finalPosition: readNumber(data.finalPosition),
      finalStage: readFinalStage(data.finalStage, wonTitle),
      played: readNumber(data.played),
      wins: readNumber(data.wins),
      draws: readNumber(data.draws),
      losses: readNumber(data.losses),
      goalsFor: readNumber(data.goalsFor),
      goalsAgainst: readNumber(data.goalsAgainst),
      wonTitle,
      ratingAfter: typeof data.ratingAfter === "number" ? data.ratingAfter : null,
      ratingChange: typeof data.ratingChange === "number" ? data.ratingChange : null,
      completedAt: toIsoString(data.completedAt),
    };
  });
}

export const getPlayerHistory = cachePublicData(getPlayerHistoryUncached, [
  "public-player-history",
]);

export interface RankingRow {
  readonly uid: string;
  readonly rank: number;
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
  readonly country: string;
  readonly rating: number;
  readonly ratedMatches: number;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
}

export interface RankingsPageData {
  readonly rows: readonly RankingRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly scanned: number;
  readonly scanLimit: number;
  /** Countries present among eligible players, for the filter control. */
  readonly countries: readonly string[];
}

/**
 * The public ladder. A bounded scan ordered by rating is filtered in memory by
 * the eligibility threshold, country and gamer-tag prefix, which keeps the
 * query index-free and the page honest about its scan window.
 */
async function getRankingsUncached(options: {
  readonly gameId: GameId;
  readonly country?: string | null;
  readonly search?: string | null;
  readonly page?: number;
  readonly pageSize?: number;
}): Promise<RankingsPageData> {
  const pageSize = Math.min(50, Math.max(5, options.pageSize ?? RANKINGS_PAGE_SIZE));
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const country = (options.country ?? "").trim().toUpperCase();
  const search = (options.search ?? "").trim().toLowerCase();
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.rankingsPlayers(options.gameId))
    .orderBy("rating", "desc")
    .limit(RANKINGS_SCAN_LIMIT)
    .get();
  const eligible = snapshot.docs
    .map((document) => {
      const data = document.data() as Partial<RankingDocument>;

      return {
        uid: document.id,
        gamerTag: readText(data.gamerTag, "Player"),
        gamerTagLower: readText(data.gamerTagLower, "").toLowerCase(),
        avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
        country: readText(data.country, ""),
        rating: readNumber(data.rating, 1000),
        ratedMatches: readNumber(data.ratedMatches),
        played: readNumber(data.played),
        wins: readNumber(data.wins),
        draws: readNumber(data.draws),
        losses: readNumber(data.losses),
      };
    })
    .filter((row) => row.ratedMatches >= RATED_MATCH_THRESHOLD);
  const countries = [
    ...new Set(eligible.map((row) => row.country.toUpperCase()).filter((code) => code.length > 0)),
  ].sort((left, right) => left.localeCompare(right));
  const filtered = eligible
    .filter((row) => (country ? row.country.toUpperCase() === country : true))
    .filter((row) => (search ? row.gamerTag.toLowerCase().startsWith(search) : true));
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize).map((row, index): RankingRow => ({
    uid: row.uid,
    rank: start + index + 1,
    gamerTag: row.gamerTag,
    avatarUrl: row.avatarUrl,
    country: row.country,
    rating: row.rating,
    ratedMatches: row.ratedMatches,
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
  }));

  return {
    rows,
    total,
    page,
    pageSize,
    scanned: snapshot.size,
    scanLimit: RANKINGS_SCAN_LIMIT,
    countries,
  };
}

export const getRankings = cachePublicData(getRankingsUncached, ["public-rankings"]);

export interface HeadToHeadEncounter {
  readonly matchId: string;
  readonly tournamentId: string;
  readonly tournamentName: string;
  readonly tournamentSlug: string;
  readonly stage: string;
  readonly playedAt: string | null;
  readonly aGoals: number;
  readonly bGoals: number;
  readonly aHome: boolean;
}

export interface HeadToHeadTotals {
  readonly aWins: number;
  readonly bWins: number;
  readonly draws: number;
  readonly aGoals: number;
  readonly bGoals: number;
}

export interface HeadToHeadResult {
  readonly encounters: readonly HeadToHeadEncounter[];
  readonly totals: HeadToHeadTotals;
  readonly mostRecent: HeadToHeadEncounter | null;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly scanned: number;
}

/**
 * Encounters between two players. One player's bounded collection-group query
 * is filtered server-side for the other, so the read stays small and no broad
 * cross-tournament scan is exposed to a client.
 */
async function getHeadToHeadUncached(
  aUid: string,
  bUid: string,
  options: { readonly page?: number; readonly pageSize?: number } = {},
): Promise<HeadToHeadResult> {
  const pageSize = Math.min(50, Math.max(5, options.pageSize ?? 10));
  const page = Math.max(1, Math.trunc(options.page ?? 1));

  if (!aUid || !bUid || aUid === bUid) {
    return {
      encounters: [],
      totals: { aWins: 0, bWins: 0, draws: 0, aGoals: 0, bGoals: 0 },
      mostRecent: null,
      page,
      pageSize,
      total: 0,
      scanned: 0,
    };
  }

  const firestore = getFirebaseAdminFirestore();
  const snapshot = await firestore
    .collectionGroup("matches")
    .where("participants", "array-contains", aUid)
    .where("status", "==", "completed")
    .orderBy("updatedAt", "desc")
    .limit(HEAD_TO_HEAD_SCAN_LIMIT)
    .get();
  const pairs = snapshot.docs.filter((document) => {
    const participants = document.data().participants;

    return (
      Array.isArray(participants) && participants.includes(aUid) && participants.includes(bUid)
    );
  });
  const tournamentIds = [
    ...new Set(pairs.map((document) => readText(document.data().tournamentId, ""))),
  ];
  const tournamentSnapshots: DocumentSnapshot[] = await Promise.all(
    tournamentIds.map((id) => firestore.doc(paths.tournament(id)).get()),
  );
  const tournaments = new Map<string, TournamentDocument>();

  tournamentSnapshots.forEach((tournamentSnapshot) => {
    if (!tournamentSnapshot.exists) return;
    const tournament = tournamentSnapshot.data() as TournamentDocument;

    if (isFixturesPublicStatus(tournament.status)) {
      tournaments.set(tournamentSnapshot.id, tournament);
    }
  });

  const all = pairs.flatMap((document): HeadToHeadEncounter[] => {
    const data = document.data();
    const tournament = tournaments.get(readText(data.tournamentId, ""));
    const result = readResult(data.result);

    if (!tournament || !result) return [];

    const aHome = data.homeUid === aUid;
    const aGoals = aHome ? result.homeGoals : result.awayGoals;
    const bGoals = aHome ? result.awayGoals : result.homeGoals;

    return [
      {
        matchId: document.id,
        tournamentId: tournamentSnapshotId(tournament, data),
        tournamentName: readText(tournament.name, "Tournament"),
        tournamentSlug: tournament.slug,
        stage: readText(data.stage, "league"),
        playedAt: toIsoString(data.updatedAt),
        aGoals,
        bGoals,
        aHome,
      },
    ];
  });
  const totals = all.reduce<HeadToHeadTotals>(
    (accumulator, encounter) => ({
      aWins: accumulator.aWins + (encounter.aGoals > encounter.bGoals ? 1 : 0),
      bWins: accumulator.bWins + (encounter.bGoals > encounter.aGoals ? 1 : 0),
      draws: accumulator.draws + (encounter.aGoals === encounter.bGoals ? 1 : 0),
      aGoals: accumulator.aGoals + encounter.aGoals,
      bGoals: accumulator.bGoals + encounter.bGoals,
    }),
    { aWins: 0, bWins: 0, draws: 0, aGoals: 0, bGoals: 0 },
  );
  const start = (page - 1) * pageSize;

  return {
    encounters: all.slice(start, start + pageSize),
    totals,
    mostRecent: all[0] ?? null,
    page,
    pageSize,
    total: all.length,
    scanned: snapshot.size,
  };
}

export const getHeadToHead = cachePublicData(getHeadToHeadUncached, ["public-head-to-head"]);

function tournamentSnapshotId(
  tournament: TournamentDocument,
  data: Record<string, unknown>,
): string {
  return readText(data.tournamentId, tournament.slug);
}
