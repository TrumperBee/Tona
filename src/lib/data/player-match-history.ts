// GCC - a signed-in player's cross-tournament match history.
//
// Server-only. Completed matches are read through the `matches` collection
// group, paginated ten at a time with an opaque `${tournamentId}/${matchId}`
// cursor because match document ids repeat across tournaments. The Admin SDK
// bypasses Security Rules, so tournament visibility is checked in code: a match
// is shown only while its tournament's fixtures are public.
import "server-only";

import type { DocumentSnapshot, Query } from "firebase-admin/firestore";

import { isFixturesPublicStatus } from "@/lib/data/public-fixtures";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { TournamentDocument, TournamentStatus } from "@/types/domain";

export const MATCH_HISTORY_PAGE_SIZE = 10;

export type MatchOutcome = "win" | "draw" | "loss";

export interface PlayerMatchHistoryRow {
  readonly matchId: string;
  readonly cursor: string;
  readonly tournamentId: string;
  readonly tournamentName: string;
  readonly tournamentSlug: string;
  readonly tournamentStatus: TournamentStatus;
  readonly matchday: number;
  readonly opponentUid: string;
  readonly opponentTag: string;
  readonly opponentAvatarUrl: string | null;
  readonly isHome: boolean;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly outcome: MatchOutcome;
  readonly recordedAt: string | null;
}

export interface PlayerMatchHistoryResult {
  readonly rows: readonly PlayerMatchHistoryRow[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly firstCursor: string | null;
  readonly lastCursor: string | null;
}

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

function parseCursor(value: string | null | undefined): {
  readonly tournamentId: string;
  readonly matchId: string;
} | null {
  if (!value) return null;
  const [tournamentId, matchId] = value.split("/");

  if (!tournamentId || !matchId) return null;

  return { tournamentId, matchId };
}

function historyQuery(uid: string): Query {
  return getFirebaseAdminFirestore()
    .collectionGroup("matches")
    .where("participants", "array-contains", uid)
    .where("status", "==", "completed")
    .orderBy("updatedAt", "desc");
}

async function cursorSnapshot(value: string | null | undefined): Promise<DocumentSnapshot | null> {
  const parsed = parseCursor(value);

  if (!parsed) return null;

  const snapshot = await getFirebaseAdminFirestore()
    .doc(paths.tournamentMatch(parsed.tournamentId, parsed.matchId))
    .get();

  return snapshot.exists ? snapshot : null;
}

function outcomeFor(isHome: boolean, homeGoals: number, awayGoals: number): MatchOutcome {
  const own = isHome ? homeGoals : awayGoals;
  const other = isHome ? awayGoals : homeGoals;

  if (own > other) return "win";
  if (own < other) return "loss";
  return "draw";
}

/**
 * Completed matches for one player, newest recorded first, ten per page. A
 * hidden tournament (draft, cancelled, suspended) is filtered out even though
 * the Admin SDK can read it.
 */
export async function getPlayerMatchHistory(
  uid: string,
  options: {
    readonly after?: string | null;
    readonly before?: string | null;
    readonly pageSize?: number;
  } = {},
): Promise<PlayerMatchHistoryResult> {
  if (!uid) {
    return { rows: [], total: 0, hasMore: false, firstCursor: null, lastCursor: null };
  }

  const pageSize = Math.min(
    25,
    Math.max(5, Math.trunc(options.pageSize ?? MATCH_HISTORY_PAGE_SIZE)),
  );
  const base = historyQuery(uid);
  let query: Query = base;

  const afterSnapshot = await cursorSnapshot(options.after);
  if (afterSnapshot) query = query.startAfter(afterSnapshot);

  const beforeSnapshot = await cursorSnapshot(options.before);
  if (beforeSnapshot) query = query.endBefore(beforeSnapshot);

  const pagedQuery = beforeSnapshot ? query.limitToLast(pageSize + 1) : query.limit(pageSize + 1);
  const [snapshot, countSnapshot] = await Promise.all([pagedQuery.get(), base.count().get()]);
  const rawDocs = snapshot.docs;
  const docs =
    beforeSnapshot && rawDocs.length > pageSize ? rawDocs.slice(1) : rawDocs.slice(0, pageSize);

  if (docs.length === 0) {
    return {
      rows: [],
      total: countSnapshot.data().count,
      hasMore: false,
      firstCursor: null,
      lastCursor: null,
    };
  }

  const firestore = getFirebaseAdminFirestore();
  const tournamentIds = [
    ...new Set(
      docs
        .map((document) => readText(document.data().tournamentId, ""))
        .filter((id) => id.length > 0),
    ),
  ];
  const tournamentSnapshots = await Promise.all(
    tournamentIds.map((id) => firestore.doc(paths.tournament(id)).get()),
  );
  const tournaments = new Map<string, TournamentDocument>();

  for (const tournamentSnapshot of tournamentSnapshots) {
    if (tournamentSnapshot.exists) {
      tournaments.set(tournamentSnapshot.id, tournamentSnapshot.data() as TournamentDocument);
    }
  }

  const candidateRows = docs.flatMap((document) => {
    const data = document.data();
    const tournamentId = readText(data.tournamentId, "");
    const tournament = tournaments.get(tournamentId);

    if (!tournament || !isFixturesPublicStatus(tournament.status)) {
      return [];
    }

    const homeUid = readText(data.homeUid, "");
    const awayUid = readText(data.awayUid, "");
    const isHome = homeUid === uid;

    if (!isHome && awayUid !== uid) {
      return [];
    }

    const result =
      typeof data.result === "object" && data.result !== null
        ? (data.result as Record<string, unknown>)
        : null;

    if (typeof result?.homeGoals !== "number" || typeof result?.awayGoals !== "number") {
      return [];
    }

    return [
      {
        document,
        data,
        tournament,
        tournamentId,
        isHome,
        outcome: outcomeFor(isHome, result.homeGoals, result.awayGoals),
        opponentUid: isHome ? awayUid : homeUid,
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
      },
    ];
  });

  const opponentUids = [
    ...new Set(
      candidateRows.map((row) => row.opponentUid).filter((opponentUid) => opponentUid.length > 0),
    ),
  ];
  const opponentSnapshots = await Promise.all(
    opponentUids.map((opponentUid) => firestore.doc(paths.publicProfile(opponentUid)).get()),
  );
  const opponents = new Map<string, { gamerTag: string; avatarUrl: string | null }>();

  for (const opponentSnapshot of opponentSnapshots) {
    if (!opponentSnapshot.exists) continue;
    const data = opponentSnapshot.data() ?? {};

    opponents.set(opponentSnapshot.id, {
      gamerTag: readText(data.gamerTag, "Player"),
      avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
    });
  }

  const rows = candidateRows.map((row): PlayerMatchHistoryRow => {
    const opponent = opponents.get(row.opponentUid);

    return {
      matchId: row.document.id,
      cursor: `${row.tournamentId}/${row.document.id}`,
      tournamentId: row.tournamentId,
      tournamentName: readText(row.tournament.name, "Tournament"),
      tournamentSlug: row.tournament.slug,
      tournamentStatus: row.tournament.status,
      matchday: typeof row.data.matchday === "number" ? row.data.matchday : 0,
      opponentUid: row.opponentUid,
      opponentTag:
        opponent?.gamerTag ?? readText(row.isHome ? row.data.awayTag : row.data.homeTag, "Player"),
      opponentAvatarUrl: opponent?.avatarUrl ?? null,
      isHome: row.isHome,
      homeGoals: row.homeGoals,
      awayGoals: row.awayGoals,
      outcome: row.outcome,
      recordedAt: toIsoString(row.data.updatedAt),
    };
  });

  return {
    rows,
    total: countSnapshot.data().count,
    hasMore: beforeSnapshot ? docs.length > 0 : rawDocs.length > pageSize,
    firstCursor: rows[0]?.cursor ?? null,
    lastCursor: rows[rows.length - 1]?.cursor ?? null,
  };
}
