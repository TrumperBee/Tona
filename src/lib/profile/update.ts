// GCC — server-side profile updates.
//
// A profile edit is one Firestore transaction over the private user document and
// the public display profile. Gamer tag, email, role, status, avatar URLs and
// statistics are never accepted here; they belong to dedicated server flows.
import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { normalizeToE164 } from "@/lib/whatsapp/phone";
import type { ProfileEditInput } from "@/lib/validation/profile";
import { EMPTY_PROFILE_STATS, type PublicProfileDocument, type UserDocument } from "@/types/domain";

export type ProfileUpdateErrorCode = "not-found" | "invalid-whatsapp";

export class ProfileUpdateError extends Error {
  readonly code: ProfileUpdateErrorCode;

  constructor(code: ProfileUpdateErrorCode, message: string) {
    super(message);
    this.name = "ProfileUpdateError";
    this.code = code;
  }
}

export interface UpdatedProfile {
  readonly fullName: string;
  readonly country: string;
  readonly community: string | null;
  readonly favouriteClub: string | null;
  readonly preferredGame: UserDocument["preferredGame"];
  readonly platform: UserDocument["platform"];
}

/** Applies a strict, partial profile edit to both documents atomically. */
export async function updatePlayerProfile(
  uid: string,
  input: ProfileEditInput,
): Promise<UpdatedProfile> {
  const firestore = getFirebaseAdminFirestore();
  const userReference = firestore.doc(paths.user(uid));
  const publicReference = firestore.doc(paths.publicProfile(uid));

  return firestore.runTransaction(async (transaction) => {
    const [userSnapshot, publicSnapshot] = await Promise.all([
      transaction.get(userReference),
      transaction.get(publicReference),
    ]);

    if (!userSnapshot.exists) {
      throw new ProfileUpdateError("not-found", "Your profile could not be loaded.");
    }

    const current = userSnapshot.data() as UserDocument;
    const currentPublic = publicSnapshot.exists
      ? (publicSnapshot.data() as Partial<PublicProfileDocument>)
      : null;
    const country = input.country ?? current.country;

    let whatsappE164 = current.whatsappE164;
    let whatsappChanged = false;

    if (input.whatsapp !== undefined) {
      whatsappChanged = true;

      if (input.whatsapp === null || input.whatsapp.trim() === "") {
        whatsappE164 = null;
      } else {
        const normalised = normalizeToE164(input.whatsapp, country);

        if (!normalised) {
          throw new ProfileUpdateError(
            "invalid-whatsapp",
            "Enter a valid mobile number for the selected country.",
          );
        }

        whatsappE164 = normalised;
      }
    }

    const fullName = input.fullName ?? current.fullName;
    const community = input.community !== undefined ? input.community : current.community;
    const favouriteClub =
      input.favouriteClub !== undefined ? input.favouriteClub : current.favouriteClub;
    const preferredGame = input.preferredGame ?? current.preferredGame;
    const platform = input.platform ?? current.platform;
    const now = Timestamp.now();

    transaction.update(userReference, {
      fullName,
      country,
      community,
      favouriteClub,
      preferredGame,
      platform,
      ...(whatsappChanged ? { whatsappE164 } : {}),
      updatedAt: now,
    });

    // Public profile fields are display-only. The WhatsApp number and email are
    // deliberately absent. If a legacy account is missing its public profile,
    // create the display document in the same transaction.
    const publicFields = {
      gamerTag: current.gamerTag,
      gamerTagLower: current.gamerTagLower,
      country,
      community,
      favouriteClub,
      preferredGame,
      platform,
      status: current.status ?? "active",
    };

    if (publicSnapshot.exists) {
      transaction.update(publicReference, publicFields);
    } else {
      transaction.set(publicReference, {
        ...publicFields,
        photoUrl: current.photoUrl,
        avatarUrl: current.avatarUrl,
        avatarPublicId: current.avatarPublicId,
        stats: currentPublic?.stats ?? EMPTY_PROFILE_STATS,
      });
    }

    return { fullName, country, community, favouriteClub, preferredGame, platform };
  });
}

export interface AvatarReference {
  readonly url: string;
  readonly publicId: string;
}

/** Writes the server-built Cloudinary URL and public id to both documents. */
export async function storeAvatarReference(uid: string, avatar: AvatarReference): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const userReference = firestore.doc(paths.user(uid));
  const publicReference = firestore.doc(paths.publicProfile(uid));
  const now = Timestamp.now();

  await firestore.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userReference);

    if (!userSnapshot.exists) {
      throw new ProfileUpdateError("not-found", "Your profile could not be loaded.");
    }

    transaction.update(userReference, {
      avatarUrl: avatar.url,
      avatarPublicId: avatar.publicId,
      updatedAt: now,
    });
    transaction.set(
      publicReference,
      { avatarUrl: avatar.url, avatarPublicId: avatar.publicId },
      { merge: true },
    );
  });
}

/** Clears avatar references and returns the stored Cloudinary public id, if any. */
export async function clearAvatarReference(uid: string): Promise<string | null> {
  const firestore = getFirebaseAdminFirestore();
  const userReference = firestore.doc(paths.user(uid));
  const publicReference = firestore.doc(paths.publicProfile(uid));

  return firestore.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userReference);

    if (!userSnapshot.exists) {
      throw new ProfileUpdateError("not-found", "Your profile could not be loaded.");
    }

    const current = userSnapshot.data() as UserDocument;
    const publicId = current.avatarPublicId ?? null;

    transaction.update(userReference, {
      avatarUrl: null,
      avatarPublicId: null,
      updatedAt: Timestamp.now(),
    });
    transaction.set(publicReference, { avatarUrl: null, avatarPublicId: null }, { merge: true });

    return publicId;
  });
}
