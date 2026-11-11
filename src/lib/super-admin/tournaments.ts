// GCC - Super Admin tournament list and management actions.
//
// The read-only list has existed since Phase 5; Phase 8 adds the operator
// controls. Suspension hides a competition from every public surface while
// keeping all of its data; `suspendedFrom` records the exact stage so
// unsuspension restores it precisely. Ownership transfer re-snapshots the new
// owner's gamer tag and organisation name. Every action is audited with
// before/after and a required reason, and the affected organiser is notified.
import "server-only";

import { FieldValue, type DocumentSnapshot, type Query } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import type { SessionUser } from "@/lib/auth/session";
import type { GameId } from "@/lib/config/games";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { createNotifications } from "@/lib/notifications";
import { parsePageSize } from "@/lib/super-admin/query";
import { TournamentMutationError } from "@/lib/tournament/errors";
import { reasonSchema } from "@/lib/validation/super-admin";
import type { TournamentDocument, TournamentStatus } from "@/types/domain";

// ---------------------------------------------------------------------------
// Read-only list (Phase 5, kept for the console and the organiser "all" scope)
// ---------------------------------------------------------------------------

export interface TournamentListOptions {
  readonly status?: TournamentStatus | null;
  readonly search?: string | null;
  readonly after?: string | null;
  readonly before?: string | null;
  readonly pageSize?: number;
}

export interface TournamentListRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly gameId: GameId;
  readonly status: TournamentStatus;
  readonly ownerUid: string;
  readonly ownerTag: string;
  readonly organisationName: string;
  readonly registrationCount: number;
  readonly maxParticipants: number;
  readonly startsAt: Date | null;
  readonly createdAt: Date | null;
}

export interface TournamentListResult {
  readonly rows: readonly TournamentListRow[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly firstId: string | null;
  readonly lastId: string | null;
}

function toRow(id: string, data: TournamentDocument): TournamentListRow {
  return {
    id,
    name: data.name,
    slug: data.slug,
    gameId: data.gameId,
    status: data.status,
    ownerUid: data.ownerUid,
    ownerTag: data.ownerTag ?? "",
    organisationName: data.organisationName ?? "",
    registrationCount: data.registrationCount ?? 0,
    maxParticipants: data.maxParticipants ?? 0,
    startsAt: data.startsAt?.toDate?.() ?? null,
    createdAt: data.createdAt?.toDate?.() ?? null,
  };
}

async function cursorSnapshot(id: string | null | undefined): Promise<DocumentSnapshot | null> {
  if (!id) return null;
  const snapshot = await getFirebaseAdminFirestore().doc(paths.tournament(id)).get();
  return snapshot.exists ? snapshot : null;
}

export async function listTournaments(
  options: TournamentListOptions,
): Promise<TournamentListResult> {
  const firestore = getFirebaseAdminFirestore();
  const collection = firestore.collection(paths.tournaments());
  const pageSize = parsePageSize(String(options.pageSize ?? ""));
  const search = options.search?.trim().toLowerCase() ?? "";
  let filtered: Query = collection;

  if (options.status) filtered = filtered.where("status", "==", options.status);

  if (search.length > 0) {
    filtered = filtered
      .where("nameLower", ">=", search)
      .where("nameLower", "<=", `${search}\uf8ff`)
      .orderBy("nameLower", "asc");
  } else {
    filtered = filtered.orderBy("createdAt", "desc");
  }

  let query = filtered;
  const afterSnapshot = await cursorSnapshot(options.after);
  if (afterSnapshot) query = query.startAfter(afterSnapshot);

  const beforeSnapshot = await cursorSnapshot(options.before);
  if (beforeSnapshot) query = query.endBefore(beforeSnapshot);

  const [snapshot, countSnapshot] = await Promise.all([
    query.limit(pageSize + 1).get(),
    filtered.count().get(),
  ]);
  const docs = snapshot.docs.slice(0, pageSize);

  return {
    rows: docs.map((document) => toRow(document.id, document.data() as TournamentDocument)),
    total: countSnapshot.data().count,
    hasMore: snapshot.docs.length > pageSize,
    firstId: docs[0]?.id ?? null,
    lastId: docs[docs.length - 1]?.id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Management actions (Phase 8)
// ---------------------------------------------------------------------------

function parseReason(raw: unknown): string {
  const parsed = reasonSchema.safeParse(raw);

  if (!parsed.success) {
    throw new TournamentMutationError(parsed.error.issues[0]?.message ?? "Give a reason.", 400, {
      reason: "Give a reason of 5-300 characters.",
    });
  }

  return parsed.data;
}

async function notify(uid: string, title: string, body: string, link: string): Promise<void> {
  await createNotifications([uid], { type: "tournament", title, body, link }).catch(
    () => undefined,
  );
}

/**
 * Suspends a competition. Only live stages can be suspended — completed,
 * archived and cancelled competitions are terminal and a suspended competition
 * cannot be suspended again. The prior stage is stored on the document.
 */
export async function suspendTournament(
  actor: SessionUser,
  tournamentId: string,
  rawReason: unknown,
): Promise<void> {
  const reason = parseReason(rawReason);

  const firestore = getFirebaseAdminFirestore();
  const reference = firestore.doc(paths.tournament(tournamentId));

  const result = await firestore.runTransaction<{ tournament: TournamentDocument }>(
    async (transaction) => {
      const snapshot = await transaction.get(reference);

      if (!snapshot.exists) {
        throw new TournamentMutationError("Tournament not found.", 404);
      }

      const tournament = snapshot.data() as TournamentDocument;

      if (tournament.status === "suspended") {
        throw new TournamentMutationError("This competition is already suspended.", 409);
      }

      if (
        tournament.status === "cancelled" ||
        tournament.status === "completed" ||
        tournament.status === "archived"
      ) {
        throw new TournamentMutationError(
          "A finished or cancelled competition cannot be suspended.",
          409,
        );
      }

      transaction.update(reference, {
        status: "suspended",
        suspendedFrom: tournament.status,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { tournament };
    },
  );

  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "tournament.suspended",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: { status: result.tournament.status },
    after: { status: "suspended", suspendedFrom: result.tournament.status },
    reason,
  });

  await notify(
    result.tournament.ownerUid,
    `${result.tournament.name} was suspended`,
    `The platform suspended this competition pending review: ${reason}`,
    `/organiser/tournaments/${tournamentId}`,
  );
}

/** Restores a suspended competition to the exact stage it was suspended from. */
export async function unsuspendTournament(
  actor: SessionUser,
  tournamentId: string,
  rawReason: unknown,
): Promise<void> {
  const reason = parseReason(rawReason);

  const firestore = getFirebaseAdminFirestore();
  const reference = firestore.doc(paths.tournament(tournamentId));

  const result = await firestore.runTransaction<{ tournament: TournamentDocument }>(
    async (transaction) => {
      const snapshot = await transaction.get(reference);

      if (!snapshot.exists) {
        throw new TournamentMutationError("Tournament not found.", 404);
      }

      const tournament = snapshot.data() as TournamentDocument;

      if (tournament.status !== "suspended") {
        throw new TournamentMutationError("This competition is not suspended.", 409);
      }

      if (!tournament.suspendedFrom) {
        throw new TournamentMutationError(
          "The stage before suspension is not recorded. Contact the platform team.",
          409,
        );
      }

      transaction.update(reference, {
        status: tournament.suspendedFrom,
        suspendedFrom: null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { tournament };
    },
  );

  const restored = result.tournament.suspendedFrom as string;

  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "tournament.suspended",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: { status: "suspended", suspendedFrom: restored },
    after: { status: restored, suspendedFrom: null },
    reason,
  });

  await notify(
    result.tournament.ownerUid,
    `${result.tournament.name} was restored`,
    `The platform restored this competition to its previous stage: ${reason}`,
    `/organiser/tournaments/${tournamentId}`,
  );
}

/**
 * Transfers ownership to another verified organiser. The new owner's gamer tag
 * and organisation name are re-snapshotted onto the tournament document so
 * public surfaces never need a join. The authoritative role is the Firebase
 * custom claim, checked server-side with the Admin SDK.
 */
export async function transferTournamentOwnership(
  actor: SessionUser,
  tournamentId: string,
  newOwnerUid: string,
  rawReason: unknown,
): Promise<void> {
  const reason = parseReason(rawReason);

  const auth = await getFirebaseAdminAuth()
    .getUser(newOwnerUid)
    .catch(() => null);
  const claimedRole = auth?.customClaims?.role;

  if (claimedRole !== "organiser" && claimedRole !== "super_admin") {
    throw new TournamentMutationError("That user is not an organiser.", 409, {
      uid: "Choose a user with the organiser role.",
    });
  }

  const firestore = getFirebaseAdminFirestore();
  const reference = firestore.doc(paths.tournament(tournamentId));

  const result = await firestore.runTransaction<{
    tournament: TournamentDocument;
    newOwnerTag: string;
    newOrganisationName: string;
  }>(async (transaction) => {
    const snapshot = await transaction.get(reference);

    if (!snapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = snapshot.data() as TournamentDocument;

    if (tournament.ownerUid === newOwnerUid) {
      throw new TournamentMutationError("That organiser already owns this competition.", 409, {
        uid: "Choose a different organiser.",
      });
    }

    const userSnapshot = await transaction.get(firestore.doc(paths.user(newOwnerUid)));
    const newOwnerTag =
      typeof userSnapshot.data()?.gamerTag === "string"
        ? (userSnapshot.data()?.gamerTag as string)
        : "";
    const profileSnapshot = await transaction.get(
      firestore.doc(paths.organiserProfile(newOwnerUid)),
    );
    const newOrganisationName =
      typeof profileSnapshot.data()?.organisationName === "string"
        ? (profileSnapshot.data()?.organisationName as string)
        : "";

    transaction.update(reference, {
      ownerUid: newOwnerUid,
      ownerTag: newOwnerTag,
      organisationName: newOrganisationName,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { tournament, newOwnerTag, newOrganisationName };
  });

  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "tournament.ownership_transferred",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: {
      ownerUid: result.tournament.ownerUid,
      ownerTag: result.tournament.ownerTag,
      organisationName: result.tournament.organisationName,
    },
    after: {
      ownerUid: newOwnerUid,
      ownerTag: result.newOwnerTag,
      organisationName: result.newOrganisationName,
    },
    reason,
  });

  await createNotifications([result.tournament.ownerUid, newOwnerUid], {
    type: "tournament",
    title: `Ownership of ${result.tournament.name} changed`,
    body: `The platform transferred this competition to a new organiser: ${reason}`,
    link: `/organiser/tournaments/${tournamentId}`,
  }).catch(() => undefined);
}

export interface OrganiserSearchRow {
  readonly uid: string;
  readonly gamerTag: string;
  readonly organisationName: string;
}

/**
 * Organisers matching a gamer-tag prefix, for the ownership-transfer
 * combobox. The role shown here is display data; the transfer itself verifies
 * the real claim with the Admin SDK.
 */
export async function searchOrganisers(prefix: string): Promise<OrganiserSearchRow[]> {
  const term = prefix.trim().toLowerCase();

  if (term.length < 2) {
    return [];
  }

  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.users())
    .where("gamerTagLower", ">=", term)
    .where("gamerTagLower", "<=", `${term}\uf8ff`)
    .orderBy("gamerTagLower", "asc")
    .limit(40)
    .get();

  const candidates = snapshot.docs.filter((document) => {
    const role = document.data().role;
    return role === "organiser" || role === "super_admin";
  });
  const profiles = await getFirebaseAdminFirestore().getAll(
    ...candidates.map((document) =>
      getFirebaseAdminFirestore().doc(paths.organiserProfile(document.id)),
    ),
  );
  const names = new Map(profiles.map((profile) => [profile.id, profile.data()?.organisationName]));

  return candidates.map((document) => ({
    uid: document.id,
    gamerTag: typeof document.data().gamerTag === "string" ? document.data().gamerTag : "",
    organisationName:
      typeof names.get(document.id) === "string" ? (names.get(document.id) as string) : "",
  }));
}
