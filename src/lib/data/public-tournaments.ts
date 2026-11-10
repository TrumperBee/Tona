// GCC - public tournament reads.
//
// Server-only. Firestore is unavailable during a fresh build or a local preview
// without credentials, so read failures degrade to an honest empty list rather
// than fake content or a crashed page.
import "server-only";

import type { Query } from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { isGameId, type GameId } from "@/lib/config/games";
import { isTournamentStatus, type TournamentStatus } from "@/types/domain";

const PUBLIC_STATUSES: readonly TournamentStatus[] = [
  "registration_open",
  "registration_closed",
  "pots_confirmed",
  "fixtures_published",
  "league_phase",
  "knockout",
  "completed",
  "archived",
  "cancelled",
];

const publicStatusSet = new Set<TournamentStatus>(PUBLIC_STATUSES);

/** True when a tournament with this status is visible to the public. */
export function isPubliclyListedStatus(status: TournamentStatus): boolean {
  return publicStatusSet.has(status);
}

export interface PublicTournamentSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly gameId: GameId;
  readonly season: string;
  readonly status: TournamentStatus;
  readonly startsAt: string | null;
  readonly registrationCount: number;
  readonly maxParticipants: number;
  readonly ownerUid: string;
}

export interface PublicTournamentDetail extends PublicTournamentSummary {
  readonly description: string;
  readonly rules: string;
  readonly formatId: string;
  readonly timezone: string;
  readonly registrationOpensAt: string | null;
  readonly registrationClosesAt: string | null;
  readonly matchDurationMinutes: number | null;
}

function toIsoString(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

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

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapSummary(id: string, data: Record<string, unknown>): PublicTournamentSummary | null {
  const { name, slug, gameId, season, status } = data;
  const resolvedGameId = typeof gameId === "string" && isGameId(gameId) ? gameId : null;

  if (
    typeof name !== "string" ||
    typeof slug !== "string" ||
    resolvedGameId === null ||
    !isTournamentStatus(status) ||
    !publicStatusSet.has(status)
  ) {
    return null;
  }

  return {
    id,
    slug,
    name,
    gameId: resolvedGameId,
    season: typeof season === "string" ? season : "",
    status,
    startsAt: toIsoString(data.startsAt),
    registrationCount: typeof data.registrationCount === "number" ? data.registrationCount : 0,
    maxParticipants: typeof data.maxParticipants === "number" ? data.maxParticipants : 36,
    ownerUid: readString(data.ownerUid),
  };
}

function mapDetail(id: string, data: Record<string, unknown>): PublicTournamentDetail | null {
  const summary = mapSummary(id, data);

  if (!summary) {
    return null;
  }

  return {
    ...summary,
    description: readString(data.description),
    rules: readString(data.rules),
    formatId: readString(data.formatId),
    timezone: typeof data.timezone === "string" ? data.timezone : "UTC",
    registrationOpensAt: toIsoString(data.registrationOpensAt),
    registrationClosesAt: toIsoString(data.registrationClosesAt),
    matchDurationMinutes: readNumber(data.matchDurationMinutes),
  };
}

/** Returns published tournaments ordered by start date. Never throws. */
export async function getPublicTournaments(limit = 12): Promise<PublicTournamentSummary[]> {
  try {
    const firestore = getFirebaseAdminFirestore();
    const snapshot = await firestore
      .collection(paths.tournaments())
      .where("status", "in", PUBLIC_STATUSES)
      .orderBy("startsAt", "asc")
      .limit(limit)
      .get();

    return snapshot.docs
      .map((document) => mapSummary(document.id, document.data()))
      .filter((tournament): tournament is PublicTournamentSummary => tournament !== null);
  } catch {
    return [];
  }
}

/**
 * Returns one published tournament by slug, or null when it does not exist,
 * is not published, or Firestore is unavailable. Never throws.
 */
export async function getPublicTournamentBySlug(
  slug: string,
): Promise<PublicTournamentDetail | null> {
  if (slug.trim().length === 0) {
    return null;
  }

  try {
    const firestore = getFirebaseAdminFirestore();
    // Equality on a single field uses the automatic index. The status filter is
    // applied in code so no additional composite index is required.
    const snapshot = await firestore
      .collection(paths.tournaments())
      .where("slug", "==", slug)
      .limit(1)
      .get();

    const document = snapshot.docs[0];

    if (!document) {
      return null;
    }

    return mapDetail(document.id, document.data());
  } catch {
    return null;
  }
}

export interface PublicTournamentPage {
  readonly rows: readonly PublicTournamentSummary[];
  readonly hasMore: boolean;
  readonly firstId: string | null;
  readonly lastId: string | null;
}

const OWNER_PAGE_SIZE = 9;

/**
 * Returns one organiser's public tournaments, newest start first, one opaque
 * forward cursor at a time (`after` is a tournament id). Never throws.
 */
export async function getPublicTournamentsByOwner(
  ownerUid: string,
  after?: string | null,
): Promise<PublicTournamentPage> {
  if (ownerUid.trim().length === 0) {
    return { rows: [], hasMore: false, firstId: null, lastId: null };
  }

  try {
    const firestore = getFirebaseAdminFirestore();
    let query: Query = firestore
      .collection(paths.tournaments())
      .where("ownerUid", "==", ownerUid)
      .where("status", "in", PUBLIC_STATUSES)
      .orderBy("startsAt", "desc");

    if (after) {
      const cursor = await firestore.doc(paths.tournament(after)).get();

      if (!cursor.exists) {
        return { rows: [], hasMore: false, firstId: null, lastId: null };
      }

      query = query.startAfter(cursor);
    }

    const snapshot = await query.limit(OWNER_PAGE_SIZE + 1).get();
    const docs = snapshot.docs.slice(0, OWNER_PAGE_SIZE);
    const rows = docs
      .map((document) => mapSummary(document.id, document.data()))
      .filter((tournament): tournament is PublicTournamentSummary => tournament !== null);

    return {
      rows,
      hasMore: snapshot.docs.length > OWNER_PAGE_SIZE,
      firstId: docs[0]?.id ?? null,
      lastId: docs[docs.length - 1]?.id ?? null,
    };
  } catch {
    return { rows: [], hasMore: false, firstId: null, lastId: null };
  }
}
