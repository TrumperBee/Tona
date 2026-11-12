// GCC - player "Report a problem" result reports and admin resolutions.
//
// A report is a player-to-admin message, never an official result workflow.
// Only the two match participants may open one, only one open report per player
// per match is allowed, and only the tournament owner or Super Admin may resolve
// or dismiss it. Every resolution is audited and notifies the reporter.
import "server-only";

import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import {
  requireSuperAdmin,
  requireTournamentOwnerOrSuperAdmin,
  requireUser,
} from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { isFixturesPublicStatus } from "@/lib/data/public-fixtures";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { createNotification } from "@/lib/notifications";
import { TournamentMutationError } from "@/lib/tournament/errors";
import type { ResultReportResolveInput } from "@/lib/validation/match";
import type { ResultReportStatus, TournamentDocument } from "@/types/domain";

export const RESULT_REPORT_PAGE_SIZE = 20;

export interface ResultReportMatchSummary {
  readonly id: string;
  readonly matchday: number;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
  readonly status: "scheduled" | "completed";
}

export interface ResultReportRow {
  readonly id: string;
  readonly cursor?: string;
  readonly tournamentId: string;
  readonly tournamentName: string;
  readonly tournamentSlug: string;
  readonly matchId: string;
  readonly reportedBy: string;
  readonly reportedByTag: string;
  readonly reason: string;
  readonly status: ResultReportStatus;
  readonly adminNote: string | null;
  readonly resolvedBy: string | null;
  readonly resolvedAt: string | null;
  readonly createdAt: string | null;
  readonly match: ResultReportMatchSummary | null;
}

export interface ResultReportListResult {
  readonly rows: readonly ResultReportRow[];
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

function readResult(value: unknown): { homeGoals: number | null; awayGoals: number | null } {
  if (typeof value !== "object" || value === null) {
    return { homeGoals: null, awayGoals: null };
  }

  const data = value as Record<string, unknown>;

  return {
    homeGoals: typeof data.homeGoals === "number" ? data.homeGoals : null,
    awayGoals: typeof data.awayGoals === "number" ? data.awayGoals : null,
  };
}

function readMatchSummary(id: string, data: Record<string, unknown>): ResultReportMatchSummary {
  const result = readResult(data.result);

  return {
    id,
    matchday: typeof data.matchday === "number" ? data.matchday : 0,
    homeTag: readText(data.homeTag, "Player"),
    awayTag: readText(data.awayTag, "Player"),
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    status: data.status === "completed" ? "completed" : "scheduled",
  };
}

async function gamerTagFor(uid: string): Promise<string> {
  const firestore = getFirebaseAdminFirestore();
  const publicSnapshot = await firestore.doc(paths.publicProfile(uid)).get();

  if (publicSnapshot.exists) {
    return readText(publicSnapshot.data()?.gamerTag, "Player");
  }

  const userSnapshot = await firestore.doc(paths.user(uid)).get();

  return readText(userSnapshot.data()?.gamerTag, "Player");
}

/** Opens a report for one completed match the caller played in. */
export async function createResultReport(
  tournamentId: string,
  matchId: string,
  reason: string,
  user: SessionUser,
): Promise<{ readonly reportId: string }> {
  const firestore = getFirebaseAdminFirestore();
  const tournamentSnapshot = await firestore.doc(paths.tournament(tournamentId)).get();

  if (!tournamentSnapshot.exists) {
    throw new TournamentMutationError("Tournament not found.", 404);
  }

  const tournament = tournamentSnapshot.data() as TournamentDocument;

  if (!isFixturesPublicStatus(tournament.status)) {
    throw new TournamentMutationError("This tournament has no published results.", 409);
  }

  const matchSnapshot = await firestore.doc(paths.tournamentMatch(tournamentId, matchId)).get();

  if (!matchSnapshot.exists) {
    throw new TournamentMutationError("Match not found.", 404);
  }

  const match = matchSnapshot.data() ?? {};

  if (match.tournamentId !== tournamentId) {
    throw new TournamentMutationError("Match not found.", 404);
  }

  if (!Array.isArray(match.participants) || !match.participants.includes(user.userId)) {
    throw new TournamentMutationError("Only the two players in this match can report it.", 403);
  }

  if (match.status !== "completed") {
    throw new TournamentMutationError(
      "A problem can only be reported after a result is recorded.",
      409,
    );
  }

  const openReports = await firestore
    .collection(paths.tournamentResultReports(tournamentId))
    .where("matchId", "==", matchId)
    .where("reportedBy", "==", user.userId)
    .where("status", "==", "open")
    .limit(1)
    .get();

  if (!openReports.empty) {
    throw new TournamentMutationError(
      "You already have an open report for this match. Wait for the organiser to review it.",
      409,
    );
  }

  const reportedByTag = await gamerTagFor(user.userId);
  const reference = firestore.collection(paths.tournamentResultReports(tournamentId)).doc();
  const now = Timestamp.now();

  await reference.create({
    tournamentId,
    matchId,
    reportedBy: user.userId,
    reportedByTag,
    reason,
    status: "open",
    adminNote: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: now,
  });

  await writeAuditLog({
    actorUid: user.userId,
    actorRole: user.role,
    action: "result_report.created",
    targetType: "resultReport",
    targetId: reference.id,
    tournamentId,
    after: { matchId, status: "open" },
  });

  await createNotification(tournament.ownerUid, {
    type: "result_report",
    title: `Result problem reported by ${reportedByTag}`.slice(0, 120),
    body: `${reportedByTag} reported a problem with a result in ${tournament.name}: ${reason}`.slice(
      0,
      1000,
    ),
    link: `/organiser/tournaments/${tournamentId}/result-reports`,
  }).catch(() => undefined);

  return { reportId: reference.id };
}

async function matchSummaries(
  tournamentId: string,
  matchIds: readonly string[],
): Promise<Map<string, ResultReportMatchSummary>> {
  const firestore = getFirebaseAdminFirestore();
  const unique = [...new Set(matchIds)];
  const snapshots = await Promise.all(
    unique.map((matchId) => firestore.doc(paths.tournamentMatch(tournamentId, matchId)).get()),
  );
  const summaries = new Map<string, ResultReportMatchSummary>();

  unique.forEach((matchId, index) => {
    const snapshot = snapshots[index];

    if (snapshot?.exists) {
      summaries.set(matchId, readMatchSummary(matchId, snapshot.data() ?? {}));
    }
  });

  return summaries;
}

function reportRow(
  id: string,
  data: Record<string, unknown>,
  tournament: { readonly id: string; readonly name: string; readonly slug: string },
  matches: Map<string, ResultReportMatchSummary>,
): ResultReportRow {
  const matchId = readText(data.matchId, "");

  return {
    id,
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    tournamentSlug: tournament.slug,
    matchId,
    reportedBy: readText(data.reportedBy, ""),
    reportedByTag: readText(data.reportedByTag, "Player"),
    reason: readText(data.reason, ""),
    status:
      data.status === "resolved" || data.status === "dismissed"
        ? (data.status as ResultReportStatus)
        : "open",
    adminNote: typeof data.adminNote === "string" ? data.adminNote : null,
    resolvedBy: typeof data.resolvedBy === "string" ? data.resolvedBy : null,
    resolvedAt: toIsoString(data.resolvedAt),
    createdAt: toIsoString(data.createdAt),
    match: matches.get(matchId) ?? null,
  };
}

function reportStatusFilter(status: string | null | undefined): ResultReportStatus | null {
  return status === "open" || status === "resolved" || status === "dismissed" ? status : null;
}

/** Owner/Super Admin report inbox for one tournament, newest first. */
export async function listOrganiserResultReports(
  tournamentId: string,
  options: {
    readonly status?: string | null;
    readonly after?: string | null;
    readonly before?: string | null;
    readonly pageSize?: number;
  } = {},
): Promise<ResultReportListResult> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const pageSize = Math.min(25, Math.max(5, options.pageSize ?? RESULT_REPORT_PAGE_SIZE));
  const status = reportStatusFilter(options.status);
  const base = status
    ? firestore
        .collection(paths.tournamentResultReports(tournamentId))
        .where("status", "==", status)
    : firestore.collection(paths.tournamentResultReports(tournamentId));
  let query = base.orderBy("createdAt", "desc");

  if (options.after) {
    const cursor = await firestore
      .doc(paths.tournamentResultReport(tournamentId, options.after))
      .get();
    if (cursor.exists) query = query.startAfter(cursor);
  }

  if (options.before) {
    const cursor = await firestore
      .doc(paths.tournamentResultReport(tournamentId, options.before))
      .get();
    if (cursor.exists) query = query.endBefore(cursor);
  }

  const [snapshot, countSnapshot] = await Promise.all([
    query.limit(pageSize + 1).get(),
    base.count().get(),
  ]);
  const docs = snapshot.docs.slice(0, pageSize);
  const matches = await matchSummaries(
    tournamentId,
    docs.map((document) => readText(document.data().matchId, "")),
  );
  const tournament = {
    id: tournamentId,
    name: access.tournament.name,
    slug: access.tournament.slug,
  };

  return {
    rows: docs.map((document) => reportRow(document.id, document.data(), tournament, matches)),
    total: countSnapshot.data().count,
    hasMore: snapshot.docs.length > pageSize,
    firstCursor: docs[0]?.id ?? null,
    lastCursor: docs[docs.length - 1]?.id ?? null,
  };
}

function parseCrossCursor(value: string | null | undefined): {
  readonly tournamentId: string;
  readonly reportId: string;
} | null {
  if (!value) return null;
  const [tournamentId, reportId] = value.split("/");

  if (!tournamentId || !reportId) return null;

  return { tournamentId, reportId };
}

async function crossCursorSnapshot(
  value: string | null | undefined,
): Promise<DocumentSnapshot | null> {
  const parsed = parseCrossCursor(value);

  if (!parsed) return null;

  const snapshot = await getFirebaseAdminFirestore()
    .doc(paths.tournamentResultReport(parsed.tournamentId, parsed.reportId))
    .get();

  return snapshot.exists ? snapshot : null;
}

/** Super Admin oversight list across every tournament, newest first. */
export async function listAllResultReports(
  options: {
    readonly status?: string | null;
    readonly after?: string | null;
    readonly before?: string | null;
    readonly pageSize?: number;
  } = {},
): Promise<ResultReportListResult> {
  await requireSuperAdmin();
  const firestore = getFirebaseAdminFirestore();
  const pageSize = Math.min(25, Math.max(5, options.pageSize ?? RESULT_REPORT_PAGE_SIZE));
  const status = reportStatusFilter(options.status);
  const collection = firestore.collectionGroup("resultReports");
  const base = status ? collection.where("status", "==", status) : collection;
  let query = base.orderBy("createdAt", "desc");

  const after = await crossCursorSnapshot(options.after);
  if (after) query = query.startAfter(after);

  const before = await crossCursorSnapshot(options.before);
  if (before) query = query.endBefore(before);

  const [snapshot, countSnapshot] = await Promise.all([
    query.limit(pageSize + 1).get(),
    base.count().get(),
  ]);
  const docs = snapshot.docs.slice(0, pageSize);
  const tournamentIds = [
    ...new Set(
      docs
        .map((document) => {
          const data = document.data();
          return readText(data.tournamentId, document.ref.parent.parent?.id ?? "");
        })
        .filter((id) => id.length > 0),
    ),
  ];
  const tournamentSnapshots = await Promise.all(
    tournamentIds.map((id) => firestore.doc(paths.tournament(id)).get()),
  );
  const tournaments = new Map<string, TournamentDocument>();

  tournamentSnapshots.forEach((snapshot) => {
    if (snapshot.exists) {
      tournaments.set(snapshot.id, snapshot.data() as TournamentDocument);
    }
  });

  const matchGroups = new Map<string, string[]>();

  for (const document of docs) {
    const data = document.data();
    const tournamentId = readText(data.tournamentId, document.ref.parent.parent?.id ?? "");
    const matchId = readText(data.matchId, "");
    const group = matchGroups.get(tournamentId) ?? [];
    group.push(matchId);
    matchGroups.set(tournamentId, group);
  }

  const matchMaps = new Map<string, Map<string, ResultReportMatchSummary>>();

  await Promise.all(
    [...matchGroups.entries()].map(async ([tournamentId, matchIds]) => {
      matchMaps.set(tournamentId, await matchSummaries(tournamentId, matchIds));
    }),
  );

  const rows = docs.map((document) => {
    const data = document.data();
    const tournamentId = readText(data.tournamentId, document.ref.parent.parent?.id ?? "");
    const tournament = tournaments.get(tournamentId);
    const reportId = document.id;

    return {
      ...reportRow(
        reportId,
        data,
        {
          id: tournamentId,
          name: tournament?.name ?? "Unknown tournament",
          slug: tournament?.slug ?? "",
        },
        matchMaps.get(tournamentId) ?? new Map(),
      ),
      cursor: `${tournamentId}/${reportId}`,
    };
  });

  return {
    rows,
    total: countSnapshot.data().count,
    hasMore: snapshot.docs.length > pageSize,
    firstCursor: rows[0]?.cursor ?? null,
    lastCursor: rows[rows.length - 1]?.cursor ?? null,
  };
}

/** Resolves or dismisses one open report, notifies the reporter and audits it. */
export async function resolveResultReport(
  tournamentId: string,
  reportId: string,
  input: ResultReportResolveInput,
): Promise<void> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const reportRef = firestore.doc(paths.tournamentResultReport(tournamentId, reportId));
  const reportSnapshot = await reportRef.get();

  if (!reportSnapshot.exists) {
    throw new TournamentMutationError("Report not found.", 404);
  }

  const report = reportSnapshot.data() ?? {};
  const previousStatus = report.status === "open" ? "open" : String(report.status ?? "open");

  if (previousStatus !== "open") {
    throw new TournamentMutationError("That report has already been reviewed.", 409);
  }

  const now = Timestamp.now();
  await reportRef.update({
    status: input.decision,
    adminNote: input.adminNote,
    resolvedBy: access.user.userId,
    resolvedAt: now,
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: `result_report.${input.decision}`,
    targetType: "resultReport",
    targetId: reportId,
    tournamentId,
    before: { status: "open", adminNote: null },
    after: { status: input.decision, adminNote: input.adminNote },
    reason: input.adminNote,
  });

  const matchId = readText(report.matchId, "");
  const link = matchId
    ? `/tournaments/${access.tournament.slug}/matches/${matchId}`
    : `/dashboard/fixtures`;

  await createNotification(readText(report.reportedBy, ""), {
    type: "result_report",
    title:
      input.decision === "resolved"
        ? "Your result report was resolved"
        : "Your result report was dismissed",
    body: `The organiser reviewed your report in ${access.tournament.name}: ${input.adminNote}`.slice(
      0,
      1000,
    ),
    link,
  }).catch(() => undefined);
}

/** Signed-in participant entry point used by the player report route. */
export async function createResultReportForCurrentUser(
  tournamentId: string,
  matchId: string,
  reason: string,
): Promise<{ readonly reportId: string }> {
  const user = await requireUser();

  return createResultReport(tournamentId, matchId, reason, user);
}
