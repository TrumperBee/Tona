// GCC - tournament lifecycle actions.
//
// Every action re-verifies ownership through the shared guard, re-reads the
// document inside the transaction, checks `canTransition`, writes the change
// and appends one audit entry with before/after. Statuses never change on a
// schedule — an organiser action moves them, and the pure
// `getRegistrationState` computation decides what players see in between.
import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { requireTournamentOwnerOrSuperAdmin, type TournamentAccess } from "@/lib/auth/guards";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { createNotifications } from "@/lib/notifications";
import { TournamentMutationError } from "@/lib/tournament/errors";
import { canTransition, type TournamentDocument, type TournamentStatus } from "@/types/domain";
import { tournamentCancelReasonSchema } from "@/lib/validation/tournament";

function toDate(value: unknown): Date | null {
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

const MONTH_MS = 30.4375 * 24 * 60 * 60 * 1000;

interface StatusWrite {
  readonly before: TournamentDocument;
  readonly after: TournamentDocument;
}

/**
 * Shared transaction core: re-reads the tournament, verifies the requested
 * target is a legal transition from the CURRENT stored status and applies the
 * status write. Returns the stored and resulting documents.
 */
async function writeStatus(
  tournamentId: string,
  target: TournamentStatus,
): Promise<{ readonly access: TournamentAccess; readonly write: StatusWrite }> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const reference = firestore.doc(paths.tournament(tournamentId));

  const write = await firestore.runTransaction<StatusWrite>(async (transaction) => {
    const snapshot = await transaction.get(reference);

    if (!snapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const before = snapshot.data() as TournamentDocument;

    if (!canTransition(before.status, target)) {
      throw new TournamentMutationError(
        `This competition cannot move from "${before.status}" to "${target}".`,
        409,
      );
    }

    transaction.update(reference, {
      status: target,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { before, after: { ...before, status: target } };
  });

  return { access, write };
}

/**
 * Publishes a draft. Requires a description, rules, the full schedule, a
 * registration deadline still in the future and a start within 18 months.
 */
export async function publishTournament(tournamentId: string): Promise<void> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const reference = firestore.doc(paths.tournament(tournamentId));
  const now = new Date();

  const before = await firestore.runTransaction<TournamentDocument>(async (transaction) => {
    const snapshot = await transaction.get(reference);

    if (!snapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const current = snapshot.data() as TournamentDocument;

    if (!canTransition(current.status, "registration_open")) {
      throw new TournamentMutationError(
        `Only a draft can be published. This competition is "${current.status}".`,
        409,
      );
    }

    const fields: Record<string, string> = {};

    if (current.description.trim().length === 0) {
      fields.description = "Add a description before publishing.";
    }

    if (current.rules.trim().length === 0) {
      fields.rules = "Add the rules before publishing.";
    }

    const opensAt = toDate(current.registrationOpensAt);
    const closesAt = toDate(current.registrationClosesAt);
    const startsAt = toDate(current.startsAt);

    if (!opensAt) {
      fields.registrationOpensAt = "Set when registration opens.";
    }

    if (!closesAt) {
      fields.registrationClosesAt = "Set when registration closes.";
    }

    if (!startsAt) {
      fields.startsAt = "Set when the competition starts.";
    }

    if (closesAt && closesAt.getTime() <= now.getTime()) {
      fields.registrationClosesAt =
        "The registration deadline must be in the future when publishing.";
    }

    if (opensAt && closesAt && opensAt.getTime() >= closesAt.getTime()) {
      fields.registrationClosesAt = "Registration must close after it opens.";
    }

    if (startsAt && closesAt && startsAt.getTime() < closesAt.getTime()) {
      fields.startsAt = "The competition cannot start before registration closes.";
    }

    if (startsAt && startsAt.getTime() > now.getTime() + 18 * MONTH_MS) {
      fields.startsAt = "The competition cannot start more than 18 months from now.";
    }

    if (Object.keys(fields).length > 0) {
      throw new TournamentMutationError("The competition is not ready to publish.", 400, fields);
    }

    transaction.update(reference, {
      status: "registration_open",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return current;
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.status.set",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: { status: before.status },
    after: { status: "registration_open" },
  });
}

/** Closes registration early. The stored deadline keeps its meaning for history. */
export async function closeRegistration(tournamentId: string): Promise<void> {
  const { access, write } = await writeStatus(tournamentId, "registration_closed");

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.status.set",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: { status: write.before.status },
    after: { status: "registration_closed" },
  });
}

/**
 * Reopens registration. Only legal from `registration_closed`; once the pots
 * are confirmed the status has moved past that stage, so this is structurally
 * blocked.
 */
export async function reopenRegistration(tournamentId: string): Promise<void> {
  const { access, write } = await writeStatus(tournamentId, "registration_open");

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.status.set",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: { status: write.before.status },
    after: { status: "registration_open" },
  });
}

/**
 * Cancels a competition with a required reason and notifies every registered
 * player. Entrants keep their records; the competition leaves the public list.
 */
export async function cancelTournament(tournamentId: string, rawReason: string): Promise<void> {
  const parsed = tournamentCancelReasonSchema.safeParse(rawReason);

  if (!parsed.success) {
    throw new TournamentMutationError(
      parsed.error.issues[0]?.message ?? "Give a cancellation reason.",
      400,
      { reason: "Give a cancellation reason of at least 10 characters." },
    );
  }

  const reason = parsed.data;
  const { access, write } = await writeStatus(tournamentId, "cancelled");

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.status.set",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: { status: write.before.status },
    after: { status: "cancelled" },
    reason,
  });

  try {
    const registrations = await getFirebaseAdminFirestore()
      .collection(paths.tournamentRegistrations(tournamentId))
      .where("status", "==", "registered")
      .get();

    const uids = registrations.docs.map((document) => document.id);

    if (uids.length > 0) {
      await createNotifications(uids, {
        type: "tournament",
        title: `${write.after.name} was cancelled`,
        body: `The organiser cancelled this competition: ${reason}`,
        link: `/tournaments/${write.after.slug}`,
      });
    }
  } catch {
    // A notification failure must not unwind a completed cancellation.
  }
}

/**
 * Hard-deletes a never-published draft and releases its slug. Draft is the
 * only pre-publish status, so status `draft` is itself the proof.
 */
export async function deleteTournamentDraft(tournamentId: string): Promise<void> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const reference = firestore.doc(paths.tournament(tournamentId));

  const deleted = await firestore.runTransaction<{
    slug: string;
    name: string;
    season: string;
  }>(async (transaction) => {
    const snapshot = await transaction.get(reference);

    if (!snapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const current = snapshot.data() as TournamentDocument;

    if (current.status !== "draft") {
      throw new TournamentMutationError(
        "Only a draft that was never published can be deleted. Cancel it instead.",
        409,
      );
    }

    transaction.delete(reference);
    transaction.delete(firestore.doc(paths.tournamentSlug(current.slug)));

    return { slug: current.slug, name: current.name, season: current.season };
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.deleted",
    targetType: "tournament",
    targetId: tournamentId,
    tournamentId,
    before: { name: deleted.name, season: deleted.season, slug: deleted.slug, status: "draft" },
    after: null,
  });
}
