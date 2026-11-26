// GCC - recent email send failures for the Super Admin console.
//
// Only the kind, a short reason, the HTTP status and the time are stored. An
// address and a message body are never written here.
import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { EmailFailureDocument } from "@/types/domain";

export interface EmailFailureRow {
  readonly id: string;
  readonly kind: string;
  readonly reason: string;
  readonly status: number | null;
  readonly createdAt: Date | null;
}

export async function writeEmailFailure(input: {
  readonly kind: string;
  readonly reason: string;
  readonly status: number | null;
}): Promise<void> {
  try {
    await getFirebaseAdminFirestore()
      .collection(paths.emailFailures())
      .doc()
      .create({
        kind: input.kind.slice(0, 80),
        reason: input.reason.slice(0, 200),
        status: input.status,
        createdAt: Timestamp.now(),
      });
  } catch {
    // Failure logging must never make a send failure worse.
  }
}

export async function listRecentEmailFailures(limit = 20): Promise<readonly EmailFailureRow[]> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.emailFailures())
    .orderBy("createdAt", "desc")
    .limit(Math.min(50, Math.max(1, limit)))
    .get();

  return snapshot.docs.map((document) => {
    const data = document.data() as EmailFailureDocument;
    return {
      id: document.id,
      kind: data.kind,
      reason: data.reason,
      status: data.status ?? null,
      createdAt: data.createdAt?.toDate() ?? null,
    };
  });
}
