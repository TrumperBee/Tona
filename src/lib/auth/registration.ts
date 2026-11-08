// GCC - atomic player registration.
//
// The Firebase Auth user must exist before Firestore documents can use its UID.
// Firestore then reserves the gamer tag, creates the private user document and
// creates the public profile in ONE transaction. If the transaction fails, the
// Auth user is deleted so a taken tag never leaves an orphan account.
import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { formatGamerTagTakenError } from "@/lib/validation/registration-messages";
import { normalizeGamerTag } from "@/lib/validation/gamer-tag";
import type { RegistrationInput } from "@/lib/validation/registration";
import { normalizeToE164 } from "@/lib/whatsapp/phone";
import { EMPTY_PROFILE_STATS } from "@/types/domain";

export type RegistrationErrorCode =
  "gamer-tag-taken" | "email-in-use" | "invalid-whatsapp" | "weak-password" | "registration-failed";

export class RegistrationError extends Error {
  readonly code: RegistrationErrorCode;

  constructor(code: RegistrationErrorCode, message: string) {
    super(message);
    this.name = "RegistrationError";
    this.code = code;
  }
}

export interface RegisteredPlayer {
  readonly uid: string;
  readonly gamerTag: string;
  readonly email: string;
}

function isFirebaseError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

/**
 * Creates a player account. Never sets a role custom claim: the session
 * exchange derives the Super Admin role from the verified email.
 */
export async function registerPlayer(input: RegistrationInput): Promise<RegisteredPlayer> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();
  const gamerTag = input.gamerTag.trim();
  const gamerTagLower = normalizeGamerTag(gamerTag);
  const whatsappE164 = normalizeToE164(input.whatsapp, input.country);

  if (input.whatsapp && !whatsappE164) {
    throw new RegistrationError(
      "invalid-whatsapp",
      "Enter a valid mobile number for the selected country.",
    );
  }

  const reservation = firestore.doc(paths.gamerTag(gamerTagLower));
  const existing = await reservation.get();

  if (existing.exists) {
    throw new RegistrationError(
      "gamer-tag-taken",
      formatGamerTagTakenError("That gamer tag is already taken."),
    );
  }

  let uid: string | null = null;

  try {
    const authUser = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: gamerTag,
      emailVerified: false,
    });
    uid = authUser.uid;

    const now = Timestamp.now();
    const userReference = firestore.doc(paths.user(uid));
    const publicReference = firestore.doc(paths.publicProfile(uid));

    await firestore.runTransaction(async (transaction) => {
      // create() fails if the reservation already exists, which makes the
      // gamer-tag race safe even when two requests pass the pre-check above.
      transaction.create(reservation, { uid, createdAt: now });

      transaction.create(userReference, {
        fullName: input.fullName.trim(),
        gamerTag,
        gamerTagLower,
        email: input.email,
        whatsappE164,
        country: input.country,
        preferredGame: input.preferredGame,
        platform: input.platform,
        community: null,
        favouriteClub: null,
        photoUrl: null,
        avatarUrl: null,
        avatarPublicId: null,
        // Display only. Authorisation reads the custom claim, not this field.
        role: "user",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      transaction.create(publicReference, {
        gamerTag,
        gamerTagLower,
        country: input.country,
        preferredGame: input.preferredGame,
        platform: input.platform,
        community: null,
        favouriteClub: null,
        photoUrl: null,
        avatarUrl: null,
        avatarPublicId: null,
        stats: EMPTY_PROFILE_STATS,
      });
    });

    return { uid, gamerTag, email: input.email };
  } catch (error) {
    if (uid) {
      try {
        await auth.deleteUser(uid);
      } catch {
        // Rollback is best effort. The reservation was never committed when
        // the transaction failed, so the tag remains available.
      }
    }

    if (error instanceof RegistrationError) {
      throw error;
    }

    if (isFirebaseError(error, "auth/email-already-exists")) {
      throw new RegistrationError("email-in-use", "An account with that email already exists.");
    }

    if (isFirebaseError(error, "auth/invalid-password")) {
      throw new RegistrationError("weak-password", "Use a stronger password.");
    }

    if (
      error instanceof Error &&
      (error.message.includes("ALREADY_EXISTS") || error.message.includes("already exists"))
    ) {
      throw new RegistrationError(
        "gamer-tag-taken",
        formatGamerTagTakenError("That gamer tag is already taken."),
      );
    }

    throw new RegistrationError(
      "registration-failed",
      "We could not create your account. Try again.",
    );
  }
}
