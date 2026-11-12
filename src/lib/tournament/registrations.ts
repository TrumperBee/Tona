// GCC - player registration, withdrawal and organiser field management.
//
// Every entry decision runs inside ONE Firestore transaction that re-reads the
// tournament document: the stored status, the registration window, capacity,
// entry restrictions and the caller's existing registration are all checked
// against fresh data, so 40 concurrent registrations can only ever produce 36
// entries (the last contenders re-read a full field and are rejected).
// Notifications and audit entries are written after the commit.
import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { requireUser, requireTournamentOwnerOrSuperAdmin } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import type { PlatformId } from "@/lib/config/games";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { createNotification } from "@/lib/notifications";
import { assertPlatformWritable } from "@/lib/platform/settings";
import { TournamentMutationError } from "@/lib/tournament/errors";
import { getRegistrationState, isFieldFull } from "@/lib/tournament/registration-state";
import type { PublicProfileDocument, TournamentDocument } from "@/types/domain";
import { playerRemovalReasonSchema } from "@/lib/validation/tournament";

export interface PlayerEntrySnapshot {
  readonly gamerTag: string;
  readonly gamerTagLower: string;
  readonly country: string;
  readonly platform: PlatformId;
  readonly avatarUrl: string | null;
}

/** Reads the public profile fields a registration snapshot copies. */
export async function loadPlayerSnapshot(uid: string): Promise<PlayerEntrySnapshot> {
  const snapshot = await getFirebaseAdminFirestore().doc(paths.publicProfile(uid)).get();
  const data = snapshot.data() as Partial<PublicProfileDocument> | undefined;

  if (
    !data ||
    typeof data.gamerTag !== "string" ||
    typeof data.gamerTagLower !== "string" ||
    typeof data.country !== "string" ||
    typeof data.platform !== "string"
  ) {
    throw new TournamentMutationError("Complete your player profile before registering.", 400);
  }

  return {
    gamerTag: data.gamerTag,
    gamerTagLower: data.gamerTagLower,
    country: data.country,
    platform: data.platform,
    avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
  };
}

/** Signed-in users must have an active account to enter. */
async function requireActivePlayer(user: SessionUser): Promise<void> {
  const snapshot = await getFirebaseAdminFirestore().doc(paths.user(user.userId)).get();
  const status = snapshot.data()?.status;

  if (status !== "active") {
    throw new TournamentMutationError("Your account is not active.", 403);
  }
}

function assertEntryAllowed(
  tournament: TournamentDocument,
  player: PlayerEntrySnapshot,
  now: Date,
): void {
  const state = getRegistrationState(tournament, now);

  // Drafts and suspended competitions do not exist publicly; do not confirm
  // them through an API response either.
  if (state === "not_published" || state === "suspended") {
    throw new TournamentMutationError("Tournament not found.", 404);
  }

  if (state === "cancelled") {
    throw new TournamentMutationError("This competition was cancelled.", 409);
  }

  if (state === "closed") {
    throw new TournamentMutationError("Registration is closed for this competition.", 409);
  }

  if (state === "opens_soon") {
    throw new TournamentMutationError("Registration has not opened yet.", 409);
  }

  if (state === "full") {
    throw new TournamentMutationError("The field is full.", 409);
  }

  if (tournament.allowedPlatforms && !tournament.allowedPlatforms.includes(player.platform)) {
    throw new TournamentMutationError("This competition does not accept your platform.", 409);
  }

  if (tournament.allowedCountries && !tournament.allowedCountries.includes(player.country)) {
    throw new TournamentMutationError(
      "This competition does not accept entries from your country.",
      409,
    );
  }
}

interface ExistingRegistration {
  readonly status: string;
}

function readExistingRegistration(data: unknown): ExistingRegistration | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const status = (data as { status?: unknown }).status;
  return typeof status === "string" ? { status } : null;
}

function membershipWrite(
  tournamentId: string,
  tournament: TournamentDocument,
): Record<string, unknown> {
  return {
    tournamentId,
    slug: tournament.slug,
    name: tournament.name,
    gameId: tournament.gameId,
    status: tournament.status,
    playerStatus: "registered",
    registeredAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function registrationWrite(
  tournamentId: string,
  player: PlayerEntrySnapshot,
): Record<string, unknown> {
  return {
    tournamentId,
    gamerTag: player.gamerTag,
    gamerTagLower: player.gamerTagLower,
    country: player.country,
    avatarUrl: player.avatarUrl,
    platform: player.platform,
    status: "registered",
    registeredAt: FieldValue.serverTimestamp(),
    withdrawnAt: null,
    removedAt: null,
    removedBy: null,
  };
}

/**
 * Registers the signed-in player for a tournament. One transaction re-reads
 * the tournament, re-checks the effective state and restrictions, writes the
 * public registration snapshot, increments the count and creates the
 * membership entry. Capacity is never exceeded.
 */
export async function registerPlayer(tournamentId: string): Promise<void> {
  const user = await requireUser();
  await assertPlatformWritable(user);
  await requireActivePlayer(user);
  const player = await loadPlayerSnapshot(user.userId);

  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const registrationRef = firestore.doc(paths.tournamentRegistration(tournamentId, user.userId));
  const membershipRef = firestore.doc(paths.userMembership(user.userId, tournamentId));

  const outcome = await firestore.runTransaction<{
    tournament: TournamentDocument;
    count: number;
  }>(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;
    assertEntryAllowed(tournament, player, new Date());

    const existing = readExistingRegistration((await transaction.get(registrationRef)).data());

    if (existing?.status === "registered") {
      throw new TournamentMutationError("You are already registered.", 409);
    }

    if (existing?.status === "removed") {
      throw new TournamentMutationError(
        "You were removed from this competition by the organiser and cannot re-enter.",
        403,
      );
    }

    transaction.set(registrationRef, registrationWrite(tournamentId, player));
    transaction.update(tournamentRef, {
      registrationCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(membershipRef, membershipWrite(tournamentId, tournament), { merge: true });

    return {
      tournament,
      count: Number(tournament.registrationCount ?? 0) + 1,
    };
  });

  await writeAuditLog({
    actorUid: user.userId,
    actorRole: user.role,
    action: "tournament.registration.created",
    targetType: "registration",
    targetId: user.userId,
    tournamentId,
    before: null,
    after: { gamerTag: player.gamerTag, platform: player.platform, country: player.country },
  });

  await createNotification(user.userId, {
    type: "tournament",
    title: "Entry confirmed",
    body: `Your entry into ${outcome.tournament.name} is confirmed. Good luck!`,
    link: `/tournaments/${outcome.tournament.slug}`,
  }).catch(() => undefined);

  if (
    isFieldFull({
      registrationCount: outcome.count,
      maxParticipants: outcome.tournament.maxParticipants,
    })
  ) {
    await createNotification(outcome.tournament.ownerUid, {
      type: "tournament",
      title: "The field is full",
      body: `${outcome.tournament.name} has reached ${outcome.tournament.maxParticipants} / ${outcome.tournament.maxParticipants} registered players.`,
      link: `/organiser/tournaments/${tournamentId}/registrations`,
    }).catch(() => undefined);
  }
}

/**
 * The signed-in player withdraws their own entry. Withdrawal is possible while
 * the registration phase is still open (the status is `registration_open`,
 * which also guarantees the pots are not confirmed); a full field or a window
 * that just ended does not lock a player into their entry.
 */
export async function withdrawPlayer(tournamentId: string): Promise<void> {
  const user = await requireUser();
  await assertPlatformWritable(user);

  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const registrationRef = firestore.doc(paths.tournamentRegistration(tournamentId, user.userId));
  const membershipRef = firestore.doc(paths.userMembership(user.userId, tournamentId));

  const tournament = await firestore.runTransaction<TournamentDocument>(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const current = tournamentSnapshot.data() as TournamentDocument;
    const state = getRegistrationState(current, new Date());

    if (state === "not_published" || state === "suspended") {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    if (state === "cancelled") {
      throw new TournamentMutationError("This competition was cancelled.", 409);
    }

    if (current.status !== "registration_open") {
      throw new TournamentMutationError(
        "Entries can only be withdrawn while registration is open.",
        409,
      );
    }

    const existing = readExistingRegistration((await transaction.get(registrationRef)).data());

    if (existing?.status !== "registered") {
      throw new TournamentMutationError("You are not registered for this competition.", 409);
    }

    transaction.update(registrationRef, {
      status: "withdrawn",
      withdrawnAt: FieldValue.serverTimestamp(),
    });
    transaction.update(tournamentRef, {
      registrationCount: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(
      membershipRef,
      { playerStatus: "withdrawn", updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    return current;
  });

  await writeAuditLog({
    actorUid: user.userId,
    actorRole: user.role,
    action: "tournament.registration.withdrawn",
    targetType: "registration",
    targetId: user.userId,
    tournamentId,
    before: { status: "registered" },
    after: { status: "withdrawn" },
  });

  await createNotification(user.userId, {
    type: "tournament",
    title: "Entry withdrawn",
    body: `Your entry into ${tournament.name} was withdrawn.`,
    link: `/tournaments/${tournament.slug}`,
  }).catch(() => undefined);
}

/**
 * The organiser (or Super Admin) removes a player with a required reason.
 * Removed players cannot re-register on their own.
 */
export async function removePlayer(
  tournamentId: string,
  uid: string,
  rawReason: string,
): Promise<void> {
  const parsed = playerRemovalReasonSchema.safeParse(rawReason);

  if (!parsed.success) {
    throw new TournamentMutationError(
      parsed.error.issues[0]?.message ?? "Give a removal reason.",
      400,
      { reason: parsed.error.issues[0]?.message ?? "Give a removal reason." },
    );
  }

  const reason = parsed.data;
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);

  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const registrationRef = firestore.doc(paths.tournamentRegistration(tournamentId, uid));
  const membershipRef = firestore.doc(paths.userMembership(uid, tournamentId));

  const player = await firestore.runTransaction<{ tag: string; name: string }>(
    async (transaction) => {
      const tournamentSnapshot = await transaction.get(tournamentRef);

      if (!tournamentSnapshot.exists) {
        throw new TournamentMutationError("Tournament not found.", 404);
      }

      const tournament = tournamentSnapshot.data() as TournamentDocument;

      // Removals stop once the pots are confirmed: the field is locked from
      // `pots_confirmed` onwards, and only `registration_open` /
      // `registration_closed` precede that stage.
      if (
        tournament.status !== "registration_open" &&
        tournament.status !== "registration_closed"
      ) {
        throw new TournamentMutationError(
          "Players can only be removed while registration is open or closed before the pots are confirmed.",
          409,
        );
      }

      const registrationSnapshot = await transaction.get(registrationRef);
      const existing = readExistingRegistration(registrationSnapshot.data());

      if (existing?.status !== "registered") {
        throw new TournamentMutationError("That player is not registered.", 409);
      }

      const tag =
        typeof registrationSnapshot.data()?.gamerTag === "string"
          ? (registrationSnapshot.data()?.gamerTag as string)
          : "";

      transaction.update(registrationRef, {
        status: "removed",
        removedAt: FieldValue.serverTimestamp(),
        removedBy: access.user.userId,
      });
      transaction.update(tournamentRef, {
        registrationCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(
        membershipRef,
        { playerStatus: "removed", updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );

      return { tag, name: tournament.name };
    },
  );

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.registration.removed",
    targetType: "registration",
    targetId: uid,
    tournamentId,
    before: { status: "registered", gamerTag: player.tag },
    after: { status: "removed" },
    reason,
  });

  await createNotification(uid, {
    type: "tournament",
    title: `Removed from ${player.name}`,
    body: `The organiser removed your entry: ${reason}`,
    link: "/dashboard",
  }).catch(() => undefined);
}

/**
 * The organiser (or Super Admin) adds a player directly. The registration
 * window is ignored (the organiser may close it early), but capacity, the
 * stored status (only `registration_open` / `registration_closed`, before
 * pots) and entry restrictions still apply. Unlike a self-registration, a
 * previously withdrawn or removed player may be re-added by the organiser.
 */
export async function addPlayer(tournamentId: string, uid: string): Promise<void> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);

  const firestore = getFirebaseAdminFirestore();
  const userSnapshot = await firestore.doc(paths.user(uid)).get();

  if (!userSnapshot.exists || userSnapshot.data()?.status !== "active") {
    throw new TournamentMutationError("That player's account is not active.", 409);
  }

  const player = await loadPlayerSnapshot(uid);

  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const registrationRef = firestore.doc(paths.tournamentRegistration(tournamentId, uid));
  const membershipRef = firestore.doc(paths.userMembership(uid, tournamentId));

  const tournament = await firestore.runTransaction<TournamentDocument>(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const current = tournamentSnapshot.data() as TournamentDocument;

    if (current.status !== "registration_open" && current.status !== "registration_closed") {
      throw new TournamentMutationError(
        "Players can only be added while registration is open or closed before the pots are confirmed.",
        409,
      );
    }

    if (isFieldFull(current)) {
      throw new TournamentMutationError("The field is full.", 409);
    }

    if (current.allowedPlatforms && !current.allowedPlatforms.includes(player.platform)) {
      throw new TournamentMutationError(
        "This competition does not accept that player's platform.",
        409,
      );
    }

    if (current.allowedCountries && !current.allowedCountries.includes(player.country)) {
      throw new TournamentMutationError(
        "This competition does not accept entries from that player's country.",
        409,
      );
    }

    const existing = readExistingRegistration((await transaction.get(registrationRef)).data());

    if (existing?.status === "registered") {
      throw new TournamentMutationError("That player is already registered.", 409);
    }

    transaction.set(registrationRef, registrationWrite(tournamentId, player));
    transaction.update(tournamentRef, {
      registrationCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(membershipRef, membershipWrite(tournamentId, current), { merge: true });

    return current;
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.registration.added",
    targetType: "registration",
    targetId: uid,
    tournamentId,
    before: null,
    after: { gamerTag: player.gamerTag, platform: player.platform, country: player.country },
  });

  await createNotification(uid, {
    type: "tournament",
    title: "Added to a tournament",
    body: `The organiser entered you into ${tournament.name}. Good luck!`,
    link: `/tournaments/${tournament.slug}`,
  }).catch(() => undefined);
}
