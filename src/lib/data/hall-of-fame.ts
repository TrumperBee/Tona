// GCC - public Hall of Fame reads.
//
// One document per completed tournament, keyed by the tournament id so a
// repeated completion job cannot create a duplicate induction.
import "server-only";

import { cachePublicData } from "@/lib/cache/public-data";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { GameId } from "@/lib/config/games";
import type {
  HallOfFameDocument,
  HallOfFamePlayerRef,
  HallOfFameStandingRow,
  HallOfFameStats,
  HallOfFameTournamentStats,
} from "@/types/domain";

export const HALL_OF_FAME_PAGE_SIZE = 10;

/** A Hall of Fame entry with the completion date serialised for rendering. */
export interface HallOfFameEntry extends Omit<HallOfFameDocument, "completedAt"> {
  readonly completedAt: string | null;
}

function readText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readDate(value: unknown): Date | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function readRef(value: unknown): HallOfFamePlayerRef | null {
  if (typeof value !== "object" || value === null) return null;
  const data = value as Record<string, unknown>;
  const uid = readText(data.uid);

  if (!uid) return null;

  return {
    uid,
    tag: readText(data.tag, "Player"),
    avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
  };
}

function readStanding(value: unknown): HallOfFameStandingRow | null {
  const ref = readRef(value);

  if (!ref) return null;

  const data = value as Record<string, unknown>;

  return {
    ...ref,
    position: readNumber(data.position),
    played: readNumber(data.played),
    wins: readNumber(data.wins),
    draws: readNumber(data.draws),
    losses: readNumber(data.losses),
    goalsFor: readNumber(data.goalsFor),
    goalsAgainst: readNumber(data.goalsAgainst),
  };
}

function readStats(value: unknown): HallOfFameStats {
  const data =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return {
    played: readNumber(data.played),
    wins: readNumber(data.wins),
    draws: readNumber(data.draws),
    losses: readNumber(data.losses),
    goalsFor: readNumber(data.goalsFor),
    goalsAgainst: readNumber(data.goalsAgainst),
  };
}

function readTournamentStats(value: unknown): HallOfFameTournamentStats {
  const data =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const scorer = readRef(
    data.topScorer && typeof data.topScorer === "object" ? data.topScorer : {},
  );
  const scorerData = (data.topScorer ?? {}) as Record<string, unknown>;
  const defence = readRef(
    data.bestDefence && typeof data.bestDefence === "object" ? data.bestDefence : {},
  );
  const defenceData = (data.bestDefence ?? {}) as Record<string, unknown>;

  return {
    matches: readNumber(data.matches),
    goals: readNumber(data.goals),
    goalsPerMatch: readNumber(data.goalsPerMatch),
    topScorer:
      scorer && readNumber(scorerData.goals) > 0
        ? { uid: scorer.uid, tag: scorer.tag, goals: readNumber(scorerData.goals) }
        : null,
    bestDefence: defence
      ? {
          uid: defence.uid,
          tag: defence.tag,
          goalsAgainst: readNumber(defenceData.goalsAgainst),
        }
      : null,
  };
}

export function mapHallOfFame(id: string, data: Record<string, unknown>): HallOfFameEntry {
  return {
    tournamentId: readText(data.tournamentId, id),
    tournamentName: readText(data.tournamentName, "Tournament"),
    slug: readText(data.slug),
    season: readText(data.season),
    gameId: (readText(data.gameId, "efootball") as GameId) ?? "efootball",
    championUid: readText(data.championUid),
    championTag: readText(data.championTag, "Champion"),
    championAvatarUrl: typeof data.championAvatarUrl === "string" ? data.championAvatarUrl : null,
    finalistUid: readText(data.finalistUid),
    finalistTag: readText(data.finalistTag, "Runner-up"),
    finalistAvatarUrl: typeof data.finalistAvatarUrl === "string" ? data.finalistAvatarUrl : null,
    semiFinalists: Array.isArray(data.semiFinalists)
      ? data.semiFinalists
          .map((entry) => readRef(entry))
          .filter((entry): entry is HallOfFamePlayerRef => entry !== null)
      : [],
    thirdPlace: readRef(data.thirdPlace),
    standings: Array.isArray(data.standings)
      ? data.standings
          .map((entry) => readStanding(entry))
          .filter((entry): entry is HallOfFameStandingRow => entry !== null)
      : [],
    stats: readStats(data.stats),
    tournamentStats: readTournamentStats(data.tournamentStats),
    completedAt: readDate(data.completedAt)?.toISOString() ?? null,
  };
}

export interface HallOfFameListPage {
  readonly entries: readonly HallOfFameEntry[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

async function listHallOfFameUncached(
  page = 1,
  pageSize = HALL_OF_FAME_PAGE_SIZE,
): Promise<HallOfFameListPage> {
  const safePage = Math.max(1, Math.trunc(page));
  const safeSize = Math.min(50, Math.max(5, pageSize));

  try {
    const collection = getFirebaseAdminFirestore().collection(paths.hallOfFame());
    const [snapshot, countSnapshot] = await Promise.all([
      collection
        .orderBy("completedAt", "desc")
        .offset((safePage - 1) * safeSize)
        .limit(safeSize)
        .get(),
      collection.count().get(),
    ]);
    const total = countSnapshot.data().count;

    return {
      entries: snapshot.docs.map((document) => mapHallOfFame(document.id, document.data())),
      total,
      page: safePage,
      pageCount: Math.max(1, Math.ceil(total / safeSize)),
    };
  } catch {
    return { entries: [], total: 0, page: safePage, pageCount: 1 };
  }
}

export const listHallOfFame = cachePublicData(listHallOfFameUncached, ["public-hall-of-fame-list"]);

async function getHallOfFameEntryUncached(tournamentId: string): Promise<HallOfFameEntry | null> {
  if (!tournamentId || tournamentId.includes("/")) return null;

  try {
    const snapshot = await getFirebaseAdminFirestore()
      .doc(paths.hallOfFameEntry(tournamentId))
      .get();

    if (!snapshot.exists) return null;

    return mapHallOfFame(snapshot.id, snapshot.data() ?? {});
  } catch {
    return null;
  }
}

export const getHallOfFameEntry = cachePublicData(getHallOfFameEntryUncached, [
  "public-hall-of-fame-entry",
]);
