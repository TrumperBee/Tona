// GCC - admin result entry, correction and clearing for league matches.
//
// The tournament owner or Super Admin is the only writer. Every mutation
// re-reads the tournament and the match inside one Firestore transaction, so a
// concurrent second entry loses the conflict and is rejected rather than
// overwriting the first result. Notifications and audit entries run after the
// transaction; a notification failure never rolls a recorded result back.
import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { requireTournamentOwnerOrSuperAdmin } from "@/lib/auth/guards";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { createNotification } from "@/lib/notifications";
import {
  clearKnockoutMatchResult,
  correctKnockoutMatchResult,
  enterKnockoutMatchResult,
} from "@/lib/tournament/knockout-results";
import { TournamentMutationError } from "@/lib/tournament/errors";
import {
  isResultEntryTournamentStatus,
  planResultTransition,
  tournamentStatusAfterResultCleared,
  tournamentStatusAfterResultEntered,
} from "@/lib/tournament/result-state";
import {
  buildStandingsPlan,
  readStandingsContextInTransaction,
  stageStandingsWrites,
  standingsTournamentPatch,
} from "@/lib/tournament/standings";
import type {
  MatchResultBulkInput,
  MatchResultClearInput,
  MatchResultCorrectionInput,
  MatchResultEntryInput,
} from "@/lib/validation/match";
import type { MatchDocument, StageType, TournamentDocument } from "@/types/domain";

export interface OrganiserResultPlayer {
  readonly uid: string;
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
  readonly country: string;
}

export interface OrganiserResultMatch {
  readonly id: string;
  readonly matchday: number;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly scheduledAt: string | null;
  readonly status: "scheduled" | "completed";
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
  readonly enteredBy: string | null;
  readonly enteredByTag: string | null;
  readonly enteredAt: string | null;
  readonly lastEditedBy: string | null;
  readonly lastEditedByTag: string | null;
  readonly lastEditedAt: string | null;
  readonly editCount: number;
}

export interface OrganiserResultsView {
  readonly tournament: TournamentDocument;
  readonly matches: readonly OrganiserResultMatch[];
  readonly players: readonly OrganiserResultPlayer[];
  readonly hasResults: boolean;
}

/**
 * Standings are rebuilt inside every result transaction. This module never
 * exposes a separate "recalculate later" path for ordinary result entry, so a
 * committed result and its table can never disagree.
 */

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

interface StoredMatchResult {
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly enteredBy: string;
  readonly enteredAt: unknown;
  readonly lastEditedBy?: string;
  readonly lastEditedAt?: unknown;
  readonly editCount: number;
}

function readResult(value: unknown): StoredMatchResult | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (typeof data.homeGoals !== "number" || typeof data.awayGoals !== "number") {
    return null;
  }

  return {
    homeGoals: data.homeGoals,
    awayGoals: data.awayGoals,
    enteredBy: typeof data.enteredBy === "string" ? data.enteredBy : "",
    enteredAt:
      typeof data.enteredAt === "object" && data.enteredAt !== null
        ? data.enteredAt
        : Timestamp.now(),
    lastEditedBy: typeof data.lastEditedBy === "string" ? data.lastEditedBy : undefined,
    lastEditedAt:
      typeof data.lastEditedAt === "object" && data.lastEditedAt !== null
        ? data.lastEditedAt
        : undefined,
    editCount: typeof data.editCount === "number" ? data.editCount : 0,
  };
}

function readMatchData(data: Record<string, unknown>): {
  readonly status: "scheduled" | "completed";
  readonly stage: MatchDocument["stage"];
  readonly result: StoredMatchResult | null;
} {
  const result = readResult(data.result);

  return {
    status: data.status === "completed" ? "completed" : "scheduled",
    stage:
      data.stage === "playoff" ||
      data.stage === "r16" ||
      data.stage === "qf" ||
      data.stage === "sf" ||
      data.stage === "final"
        ? data.stage
        : "league",
    result,
  };
}

async function editorTags(
  uids: readonly string[],
  ownerUid: string,
  ownerTag: string,
): Promise<Map<string, string>> {
  const unique = [...new Set(uids.filter((uid) => uid.length > 0))];
  const firestore = getFirebaseAdminFirestore();
  const snapshots = await Promise.all(
    unique.map((uid) => firestore.doc(paths.publicProfile(uid)).get()),
  );
  const tags = new Map<string, string>();

  unique.forEach((uid, index) => {
    const snapshot = snapshots[index];
    const tag = snapshot?.exists
      ? readText(snapshot.data()?.gamerTag, uid === ownerUid ? ownerTag : "Tournament admin")
      : uid === ownerUid
        ? ownerTag
        : "Tournament admin";
    tags.set(uid, tag);
  });

  return tags;
}

/** Guarded read for the organiser results page. */
export async function getOrganiserResults(tournamentId: string): Promise<OrganiserResultsView> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const [matchesSnapshot, registrationsSnapshot] = await Promise.all([
    firestore.collection(paths.tournamentMatches(tournamentId)).get(),
    firestore
      .collection(paths.tournamentRegistrations(tournamentId))
      .where("status", "==", "registered")
      .get(),
  ]);

  const editorUids: string[] = [];

  for (const document of matchesSnapshot.docs) {
    const data = document.data();
    const result = readResult(data.result);

    if (result?.enteredBy) editorUids.push(result.enteredBy);
    if (result?.lastEditedBy) editorUids.push(result.lastEditedBy);
  }

  const tags = await editorTags(editorUids, access.tournament.ownerUid, access.tournament.ownerTag);

  const matches = matchesSnapshot.docs
    .map((document): OrganiserResultMatch => {
      const data = document.data();
      const parsed = readMatchData(data);
      const result = parsed.result;

      return {
        id: document.id,
        matchday: typeof data.matchday === "number" ? data.matchday : 0,
        homeUid: readText(data.homeUid, ""),
        awayUid: readText(data.awayUid, ""),
        homeTag: readText(data.homeTag, "Player"),
        awayTag: readText(data.awayTag, "Player"),
        scheduledAt: toIsoString(data.scheduledAt),
        status: parsed.status,
        homeGoals: result?.homeGoals ?? null,
        awayGoals: result?.awayGoals ?? null,
        enteredBy: result?.enteredBy || null,
        enteredByTag: result?.enteredBy ? (tags.get(result.enteredBy) ?? null) : null,
        enteredAt: toIsoString(result?.enteredAt),
        lastEditedBy: result?.lastEditedBy ?? null,
        lastEditedByTag: result?.lastEditedBy ? (tags.get(result.lastEditedBy) ?? null) : null,
        lastEditedAt: toIsoString(result?.lastEditedAt),
        editCount: result?.editCount ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.matchday !== b.matchday) return a.matchday - b.matchday;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  const players = registrationsSnapshot.docs
    .map((document): OrganiserResultPlayer => {
      const data = document.data();

      return {
        uid: document.id,
        gamerTag: readText(data.gamerTag, "Player"),
        avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
        country: typeof data.country === "string" ? data.country : "",
      };
    })
    .sort((a, b) => a.gamerTag.localeCompare(b.gamerTag));

  return {
    tournament: access.tournament,
    matches,
    players,
    hasResults: matches.some((match) => match.status === "completed"),
  };
}

interface MatchNotificationInput {
  readonly tournament: TournamentDocument;
  readonly match: {
    readonly id: string;
    readonly homeUid: string;
    readonly awayUid: string;
    readonly homeTag: string;
    readonly awayTag: string;
  };
  readonly scores: { readonly homeGoals: number; readonly awayGoals: number } | null;
  readonly title: (
    opponentTag: string,
    ownGoals: number | null,
    otherGoals: number | null,
  ) => string;
  readonly body: string;
}

function notifyMatchPlayers(input: MatchNotificationInput): Promise<void> {
  const link = `/tournaments/${input.tournament.slug}/matches/${input.match.id}`;

  return Promise.all([
    createNotification(input.match.homeUid, {
      type: "result",
      title: input.title(
        input.match.awayTag,
        input.scores?.homeGoals ?? null,
        input.scores?.awayGoals ?? null,
      ),
      body: input.body,
      link,
    }),
    createNotification(input.match.awayUid, {
      type: "result",
      title: input.title(
        input.match.homeTag,
        input.scores?.awayGoals ?? null,
        input.scores?.homeGoals ?? null,
      ),
      body: input.body,
      link,
    }),
  ])
    .then(() => undefined)
    .catch(() => undefined);
}

function requireResultEntryStatus(tournament: TournamentDocument): void {
  if (!isResultEntryTournamentStatus(tournament.status)) {
    throw new TournamentMutationError(
      "Results can only be recorded after fixtures are published and while the league phase is running.",
      409,
    );
  }
}

function readMatchOrThrow(
  exists: boolean,
  data: Record<string, unknown> | undefined,
  tournamentId: string,
): MatchDocument {
  if (!exists || !data || data.tournamentId !== tournamentId) {
    throw new TournamentMutationError("Match not found.", 404);
  }

  return data as unknown as MatchDocument;
}

/**
 * Reads just the stage of one match after the ownership guard. Knockout legs
 * are routed to their own transaction module so league standings are never
 * rebuilt by a knockout result.
 */
async function readMatchStage(tournamentId: string, matchId: string): Promise<StageType> {
  const firestore = getFirebaseAdminFirestore();
  const snapshot = await firestore.doc(paths.tournamentMatch(tournamentId, matchId)).get();
  const data = snapshot.data();

  if (!snapshot.exists || !data || data.tournamentId !== tournamentId) {
    throw new TournamentMutationError("Match not found.", 404);
  }

  return data.stage === "playoff" ||
    data.stage === "r16" ||
    data.stage === "qf" ||
    data.stage === "sf" ||
    data.stage === "final"
    ? data.stage
    : "league";
}

/** Records one result and moves the tournament into the league phase. */
export async function enterMatchResult(
  tournamentId: string,
  input: MatchResultEntryInput,
): Promise<void> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const stage = await readMatchStage(tournamentId, input.matchId);

  if (stage !== "league") {
    await enterKnockoutMatchResult(access, tournamentId, input);
    return;
  }

  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const matchRef = firestore.doc(paths.tournamentMatch(tournamentId, input.matchId));

  const committed = await firestore.runTransaction(async (transaction) => {
    const context = await readStandingsContextInTransaction(transaction, tournamentId);
    const tournament = context.tournament;
    requireResultEntryStatus(tournament);

    const matchDocument = context.matchDocs.find((document) => document.id === input.matchId);
    const match = readMatchOrThrow(
      Boolean(matchDocument?.exists),
      matchDocument?.data(),
      tournamentId,
    );
    const plan = planResultTransition("enter", {
      stage: match.stage,
      status: match.status,
      hasResult: match.result !== null,
    });

    if (!plan.ok) {
      throw new TournamentMutationError(plan.message, 409);
    }

    const now = Timestamp.now();
    const result = {
      homeGoals: input.homeGoals,
      awayGoals: input.awayGoals,
      enteredBy: access.user.userId,
      enteredAt: now,
      editCount: 0,
    };
    const standings = buildStandingsPlan(
      context.source,
      new Map([[input.matchId, { homeGoals: input.homeGoals, awayGoals: input.awayGoals }]]),
      now,
    );

    transaction.update(matchRef, {
      result,
      status: "completed",
      updatedAt: now,
    });
    stageStandingsWrites(transaction, tournamentId, standings);
    transaction.update(tournamentRef, {
      status: tournamentStatusAfterResultEntered(tournament.status),
      ...standingsTournamentPatch(standings),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { tournament, match };
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "match.result_entered",
    targetType: "match",
    targetId: input.matchId,
    tournamentId,
    before: { status: "scheduled", result: null },
    after: {
      status: "completed",
      result: { homeGoals: input.homeGoals, awayGoals: input.awayGoals },
      enteredBy: access.user.userId,
    },
  });

  await notifyMatchPlayers({
    tournament: committed.tournament,
    match: { ...committed.match, id: input.matchId },
    scores: { homeGoals: input.homeGoals, awayGoals: input.awayGoals },
    title: (opponentTag, ownGoals, otherGoals) =>
      `Result recorded: you vs ${opponentTag}, ${ownGoals ?? 0}-${otherGoals ?? 0}`.slice(0, 120),
    body: `The tournament admin recorded your match in ${committed.tournament.name}. Open the match to see the score.`,
  });
}

/** Records many results in one all-or-nothing transaction. */
export async function enterMatchResultsBulk(
  tournamentId: string,
  input: MatchResultBulkInput,
): Promise<{ readonly recorded: number }> {
  const ids = input.results.map((result) => result.matchId);

  if (new Set(ids).size !== ids.length) {
    throw new TournamentMutationError("Each match may appear only once in a batch.", 400);
  }

  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const stages = await Promise.all(
    ids.map(async (id) => ({ id, stage: await readMatchStage(tournamentId, id) })),
  );
  const knockout = stages.find((entry) => entry.stage !== "league");

  if (knockout) {
    throw new TournamentMutationError("Knockout results are entered one match at a time.", 409);
  }

  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const refs = ids.map((id) => firestore.doc(paths.tournamentMatch(tournamentId, id)));

  const committed = await firestore.runTransaction(async (transaction) => {
    const context = await readStandingsContextInTransaction(transaction, tournamentId);
    const tournament = context.tournament;
    requireResultEntryStatus(tournament);
    const byId = new Map(context.matchDocs.map((document) => [document.id, document] as const));
    const matches: MatchDocument[] = [];
    const pending = new Map<string, { readonly homeGoals: number; readonly awayGoals: number }>();

    for (const result of input.results) {
      const snapshot = byId.get(result.matchId);
      const match = readMatchOrThrow(Boolean(snapshot?.exists), snapshot?.data(), tournamentId);
      const plan = planResultTransition("enter", {
        stage: match.stage,
        status: match.status,
        hasResult: match.result !== null,
      });

      if (!plan.ok) {
        throw new TournamentMutationError(plan.message, 409);
      }

      matches.push(match);
      pending.set(result.matchId, {
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
      });
    }

    const now = Timestamp.now();
    const standings = buildStandingsPlan(context.source, pending, now);

    input.results.forEach((result, index) => {
      transaction.update(refs[index]!, {
        result: {
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
          enteredBy: access.user.userId,
          enteredAt: now,
          editCount: 0,
        },
        status: "completed",
        updatedAt: now,
      });
    });
    stageStandingsWrites(transaction, tournamentId, standings);
    transaction.update(tournamentRef, {
      status: tournamentStatusAfterResultEntered(tournament.status),
      ...standingsTournamentPatch(standings),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { tournament, matches };
  });

  await Promise.all(
    input.results.map((result) =>
      writeAuditLog({
        actorUid: access.user.userId,
        actorRole: access.user.role,
        action: "match.result_entered",
        targetType: "match",
        targetId: result.matchId,
        tournamentId,
        before: { status: "scheduled", result: null },
        after: {
          status: "completed",
          result: { homeGoals: result.homeGoals, awayGoals: result.awayGoals },
          enteredBy: access.user.userId,
          batch: true,
        },
      }),
    ),
  );

  // Notification batches are deliberately outside the transaction and chunked.
  for (let index = 0; index < input.results.length; index += 18) {
    const chunk = input.results.slice(index, index + 18);

    await Promise.all(
      chunk.map((result, offset) => {
        const current = committed.matches[index + offset];

        if (!current) {
          return Promise.resolve();
        }

        return notifyMatchPlayers({
          tournament: committed.tournament,
          match: {
            id: result.matchId,
            homeUid: current.homeUid,
            awayUid: current.awayUid,
            homeTag: current.homeTag,
            awayTag: current.awayTag,
          },
          scores: { homeGoals: result.homeGoals, awayGoals: result.awayGoals },
          title: (opponentTag, ownGoals, otherGoals) =>
            `Result recorded: you vs ${opponentTag}, ${ownGoals ?? 0}-${otherGoals ?? 0}`.slice(
              0,
              120,
            ),
          body: `The tournament admin recorded your match in ${committed.tournament.name}. Open the match to see the score.`,
        });
      }),
    );
  }

  return { recorded: input.results.length };
}

/** Corrects a completed result and records the reason in the audit trail. */
export async function correctMatchResult(
  tournamentId: string,
  input: MatchResultCorrectionInput,
): Promise<void> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const stage = await readMatchStage(tournamentId, input.matchId);

  if (stage !== "league") {
    await correctKnockoutMatchResult(access, tournamentId, input);
    return;
  }

  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const matchRef = firestore.doc(paths.tournamentMatch(tournamentId, input.matchId));

  const committed = await firestore.runTransaction(async (transaction) => {
    const context = await readStandingsContextInTransaction(transaction, tournamentId);
    const tournament = context.tournament;
    requireResultEntryStatus(tournament);

    const matchDocument = context.matchDocs.find((document) => document.id === input.matchId);
    const match = readMatchOrThrow(
      Boolean(matchDocument?.exists),
      matchDocument?.data(),
      tournamentId,
    );
    const plan = planResultTransition("correct", {
      stage: match.stage,
      status: match.status,
      hasResult: match.result !== null,
    });

    if (!plan.ok || !match.result) {
      throw new TournamentMutationError(plan.ok ? "No result to correct." : plan.message, 409);
    }

    const now = Timestamp.now();
    const previous = match.result;
    const result = {
      homeGoals: input.homeGoals,
      awayGoals: input.awayGoals,
      enteredBy: previous.enteredBy,
      enteredAt: previous.enteredAt,
      lastEditedBy: access.user.userId,
      lastEditedAt: now,
      editCount: previous.editCount + 1,
    };
    const standings = buildStandingsPlan(
      context.source,
      new Map([[input.matchId, { homeGoals: input.homeGoals, awayGoals: input.awayGoals }]]),
      now,
    );

    transaction.update(matchRef, { result, updatedAt: now });
    stageStandingsWrites(transaction, tournamentId, standings);
    transaction.update(tournamentRef, {
      ...standingsTournamentPatch(standings),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { tournament, match, previousResult: previous };
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "match.result_corrected",
    targetType: "match",
    targetId: input.matchId,
    tournamentId,
    before: {
      homeGoals: committed.previousResult.homeGoals,
      awayGoals: committed.previousResult.awayGoals,
      editCount: committed.previousResult.editCount,
    },
    after: {
      homeGoals: input.homeGoals,
      awayGoals: input.awayGoals,
      editCount: committed.previousResult.editCount + 1,
    },
    reason: input.reason,
  });

  await notifyMatchPlayers({
    tournament: committed.tournament,
    match: { ...committed.match, id: input.matchId },
    scores: { homeGoals: input.homeGoals, awayGoals: input.awayGoals },
    title: (opponentTag, ownGoals, otherGoals) =>
      `Result corrected: you vs ${opponentTag}, ${ownGoals ?? 0}-${otherGoals ?? 0}`.slice(0, 120),
    body: `The tournament admin corrected your match in ${committed.tournament.name}. Open the match to see the updated score.`,
  });
}

/** Clears a recorded result and returns the match to `scheduled`. */
export async function clearMatchResult(
  tournamentId: string,
  input: MatchResultClearInput,
): Promise<void> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const stage = await readMatchStage(tournamentId, input.matchId);

  if (stage !== "league") {
    await clearKnockoutMatchResult(access, tournamentId, input);
    return;
  }

  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const matchRef = firestore.doc(paths.tournamentMatch(tournamentId, input.matchId));

  const committed = await firestore.runTransaction(async (transaction) => {
    const context = await readStandingsContextInTransaction(transaction, tournamentId);
    const tournament = context.tournament;
    requireResultEntryStatus(tournament);

    const matchDocument = context.matchDocs.find((document) => document.id === input.matchId);
    const match = readMatchOrThrow(
      Boolean(matchDocument?.exists),
      matchDocument?.data(),
      tournamentId,
    );
    const plan = planResultTransition("clear", {
      stage: match.stage,
      status: match.status,
      hasResult: match.result !== null,
    });

    if (!plan.ok || !match.result) {
      throw new TournamentMutationError(plan.ok ? "No result to clear." : plan.message, 409);
    }

    const now = Timestamp.now();
    const standings = buildStandingsPlan(context.source, new Map([[input.matchId, null]]), now);
    const completed = standings.leagueMatchesCompleted;

    transaction.update(matchRef, {
      result: null,
      status: "scheduled",
      updatedAt: now,
    });
    stageStandingsWrites(transaction, tournamentId, standings);
    transaction.update(tournamentRef, {
      status: tournamentStatusAfterResultCleared(tournament.status, completed),
      ...standingsTournamentPatch(standings),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { tournament, match, previousResult: match.result, completed };
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "match.result_cleared",
    targetType: "match",
    targetId: input.matchId,
    tournamentId,
    before: {
      status: "completed",
      result: {
        homeGoals: committed.previousResult.homeGoals,
        awayGoals: committed.previousResult.awayGoals,
      },
    },
    after: {
      status: "scheduled",
      result: null,
      leagueMatchesCompleted: committed.completed,
    },
    reason: input.reason,
  });

  await notifyMatchPlayers({
    tournament: committed.tournament,
    match: { ...committed.match, id: input.matchId },
    scores: null,
    title: (opponentTag) => `Result cleared: you vs ${opponentTag}`.slice(0, 120),
    body: `The tournament admin cleared the recorded result for your match in ${committed.tournament.name}. The fixture is awaiting a new result.`,
  });
}
