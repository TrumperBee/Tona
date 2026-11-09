// GCC - Super Admin audit-log viewer queries.
//
// The log is append-only and read-only. Filters use equality fields followed by
// the createdAt range/order, matching the composite indexes in
// firestore.indexes.json. The actor filter is resolved from a gamer-tag prefix
// or a UID before the query is built.
import "server-only";

import type { DocumentSnapshot, Query } from "firebase-admin/firestore";

import { describeAuditAction } from "@/lib/audit/actions";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import {
  firstQueryValue,
  parseDateEnd,
  parseDateStart,
  parsePageSize,
} from "@/lib/super-admin/query";
import { resolveActorUids } from "@/lib/super-admin/users";
import type { AuditLogDocument } from "@/types/domain";

export interface AuditListOptions {
  readonly action?: string | null;
  readonly actor?: string | null;
  readonly targetType?: string | null;
  readonly from?: Date | null;
  readonly to?: Date | null;
  readonly after?: string | null;
  readonly before?: string | null;
  readonly pageSize?: number;
}

export interface AuditListRow {
  readonly id: string;
  readonly actorUid: string;
  readonly actorRole: string;
  readonly action: string;
  readonly label: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly reason: string | null;
  readonly createdAt: Date | null;
}

export interface AuditListResult {
  readonly rows: readonly AuditListRow[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly firstId: string | null;
  readonly lastId: string | null;
}

function buildFilters(
  query: Query,
  options: AuditListOptions,
  actorUids: readonly string[],
): Query {
  let next = query;

  if (options.action) next = next.where("action", "==", options.action);
  if (actorUids.length > 0) next = next.where("actorUid", "in", actorUids.slice(0, 10));
  if (options.targetType) next = next.where("targetType", "==", options.targetType);
  if (options.from) next = next.where("createdAt", ">=", options.from);
  if (options.to) next = next.where("createdAt", "<", options.to);

  return next;
}

async function cursorSnapshot(id: string | null | undefined): Promise<DocumentSnapshot | null> {
  if (!id) return null;
  const snapshot = await getFirebaseAdminFirestore().doc(paths.auditLog(id)).get();
  return snapshot.exists ? snapshot : null;
}

function toRow(document: DocumentSnapshot): AuditListRow {
  const data = document.data() as AuditLogDocument;

  return {
    id: document.id,
    actorUid: data.actorUid,
    actorRole: data.actorRole,
    action: data.action,
    label: describeAuditAction(data.action),
    targetType: data.targetType,
    targetId: data.targetId,
    before: data.before,
    after: data.after,
    reason: data.reason,
    createdAt: data.createdAt?.toDate() ?? null,
  };
}

export async function listAuditLogs(options: AuditListOptions): Promise<AuditListResult> {
  const firestore = getFirebaseAdminFirestore();
  const collection = firestore.collection(paths.auditLogs());
  const pageSize = parsePageSize(String(options.pageSize ?? ""));
  const actorUids = options.actor ? await resolveActorUids(options.actor) : [];

  if (options.actor && actorUids.length === 0) {
    return { rows: [], total: 0, hasMore: false, firstId: null, lastId: null };
  }

  const filtered = buildFilters(collection, options, actorUids);
  let query = filtered.orderBy("createdAt", "desc");

  const afterSnapshot = await cursorSnapshot(options.after);
  if (afterSnapshot) query = query.startAfter(afterSnapshot);

  const beforeSnapshot = await cursorSnapshot(options.before);
  if (beforeSnapshot) query = query.endBefore(beforeSnapshot);

  const [snapshot, countSnapshot] = await Promise.all([
    query.limit(pageSize + 1).get(),
    filtered.count().get(),
  ]);

  const docs = snapshot.docs.slice(0, pageSize);

  return {
    rows: docs.map(toRow),
    total: countSnapshot.data().count,
    hasMore: snapshot.docs.length > pageSize,
    firstId: docs[0]?.id ?? null,
    lastId: docs[docs.length - 1]?.id ?? null,
  };
}

/** Reads filter values from a page's searchParams object. */
export function auditFiltersFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
) {
  return {
    action: firstQueryValue(searchParams.action),
    actor: firstQueryValue(searchParams.actor),
    targetType: firstQueryValue(searchParams.targetType),
    from: parseDateStart(searchParams.from),
    to: parseDateEnd(searchParams.to),
    after: firstQueryValue(searchParams.after),
    before: firstQueryValue(searchParams.before),
  };
}
