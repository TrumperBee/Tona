// GCC — self-service account deletion.
//
// Removes the Auth user and every contact/identity field the player owns, while
// deliberately preserving the sporting record. Nothing is released silently:
// gamer tags stay reserved, tournament entries stay in the field, and completed
// matches, standings and Hall of Fame snapshots keep the original gamer tag.
// Callers must already have verified a FRESH session and the same origin.
import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import {
  ACCOUNT_DELETION_BLOCK_MESSAGES,
  DELETED_PLAYER_LABEL,
  DELETED_PLAYER_TAG_LOWER,
  isActiveTournamentStatus,
  resolveDeletionEligibility,
  type ActiveTournamentRef,
} from "@/lib/account/deletion";
import { writeAuditLog } from "@/lib/audit/log";
import { isSuperAdminAccount } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/config/env.server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { destroyAvatar } from "@/lib/profile/cloudinary";
import { isUserRole, type TournamentStatus, type UserRole } from "@/types/domain";

export type AccountDeletionErrorCode = "blocked" | "not-found" | "already-deleted";

export class AccountDeletionError extends Error {
  readonly code: AccountDeletionErrorCode;
  readonly status = 403;

  constructor(code: AccountDeletionErrorCode, message: string) {
    super(message);
    this.name = "AccountDeletionError";
    this.code = code;
  }
}

export interface DeletedAccountResult {
  readonly uid: string;
  readonly previousGamerTag: string;
  readonly authUserDeleted: boolean;
  readonly avatarDeleted: boolean;
  readonly registrationsUpdated: number;
}

function readRole(value: unknown): UserRole | null {
  return isUserRole(value) ? value : null;
}

/**
 * Applies the deletion in one Firestore batch, then deletes the Auth user and
 * appends the audit entry. Avatar cleanup is best effort: the database reference
 * is always cleared, and a provider failure never blocks privacy deletion.
 */
export async function deleteOwnAccount(user: SessionUser): Promise<DeletedAccountResult> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();
  const env = getServerEnv();
  const authUser = await auth.getUser(user.userId);

  const ownedSnapshot = await firestore
    .collection(paths.tournaments())
    .where("ownerUid", "==", user.userId)
    .get();
  const activeTournaments: ActiveTournamentRef[] = ownedSnapshot.docs
    .map((document) => ({
      id: document.id,
      name: String(document.data()?.name ?? ""),
      status: document.data()?.status as TournamentStatus,
    }))
    .filter((tournament) => isActiveTournamentStatus(tournament.status));

  const eligibility = resolveDeletionEligibility({
    role: user.role,
    authRole: readRole(authUser.customClaims?.role),
    legacySuperAdminClaim: authUser.customClaims?.superAdmin !== undefined,
    pinnedSuperAdmin: isSuperAdminAccount(
      user.email,
      user.userId,
      env.SUPER_ADMIN_EMAIL,
      env.SUPER_ADMIN_UID,
    ),
    activeTournaments,
  });

  if (!eligibility.allowed) {
    throw new AccountDeletionError(
      "blocked",
      eligibility.block ? ACCOUNT_DELETION_BLOCK_MESSAGES[eligibility.block] : "Deletion blocked.",
    );
  }

  const userReference = firestore.doc(paths.user(user.userId));
  const publicReference = firestore.doc(paths.publicProfile(user.userId));
  const privateSnapshot = await userReference.get();

  if (!privateSnapshot.exists) {
    throw new AccountDeletionError("not-found", "Your profile could not be loaded.");
  }

  const privateData = privateSnapshot.data() ?? {};

  if (privateData.deleted === true) {
    throw new AccountDeletionError("already-deleted", "This account was already deleted.");
  }

  const previousGamerTag = typeof privateData.gamerTag === "string" ? privateData.gamerTag : "";
  const now = Timestamp.now();
  const batch = firestore.batch();

  // Identity and contact fields are cleared at the source. The gamer tag and
  // reservation are deliberately kept so nobody can claim the competitive
  // record or reuse the identity.
  batch.update(userReference, {
    fullName: null,
    email: null,
    whatsappE164: null,
    community: null,
    favouriteClub: null,
    photoUrl: null,
    avatarUrl: null,
    avatarPublicId: null,
    deleted: true,
    deletedAt: now,
    updatedAt: now,
  });

  // The public document becomes a display-only placeholder. Statistics and
  // history are untouched; the avatar and optional club/community text are not.
  batch.set(
    publicReference,
    {
      gamerTag: DELETED_PLAYER_LABEL,
      gamerTagLower: DELETED_PLAYER_TAG_LOWER,
      community: null,
      favouriteClub: null,
      photoUrl: null,
      avatarUrl: null,
      avatarPublicId: null,
      deleted: true,
      // Keep the public status active so the page renders the neutral
      // placeholder rather than the "Profile unavailable" notice.
      status: "active",
    },
    { merge: true },
  );

  // Entry snapshots are rewritten in place. No status, count, draw or fixture
  // changes: the organiser still sees the same slot under a neutral name.
  const membershipSnapshot = await firestore.collection(paths.userMemberships(user.userId)).get();
  const registrationSnapshots = await Promise.all(
    membershipSnapshot.docs.map((document) =>
      firestore.doc(paths.tournamentRegistration(document.id, user.userId)).get(),
    ),
  );
  let registrationsUpdated = 0;

  registrationSnapshots.forEach((snapshot) => {
    if (!snapshot.exists) {
      return;
    }

    batch.update(snapshot.ref, {
      gamerTag: DELETED_PLAYER_LABEL,
      gamerTagLower: DELETED_PLAYER_TAG_LOWER,
      avatarUrl: null,
    });
    registrationsUpdated += 1;
  });

  await batch.commit();

  let avatarDeleted = false;
  const avatarPublicId =
    typeof privateData.avatarPublicId === "string" && privateData.avatarPublicId.length > 0
      ? privateData.avatarPublicId
      : `gcc/avatars/${user.userId}`;

  if (privateData.avatarUrl || privateData.avatarPublicId || privateData.photoUrl) {
    try {
      await destroyAvatar(avatarPublicId);
      avatarDeleted = true;
    } catch {
      // `destroyAvatar` already degrades gracefully; this guard keeps an
      // unexpected provider error from blocking the irreversible deletion.
      console.warn("Account deletion: Cloudinary avatar cleanup failed for", user.userId);
    }
  }

  await auth.deleteUser(user.userId);

  await writeAuditLog({
    actorUid: user.userId,
    actorRole: user.role,
    action: "user.account.deleted",
    targetType: "user",
    targetId: user.userId,
    before: {
      gamerTag: previousGamerTag,
      hadAvatar: Boolean(privateData.avatarUrl || privateData.avatarPublicId),
      activeTournaments: activeTournaments.map((tournament) => tournament.id),
    },
    after: {
      gamerTag: DELETED_PLAYER_LABEL,
      authUserDeleted: true,
      avatarDeleted,
      registrationsUpdated,
      retained: ["gamer-tag-reservation", "registrations", "history", "results", "standings"],
    },
    reason: "self-service account deletion",
  });

  return {
    uid: user.userId,
    previousGamerTag,
    authUserDeleted: true,
    avatarDeleted,
    registrationsUpdated,
  };
}
