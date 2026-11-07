// GCC — append-only audit log writer.
//
// Every privileged mutation calls this function. Audit entries are written with
// the Admin SDK, so clients can never create, edit or delete them.
import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { UserRole } from "@/types/domain";

export interface AuditLogInput {
  readonly actorUid: string;
  readonly actorRole: UserRole;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly tournamentId?: string | null;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly reason?: string | null;
}

/** Appends one audit entry and returns its document id. */
export async function writeAuditLog(input: AuditLogInput): Promise<string> {
  const firestore = getFirebaseAdminFirestore();
  const reference = firestore.collection(paths.auditLogs()).doc();

  await reference.set({
    actorUid: input.actorUid,
    actorRole: input.actorRole,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    tournamentId: input.tournamentId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return reference.id;
}
