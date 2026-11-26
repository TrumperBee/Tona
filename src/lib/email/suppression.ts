// GCC - bounces and complaints suppression list.
//
// A hard bounce or a complaint suppresses the address permanently. The list is
// keyed by the SHA-256 of the lowercased address, so the collection never
// contains a readable email address and a database dump does not leak one.
import "server-only";

import { createHash } from "node:crypto";

import { Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { EmailSuppressionDocument } from "@/types/domain";

export type SuppressionReason = "bounced" | "complained";

/** Stable, path-safe id for an address. */
export function suppressionId(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export async function isSuppressed(email: string): Promise<boolean> {
  if (!email.trim()) return true;
  const snapshot = await getFirebaseAdminFirestore()
    .doc(paths.emailSuppression(suppressionId(email)))
    .get();

  return snapshot.exists;
}

/** Suppresses one address. Idempotent: a later bounce does not overwrite the first. */
export async function suppressEmail(
  email: string,
  reason: SuppressionReason,
): Promise<{ id: string; created: boolean }> {
  const id = suppressionId(email);
  const reference = getFirebaseAdminFirestore().doc(paths.emailSuppression(id));
  const snapshot = await reference.get();

  if (snapshot.exists) {
    return { id, created: false };
  }

  await reference.create({ reason, createdAt: Timestamp.now() });
  return { id, created: true };
}

/** Removes a suppression after the owner changes to a working address. */
export async function clearSuppression(email: string): Promise<void> {
  if (!email.trim()) return;
  await getFirebaseAdminFirestore()
    .doc(paths.emailSuppression(suppressionId(email)))
    .delete();
}

export async function countSuppressions(): Promise<number> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.emailSuppressions())
    .count()
    .get();

  return snapshot.data().count;
}

export async function readSuppression(email: string): Promise<EmailSuppressionDocument | null> {
  const snapshot = await getFirebaseAdminFirestore()
    .doc(paths.emailSuppression(suppressionId(email)))
    .get();

  return snapshot.exists ? (snapshot.data() as EmailSuppressionDocument) : null;
}
