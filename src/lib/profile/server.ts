// GCC — server-side profile reads.
//
// Public pages receive display data only. The private user document is read for
// the owner's own pages (and for account status on a public page), but its
// email, WhatsApp number and role never leave this module in a public shape.
import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { gamerTagSchema, normalizeGamerTag } from "@/lib/validation/gamer-tag";
import type {
  AccountStatus,
  MembershipDocument,
  PublicProfileDocument,
  UserDocument,
} from "@/types/domain";

export interface OwnProfile {
  readonly user: UserDocument;
  readonly publicProfile: PublicProfileDocument | null;
  readonly memberships: readonly MembershipDocument[];
}

export async function getOwnProfile(uid: string): Promise<OwnProfile | null> {
  const firestore = getFirebaseAdminFirestore();
  const [userSnapshot, publicSnapshot, membershipSnapshot] = await Promise.all([
    firestore.doc(paths.user(uid)).get(),
    firestore.doc(paths.publicProfile(uid)).get(),
    firestore
      .collection(paths.userMemberships(uid))
      .orderBy("registeredAt", "desc")
      .limit(25)
      .get(),
  ]);

  if (!userSnapshot.exists) {
    return null;
  }

  return {
    user: userSnapshot.data() as UserDocument,
    publicProfile: publicSnapshot.exists ? (publicSnapshot.data() as PublicProfileDocument) : null,
    memberships: membershipSnapshot.docs.map((document) => document.data() as MembershipDocument),
  };
}

export interface PublicPlayerProfile {
  readonly uid: string;
  readonly status: AccountStatus;
  readonly profile: PublicProfileDocument;
}

/**
 * Resolves a gamer tag through the server-only reservation document, then reads
 * the public profile. Returns null for unknown or malformed tags.
 */
export async function getPublicPlayerByGamerTag(
  rawGamerTag: string,
): Promise<PublicPlayerProfile | null> {
  const parsed = gamerTagSchema.safeParse(rawGamerTag);

  if (!parsed.success) {
    return null;
  }

  const firestore = getFirebaseAdminFirestore();
  const reservationSnapshot = await firestore
    .doc(paths.gamerTag(normalizeGamerTag(parsed.data)))
    .get();

  if (!reservationSnapshot.exists) {
    return null;
  }

  const uid = reservationSnapshot.data()?.uid;

  if (typeof uid !== "string" || uid.length === 0) {
    return null;
  }

  const [userSnapshot, publicSnapshot] = await Promise.all([
    firestore.doc(paths.user(uid)).get(),
    firestore.doc(paths.publicProfile(uid)).get(),
  ]);

  if (!publicSnapshot.exists) {
    return null;
  }

  const status = userSnapshot.exists
    ? ((userSnapshot.data() as UserDocument).status ?? "active")
    : "active";

  return {
    uid,
    status,
    profile: publicSnapshot.data() as PublicProfileDocument,
  };
}
