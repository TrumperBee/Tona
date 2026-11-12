// GCC - public tournament reads.
//
// Server-only. Firestore is unavailable during a fresh build or a local preview
// without credentials, so read failures degrade to an honest empty list rather
// than fake content or a crashed page.
//
// Cancelled competitions are excluded from every public listing. Their detail
// pages stay reachable by direct link (rendered by this server module) and show
// the cancellation notice only; Firestore rules deny client reads of cancelled
// records entirely (ADR-044).
import "server-only";

import { Timestamp, type DocumentSnapshot, type Query } from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { isGameId, type GameId } from "@/lib/config/games";
import { getRegistrationState } from "@/lib/tournament/registration-state";
import { isTournamentStatus, type DrawMethod, type TournamentStatus } from "@/types/domain";

const PUBLIC_STATUSES: readonly TournamentStatus[] = [
  "registration_open",
  "registration_closed",
  "pots_confirmed",
  "fixtures_published",
  "league_phase",
  "knockout",
  "completed",
  "archived",
];

const publicStatusSet = new Set<TournamentStatus>(PUBLIC_STATUSES);

/** True when a tournament with this status is visible to the public. */
export function isPubliclyListedStatus(status: TournamentStatus): boolean {
  return publicStatusSet.has(status);
}

/** Discovery states offered as filters on the public list. */
export const TOURNAMENT_LIST_STATES = [
  "all",
  "open",
  "upcoming",
  "in_progress",
  "completed",
] as const;
export type TournamentListState = (typeof TOURNAMENT_LIST_STATES)[number];

export function isTournamentListState(value: string): value is TournamentListState {
  return (TOURNAMENT_LIST_STATES as readonly string[]).includes(value);
}

export const TOURNAMENT_SORTS = ["closing_soonest", "newest"] as const;
export type TournamentSort = (typeof TOURNAMENT_SORTS)[number];

export function isTournamentSort(value: string): value is TournamentSort {
  return (TOURNAMENT_SORTS as readonly string[]).includes(value);
}

const STATE_STATUSES: Readonly<Record<TournamentListState, readonly TournamentStatus[]>> = {
  all: PUBLIC_STATUSES,
  open: ["registration_open"],
  upcoming: ["registration_open"],
  in_progress: [
    "registration_closed",
    "pots_confirmed",
    "fixtures_published",
    "league_phase",
    "knockout",
  ],
  completed: ["completed", "archived"],
};

export interface PublicTournamentSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly gameId: GameId;
  readonly season: string;
  readonly status: TournamentStatus;
  readonly startsAt: string | null;
  readonly registrationOpensAt: string | null;
  readonly registrationClosesAt: string | null;
  readonly registrationCount: number;
  readonly maxParticipants: number;
  readonly ownerUid: string;
  readonly organisationName: string;
  readonly coverImageUrl: string | null;
  readonly logoUrl: string | null;
}

export interface PublicTournamentDetail extends PublicTournamentSummary {
  readonly description: string;
  readonly rules: string;
  readonly formatId: string;
  readonly timezone: string;
  readonly matchDurationMinutes: number | null;
  readonly allowedPlatforms: readonly string[] | null;
  readonly allowedCountries: readonly string[] | null;
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

function readStringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") && value.length > 0
    ? value
    : null;
}

function mapSummary(id: string, data: Record<string, unknown>): PublicTournamentSummary | null {
  const { name, slug, gameId, season, status } = data;
  const resolvedGameId = typeof gameId === "string" && isGameId(gameId) ? gameId : null;

  if (
    typeof name !== "string" ||
    typeof slug !== "string" ||
    resolvedGameId === null ||
    !isTournamentStatus(status)
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
    registrationOpensAt: toIsoString(data.registrationOpensAt),
    registrationClosesAt: toIsoString(data.registrationClosesAt),
    registrationCount: typeof data.registrationCount === "number" ? data.registrationCount : 0,
    maxParticipants: typeof data.maxParticipants === "number" ? data.maxParticipants : 36,
    ownerUid: readString(data.ownerUid),
    organisationName: readString(data.organisationName),
    coverImageUrl: typeof data.coverImageUrl === "string" ? data.coverImageUrl : null,
    logoUrl: typeof data.logoUrl === "string" ? data.logoUrl : null,
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
    matchDurationMinutes: readNumber(data.matchDurationMinutes),
    allowedPlatforms: readStringArray(data.allowedPlatforms),
    allowedCountries: readStringArray(data.allowedCountries),
  };
}

export interface ListTournamentsOptions {
  readonly gameId?: GameId | null;
  readonly state?: TournamentListState;
  readonly search?: string | null;
  readonly sort?: TournamentSort;
  /** Opaque cursor: the id of the last tournament on the previous page. */
  readonly after?: string | null;
}

export interface PublicTournamentListPage {
  readonly rows: readonly PublicTournamentSummary[];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

const LIST_PAGE_SIZE = 9;
/** Wider fetch window behind the code-level state filters. */
const STATE_FILTER_BUFFER = 3;

function searchBounds(search: string): { readonly from: string; readonly to: string } | null {
  const normalized = search.trim().toLowerCase().slice(0, 80);

  if (normalized.length === 0) {
    return null;
  }

  return { from: normalized, to: `${normalized}\uf8ff` };
}

/**
 * Builds the Firestore query for one list request. When a name search is
 * active, ordering starts on `nameLower` as Firestore requires for range
 * filters, so search results are alphabetical regardless of the chosen sort.
 */
function buildListQuery(
  options: ListTournamentsOptions,
  now: Date,
): { readonly query: Query; readonly codeFiltersStates: boolean } {
  const firestore = getFirebaseAdminFirestore();
  const state = options.state ?? "all";
  const statuses = STATE_STATUSES[state];
  let query: Query = firestore.collection(paths.tournaments()).where("status", "in", statuses);

  if (options.gameId) {
    query = query.where("gameId", "==", options.gameId);
  }

  const search = options.search ? searchBounds(options.search) : null;

  if (search) {
    query = query
      .where("nameLower", ">=", search.from)
      .where("nameLower", "<", search.to)
      .orderBy("nameLower", "asc");
  } else if (options.sort === "closing_soonest") {
    query = query
      .where("registrationClosesAt", ">=", Timestamp.fromDate(now))
      .orderBy("registrationClosesAt", "asc");
  } else {
    query = query.orderBy("createdAt", "desc");
  }

  // "Open now" and "Opening soon" are effective states computed from dates and
  // counts, not stored fields, so the query fetches a wider window and the rows
  // are filtered in code.
  const codeFiltersStates = state === "open" || state === "upcoming";

  return { query, codeFiltersStates };
}

/**
 * Cursor-paginated public tournament list. Never throws; Firestore failures
 * degrade to an empty page.
 */
export async function listPublicTournaments(
  options: ListTournamentsOptions,
): Promise<PublicTournamentListPage> {
  const empty: PublicTournamentListPage = { rows: [], hasMore: false, nextCursor: null };

  try {
    const firestore = getFirebaseAdminFirestore();
    const now = new Date();
    const { query, codeFiltersStates } = buildListQuery(options, now);

    let paged = query;

    if (options.after) {
      const cursor = await firestore.doc(paths.tournament(options.after)).get();

      if (!cursor.exists) {
        return empty;
      }

      paged = paged.startAfter(cursor);
    }

    const fetchLimit = codeFiltersStates
      ? LIST_PAGE_SIZE * STATE_FILTER_BUFFER
      : LIST_PAGE_SIZE + 1;
    const snapshot = await paged.limit(fetchLimit).get();
    const docs = snapshot.docs;

    if (docs.length === 0) {
      return empty;
    }

    let candidates = docs;

    if (codeFiltersStates) {
      const wanted = options.state === "open" ? "open" : "opens_soon";
      candidates = docs.filter((document) => {
        const data = document.data();

        return (
          getRegistrationState(
            {
              status: data.status as TournamentStatus,
              registrationCount: Number(data.registrationCount ?? 0),
              maxParticipants: Number(data.maxParticipants ?? 36),
              registrationOpensAt: data.registrationOpensAt,
              registrationClosesAt: data.registrationClosesAt,
            },
            now,
          ) === wanted
        );
      });
    }

    const pageDocs = candidates.slice(0, LIST_PAGE_SIZE);
    const rows = pageDocs
      .map((document) => mapSummary(document.id, document.data()))
      .filter((tournament): tournament is PublicTournamentSummary => tournament !== null);

    // With the code-level state filters the fetch window is a buffer, not the
    // whole result, so a filled window means more rows may match further on.
    const hasMore = codeFiltersStates
      ? candidates.length > LIST_PAGE_SIZE || docs.length === fetchLimit
      : docs.length > LIST_PAGE_SIZE;
    const cursorDoc = pageDocs[pageDocs.length - 1] ?? docs[docs.length - 1];

    return {
      rows,
      hasMore,
      nextCursor: hasMore ? cursorDoc.id : null,
    };
  } catch {
    return empty;
  }
}

/**
 * Returns one tournament by slug for a public page, or null when it does not
 * exist or is not renderable. Drafts and suspended competitions 404; a
 * cancelled competition is returned so its page can show the cancellation
 * notice. Never throws.
 */
export async function getPublicTournamentBySlug(
  slug: string,
): Promise<PublicTournamentDetail | null> {
  if (slug.trim().length === 0) {
    return null;
  }

  try {
    const firestore = getFirebaseAdminFirestore();
    // Equality on a single field uses the automatic index. The status check is
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

    const status = document.data().status;

    // Drafts and suspended competitions do not exist publicly. Cancelled ones
    // stay reachable by direct link so the page can show the notice (ADR-044);
    // every other status is listed.
    if (status !== "cancelled" && !publicStatusSet.has(status as TournamentStatus)) {
      return null;
    }

    return mapDetail(document.id, document.data());
  } catch {
    return null;
  }
}

export interface PublicRegistrationRow {
  readonly uid: string;
  readonly gamerTag: string;
  readonly country: string;
  readonly avatarUrl: string | null;
  readonly platform: string;
  readonly registeredAt: string | null;
}

function mapRegistration(document: DocumentSnapshot): PublicRegistrationRow | null {
  const data = document.data();

  if (!data || typeof data.gamerTag !== "string" || data.status !== "registered") {
    return null;
  }

  return {
    uid: document.id,
    gamerTag: data.gamerTag,
    country: typeof data.country === "string" ? data.country : "",
    avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
    platform: typeof data.platform === "string" ? data.platform : "",
    registeredAt: toIsoString(data.registeredAt),
  };
}

/**
 * Confirmed participants of one tournament, earliest entry first. Capacity is
 * 36 so the read is bounded. Never throws.
 */
export async function getTournamentParticipants(
  tournamentId: string,
): Promise<PublicRegistrationRow[]> {
  try {
    const firestore = getFirebaseAdminFirestore();
    const snapshot = await firestore
      .collection(paths.tournamentRegistrations(tournamentId))
      .where("status", "==", "registered")
      .orderBy("registeredAt", "asc")
      .get();

    return snapshot.docs
      .map(mapRegistration)
      .filter((row): row is PublicRegistrationRow => row !== null);
  } catch {
    return [];
  }
}

/** The viewer's own registration row, or null. Never throws. */
export async function getViewerRegistration(
  tournamentId: string,
  uid: string,
): Promise<PublicRegistrationRow | null> {
  if (uid.trim().length === 0) {
    return null;
  }

  try {
    const firestore = getFirebaseAdminFirestore();
    const snapshot = await firestore.doc(paths.tournamentRegistration(tournamentId, uid)).get();

    return snapshot.exists ? mapRegistration(snapshot) : null;
  } catch {
    return null;
  }
}

export interface PublicDrawPlayer {
  readonly uid: string;
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
  readonly country: string;
}

export interface PublicDrawPot {
  readonly pot: "1" | "2" | "3" | "4";
  readonly players: readonly PublicDrawPlayer[];
}

export interface PublicDraw {
  readonly pots: readonly PublicDrawPot[];
  readonly method: DrawMethod;
  readonly shuffleSeed: string | null;
  readonly algorithmVersion: number;
  readonly confirmedAt: string | null;
}

const DRAW_POT_KEYS = ["1", "2", "3", "4"] as const;

function readDrawMethod(value: unknown): DrawMethod {
  return value === "shuffle" || value === "mixed" || value === "manual" ? value : "manual";
}

function readDrawSnapshotPlayers(value: unknown): PublicDrawPlayer[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const players: PublicDrawPlayer[] = [];

  for (const [uid, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const data = entry as Record<string, unknown>;

    if (typeof data.gamerTag !== "string") {
      continue;
    }

    players.push({
      uid,
      gamerTag: data.gamerTag,
      avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
      country: typeof data.country === "string" ? data.country : "",
    });
  }

  return players;
}

/**
 * The confirmed draw for a public tournament page. A draft draw is invisible:
 * this returns null until the document is confirmed and carries a timestamp.
 * Never throws.
 */
export async function getPublicDraw(tournamentId: string): Promise<PublicDraw | null> {
  try {
    const snapshot = await getFirebaseAdminFirestore()
      .doc(paths.tournamentDrawCurrent(tournamentId))
      .get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data();

    if (!data || data.status !== "confirmed" || !data.confirmedAt) {
      return null;
    }

    const playersByUid = new Map(
      readDrawSnapshotPlayers(data.playersSnapshot).map((player) => [player.uid, player]),
    );
    const potsData =
      typeof data.pots === "object" && data.pots !== null
        ? (data.pots as Record<string, unknown>)
        : {};

    const pots: PublicDrawPot[] = DRAW_POT_KEYS.map((pot) => {
      const ids = Array.isArray(potsData[pot])
        ? potsData[pot].filter((uid): uid is string => typeof uid === "string")
        : [];

      return {
        pot,
        players: ids
          .map((uid) => playersByUid.get(uid))
          .filter((player): player is PublicDrawPlayer => player !== undefined),
      };
    });

    if (pots.every((entry) => entry.players.length === 0)) {
      return null;
    }

    return {
      pots,
      method: readDrawMethod(data.method),
      shuffleSeed: typeof data.shuffleSeed === "string" ? data.shuffleSeed : null,
      algorithmVersion: typeof data.algorithmVersion === "number" ? data.algorithmVersion : 1,
      confirmedAt: toIsoString(data.confirmedAt),
    };
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
 * forward cursor at a time (`after` is a tournament id). Cancelled
 * competitions are excluded. Never throws.
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

export interface PublicTournamentSitemapEntry {
  readonly slug: string;
  readonly updatedAt: string | null;
  readonly startsAt: string | null;
}

/**
 * Slug + timestamps entries for the sitemap. Cancelled competitions are
 * excluded because they only exist as notice pages, not discoverable content.
 * Never throws.
 */
export async function listPublicTournamentSitemapEntries(
  limit = 500,
): Promise<PublicTournamentSitemapEntry[]> {
  try {
    const snapshot = await getFirebaseAdminFirestore()
      .collection(paths.tournaments())
      .where("status", "in", PUBLIC_STATUSES)
      .orderBy("updatedAt", "desc")
      .limit(Math.min(Math.max(limit, 1), 500))
      .get();

    return snapshot.docs.flatMap((document) => {
      const data = document.data();

      if (typeof data.slug !== "string" || !isTournamentStatus(data.status)) {
        return [];
      }

      return [
        {
          slug: data.slug,
          updatedAt: toIsoString(data.updatedAt),
          startsAt: toIsoString(data.startsAt),
        },
      ];
    });
  } catch {
    return [];
  }
}
