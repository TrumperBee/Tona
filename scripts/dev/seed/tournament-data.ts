// GCC - Firestore/Auth reads and the small set of writes the seeder needs.
//
// Registration itself always goes through the real production services; this
// module only reads tournament state and performs the cleanup operations the
// app has no route for.
import { FieldValue } from "firebase-admin/firestore";

import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { normalizeGamerTag } from "@/lib/validation/gamer-tag";
import type { PlatformId } from "@/lib/config/games";
import type { TournamentDocument } from "@/types/domain";

import { SeedError, type ManifestAccount } from "./manifest";
import { CLEANABLE_STATUSES, emptyProgress, type TournamentProgress } from "./safety";

export interface TournamentRecord {
  readonly id: string;
  readonly data: TournamentDocument;
}

export interface PublicProfileSnapshot {
  readonly country: string;
  readonly platform: PlatformId;
  readonly gamerTag: string;
}

export async function listTournaments(): Promise<readonly TournamentRecord[]> {
  const snapshot = await getFirebaseAdminFirestore().collection(paths.tournaments()).get();

  return snapshot.docs
    .map((document) => ({
      id: document.id,
      data: document.data() as TournamentDocument,
    }))
    .sort((left, right) => {
      const leftTime = left.data.createdAt?.toMillis?.() ?? 0;
      const rightTime = right.data.createdAt?.toMillis?.() ?? 0;
      return rightTime - leftTime;
    });
}

/** Resolves a slug through the reserved `tournamentSlugs` document. */
export async function findTournamentBySlug(slug: string): Promise<TournamentRecord> {
  const firestore = getFirebaseAdminFirestore();
  const slugSnapshot = await firestore.doc(paths.tournamentSlug(slug)).get();

  if (!slugSnapshot.exists) {
    throw new SeedError(`No tournament has the slug "${slug}". Run \`npm run dev:seed -- list\`.`);
  }

  const tournamentId = slugSnapshot.data()?.tournamentId;

  if (typeof tournamentId !== "string" || tournamentId.length === 0) {
    throw new SeedError(`The slug "${slug}" has no tournament id reservation.`);
  }

  const snapshot = await firestore.doc(paths.tournament(tournamentId)).get();

  if (!snapshot.exists) {
    throw new SeedError(`The slug "${slug}" points to a missing tournament (${tournamentId}).`);
  }

  return { id: tournamentId, data: snapshot.data() as TournamentDocument };
}

/** uid -> registration status for one tournament. */
export async function registeredStatuses(tournamentId: string): Promise<Map<string, string>> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.tournamentRegistrations(tournamentId))
    .get();
  const statuses = new Map<string, string>();

  for (const document of snapshot.docs) {
    const status = document.data()?.status;
    statuses.set(document.id, typeof status === "string" ? status : "unknown");
  }

  return statuses;
}

export async function readProgress(tournamentId: string): Promise<TournamentProgress> {
  const firestore = getFirebaseAdminFirestore();

  const [draw, fixtureDraft, matches, matchdays, standings, resultReports, knockoutTies] =
    await Promise.all([
      firestore.doc(paths.tournamentDrawCurrent(tournamentId)).get(),
      firestore.doc(paths.tournamentFixtureDraftCurrent(tournamentId)).get(),
      firestore.collection(paths.tournamentMatches(tournamentId)).limit(1).get(),
      firestore.collection(paths.tournamentMatchdays(tournamentId)).limit(1).get(),
      firestore.collection(paths.tournamentStandings(tournamentId)).limit(1).get(),
      firestore.collection(paths.tournamentResultReports(tournamentId)).limit(1).get(),
      firestore.collection(paths.tournamentKnockoutTies(tournamentId)).limit(1).get(),
    ]);

  return {
    ...emptyProgress(),
    hasDraw: draw.exists,
    hasFixtureDraft: fixtureDraft.exists,
    hasMatches: !matches.empty,
    hasMatchdays: !matchdays.empty,
    hasStandings: !standings.empty,
    hasResultReports: !resultReports.empty,
    hasKnockoutTies: !knockoutTies.empty,
  };
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }

  return result;
}

/**
 * tournamentId -> uid -> registration status for every (tournament, uid) pair.
 * Batched to stay well inside the Admin SDK's identifier limits.
 */
export async function registrationMatrix(
  tournamentIds: readonly string[],
  uids: readonly string[],
): Promise<Map<string, Map<string, string>>> {
  const firestore = getFirebaseAdminFirestore();
  const matrix = new Map<string, Map<string, string>>();

  for (const tournamentId of tournamentIds) {
    matrix.set(tournamentId, new Map<string, string>());
  }

  for (const tournamentChunk of chunks(tournamentIds, 10)) {
    for (const uidChunk of chunks(uids, 10)) {
      const refs = tournamentChunk.flatMap((tournamentId) =>
        uidChunk.map((uid) => firestore.doc(paths.tournamentRegistration(tournamentId, uid))),
      );
      const snapshots = await firestore.getAll(...refs);
      let index = 0;

      for (const tournamentId of tournamentChunk) {
        for (const uid of uidChunk) {
          const snapshot = snapshots[index];
          index += 1;

          if (snapshot?.exists) {
            const status = snapshot.data()?.status;
            matrix.get(tournamentId)?.set(uid, typeof status === "string" ? status : "unknown");
          }
        }
      }
    }
  }

  return matrix;
}

export async function loadPublicProfiles(
  uids: readonly string[],
): Promise<Map<string, PublicProfileSnapshot>> {
  const firestore = getFirebaseAdminFirestore();
  const profiles = new Map<string, PublicProfileSnapshot>();

  for (const uidChunk of chunks(uids, 100)) {
    if (uidChunk.length === 0) {
      continue;
    }

    const snapshots = await firestore.getAll(
      ...uidChunk.map((uid) => firestore.doc(paths.publicProfile(uid))),
    );

    snapshots.forEach((snapshot, index) => {
      const uid = uidChunk[index];
      const data = snapshot.data();

      if (
        uid &&
        snapshot.exists &&
        typeof data?.country === "string" &&
        typeof data?.platform === "string" &&
        typeof data?.gamerTag === "string"
      ) {
        profiles.set(uid, {
          country: data.country,
          platform: data.platform as PlatformId,
          gamerTag: data.gamerTag,
        });
      }
    });
  }

  return profiles;
}

/** Lower-case tag -> owning uid for every candidate tag that already exists. */
export async function existingTagOwners(
  gamerTags: readonly string[],
): Promise<Map<string, string>> {
  const firestore = getFirebaseAdminFirestore();
  const owners = new Map<string, string>();

  for (const tagChunk of chunks(gamerTags, 100)) {
    if (tagChunk.length === 0) {
      continue;
    }

    const keys = tagChunk.map(normalizeGamerTag);
    const snapshots = await firestore.getAll(
      ...keys.map((key) => firestore.doc(paths.gamerTag(key))),
    );

    snapshots.forEach((snapshot, index) => {
      const key = keys[index];
      const uid = snapshot.data()?.uid;

      if (key && snapshot.exists && typeof uid === "string") {
        owners.set(key, uid);
      }
    });
  }

  return owners;
}

/** Emails that already belong to a Firebase Auth user. */
export async function existingAuthEmails(emails: readonly string[]): Promise<Set<string>> {
  const auth = getFirebaseAdminAuth();
  const found = new Set<string>();

  for (const emailChunk of chunks(emails, 100)) {
    if (emailChunk.length === 0) {
      continue;
    }

    const result = await auth.getUsers(emailChunk.map((email) => ({ email })));

    for (const user of result.users) {
      if (user.email) {
        found.add(user.email.toLowerCase());
      }
    }
  }

  return found;
}

export async function existingAuthUids(uids: readonly string[]): Promise<Set<string>> {
  const auth = getFirebaseAdminAuth();
  const found = new Set<string>();

  for (const uidChunk of chunks(uids, 100)) {
    if (uidChunk.length === 0) {
      continue;
    }

    const result = await auth.getUsers(uidChunk.map((uid) => ({ uid })));

    for (const user of result.users) {
      found.add(user.uid);
    }
  }

  return found;
}

/**
 * Removes manifest registrations from a tournament that has not progressed and
 * corrects `registrationCount` in the same transaction. Re-checks the status
 * so a draw confirmed between plan and execution is never partially cleaned.
 */
export async function removeTestRegistrations(
  tournamentId: string,
  uids: readonly string[],
): Promise<number> {
  if (uids.length === 0) {
    return 0;
  }

  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));

  return firestore.runTransaction(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);

    if (!tournamentSnapshot.exists) {
      throw new SeedError(`Tournament ${tournamentId} no longer exists.`);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;

    if (!CLEANABLE_STATUSES.includes(tournament.status)) {
      throw new SeedError(
        `Tournament ${tournamentId} changed to "${tournament.status}" while cleaning. Nothing was removed.`,
      );
    }

    const registrationRefs = uids.map((uid) =>
      firestore.doc(paths.tournamentRegistration(tournamentId, uid)),
    );
    const membershipRefs = uids.map((uid) =>
      firestore.doc(paths.userMembership(uid, tournamentId)),
    );
    const snapshots = await transaction.getAll(...registrationRefs);
    let removed = 0;
    let counted = 0;

    snapshots.forEach((snapshot, index) => {
      if (snapshot.exists) {
        transaction.delete(registrationRefs[index]!);
        transaction.delete(membershipRefs[index]!);
        removed += 1;

        if (snapshot.data()?.status === "registered") {
          counted += 1;
        }
      }
    });

    if (removed > 0) {
      transaction.update(tournamentRef, {
        registrationCount: Math.max(0, Number(tournament.registrationCount ?? 0) - counted),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return removed;
  });
}

/** Recursively deletes one tournament and its slug reservation. */
export async function deleteTournamentRecord(record: TournamentRecord): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const slugRef = firestore.doc(paths.tournamentSlug(record.data.slug));
  const slugSnapshot = await slugRef.get();

  await firestore.recursiveDelete(firestore.doc(paths.tournament(record.id)));

  if (slugSnapshot.exists && slugSnapshot.data()?.tournamentId === record.id) {
    await slugRef.delete();
  }
}

/**
 * Stores the reserved Ofcom drama number on a freshly created test account.
 *
 * The production validator intentionally rejects this fictional, non-dialable
 * range, so passing it through `registerPlayer` would fail. Account creation
 * still runs through the real service; only this display-only contact field is
 * written directly, and only for accounts this tool created.
 */
export async function setTestWhatsapp(uid: string, phone: string): Promise<void> {
  await getFirebaseAdminFirestore().doc(paths.user(uid)).update({
    whatsappE164: phone,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "auth/user-not-found"
  );
}

/**
 * Deletes one manifest account: Auth user, private user tree (notifications,
 * memberships), public profile tree, and the tag reservation if it still
 * belongs to this uid.
 */
export async function deleteTestAccount(account: ManifestAccount): Promise<void> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();

  try {
    await auth.deleteUser(account.uid);
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }

  await firestore.recursiveDelete(firestore.doc(paths.user(account.uid)));
  await firestore.recursiveDelete(firestore.doc(paths.publicProfile(account.uid)));

  const tagRef = firestore.doc(paths.gamerTag(normalizeGamerTag(account.gamerTag)));
  const tagSnapshot = await tagRef.get();

  if (tagSnapshot.exists && tagSnapshot.data()?.uid === account.uid) {
    await tagRef.delete();
  }
}
