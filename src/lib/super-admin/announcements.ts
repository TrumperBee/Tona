// GCC - platform announcement reads and writes.
//
// Announcements are server-written and publicly readable only while published,
// unexpired and not soft-deleted. Drafts remain visible only in the Super Admin
// console. Every write appends an audit entry; deletion is soft.
import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import type { SessionUser } from "@/lib/auth/session";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type {
  AnnouncementContentInput,
  AnnouncementCreateInput,
} from "@/lib/validation/announcement";
import type { AnnouncementSeverity, PlatformAnnouncementDocument } from "@/types/domain";

export const ANNOUNCEMENT_PAGE_SIZE = 20;

export class AnnouncementNotFoundError extends Error {
  readonly status = 404;

  constructor() {
    super("That announcement no longer exists.");
    this.name = "AnnouncementNotFoundError";
  }
}

export interface AnnouncementRow {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly severity: AnnouncementSeverity;
  readonly publishedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly pinned: boolean;
  readonly authorUid: string;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
}

export interface AnnouncementListResult {
  readonly rows: readonly AnnouncementRow[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly firstId: string | null;
  readonly lastId: string | null;
}

function toRow(id: string, data: PlatformAnnouncementDocument): AnnouncementRow {
  return {
    id,
    title: data.title,
    body: data.body,
    severity: data.severity ?? "info",
    publishedAt: data.publishedAt?.toDate() ?? null,
    expiresAt: data.expiresAt?.toDate() ?? null,
    pinned: data.pinned ?? false,
    authorUid: data.authorUid,
    createdAt: data.createdAt?.toDate() ?? null,
    updatedAt: data.updatedAt?.toDate() ?? null,
  };
}

function isExpired(row: AnnouncementRow, now: Date): boolean {
  return row.expiresAt !== null && row.expiresAt.getTime() <= now.getTime();
}

/** Super Admin manager list: every non-deleted announcement, newest first. */
export async function listAnnouncements(options: {
  readonly after?: string | null;
  readonly before?: string | null;
  readonly pageSize?: number;
}): Promise<AnnouncementListResult> {
  const firestore = getFirebaseAdminFirestore();
  const pageSize = Math.min(25, Math.max(5, options.pageSize ?? ANNOUNCEMENT_PAGE_SIZE));
  const collection = firestore.collection(paths.announcements());
  const filtered = collection.where("deletedAt", "==", null);
  let query = filtered.orderBy("createdAt", "desc");

  if (options.after) {
    const cursor = await firestore.doc(paths.announcement(options.after)).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }

  if (options.before) {
    const cursor = await firestore.doc(paths.announcement(options.before)).get();
    if (cursor.exists) query = query.endBefore(cursor);
  }

  const [snapshot, countSnapshot] = await Promise.all([
    query.limit(pageSize + 1).get(),
    filtered.count().get(),
  ]);
  const docs = snapshot.docs.slice(0, pageSize);

  return {
    rows: docs.map((document) =>
      toRow(document.id, document.data() as PlatformAnnouncementDocument),
    ),
    total: countSnapshot.data().count,
    hasMore: snapshot.docs.length > pageSize,
    firstId: docs[0]?.id ?? null,
    lastId: docs[docs.length - 1]?.id ?? null,
  };
}

/** Public page: published, non-deleted announcements, newest first. */
export async function getPublicAnnouncements(options: {
  readonly after?: string | null;
  readonly pageSize?: number;
}): Promise<AnnouncementListResult> {
  const firestore = getFirebaseAdminFirestore();
  const pageSize = Math.min(25, Math.max(5, options.pageSize ?? ANNOUNCEMENT_PAGE_SIZE));
  const now = new Date();
  const collection = firestore.collection(paths.announcements());
  const filtered = collection.where("deletedAt", "==", null).where("publishedAt", "<=", now);
  let query = filtered.orderBy("publishedAt", "desc");

  if (options.after) {
    const cursor = await firestore.doc(paths.announcement(options.after)).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }

  const [snapshot, countSnapshot] = await Promise.all([
    query.limit(pageSize + 1).get(),
    filtered.count().get(),
  ]);
  const rows = snapshot.docs
    .map((document) => toRow(document.id, document.data() as PlatformAnnouncementDocument))
    .filter((row) => row.publishedAt !== null && !isExpired(row, now));
  const page = rows.slice(0, pageSize);

  return {
    rows: page,
    total: countSnapshot.data().count,
    hasMore: rows.length > pageSize || snapshot.docs.length > pageSize + 1,
    firstId: page[0]?.id ?? null,
    lastId: page[page.length - 1]?.id ?? null,
  };
}

/**
 * Latest active announcements for the site banner. Pinned entries come first.
 * The query is bounded; older active announcements remain on /announcements.
 */
export async function getBannerAnnouncements(limit = 5): Promise<readonly AnnouncementRow[]> {
  const firestore = getFirebaseAdminFirestore();
  const now = new Date();
  const snapshot = await firestore
    .collection(paths.announcements())
    .where("deletedAt", "==", null)
    .where("publishedAt", "<=", now)
    .orderBy("publishedAt", "desc")
    .limit(Math.max(limit * 4, 20))
    .get();

  return snapshot.docs
    .map((document) => toRow(document.id, document.data() as PlatformAnnouncementDocument))
    .filter((row) => !isExpired(row, now))
    .sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
      return (right.publishedAt?.getTime() ?? 0) - (left.publishedAt?.getTime() ?? 0);
    })
    .slice(0, limit);
}

function auditSummary(input: AnnouncementContentInput | AnnouncementCreateInput) {
  return {
    title: input.title,
    severity: input.severity,
    pinned: input.pinned,
    expiresAt: input.expiresAt?.toISOString() ?? null,
  };
}

export async function createAnnouncement(
  actor: SessionUser,
  input: AnnouncementCreateInput,
): Promise<{ id: string }> {
  const firestore = getFirebaseAdminFirestore();
  const reference = firestore.collection(paths.announcements()).doc();
  const now = Timestamp.now();

  await reference.create({
    title: input.title,
    body: input.body,
    severity: input.severity,
    pinned: input.pinned,
    expiresAt: input.expiresAt ? Timestamp.fromDate(input.expiresAt) : null,
    publishedAt: input.publishNow ? now : null,
    authorUid: actor.userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "announcement.created",
    targetType: "announcement",
    targetId: reference.id,
    after: { ...auditSummary(input), published: input.publishNow },
  });

  if (input.publishNow) {
    await writeAuditLog({
      actorUid: actor.userId,
      actorRole: actor.role,
      action: "announcement.published",
      targetType: "announcement",
      targetId: reference.id,
      after: { published: true },
    });
  }

  return { id: reference.id };
}

async function requireAnnouncement(id: string): Promise<PlatformAnnouncementDocument> {
  const snapshot = await getFirebaseAdminFirestore().doc(paths.announcement(id)).get();

  if (!snapshot.exists) {
    throw new AnnouncementNotFoundError();
  }

  const data = snapshot.data() as PlatformAnnouncementDocument;

  if (data.deletedAt) {
    throw new AnnouncementNotFoundError();
  }

  return data;
}

export async function updateAnnouncement(
  actor: SessionUser,
  id: string,
  input: AnnouncementContentInput,
): Promise<void> {
  const before = await requireAnnouncement(id);

  await getFirebaseAdminFirestore()
    .doc(paths.announcement(id))
    .update({
      title: input.title,
      body: input.body,
      severity: input.severity,
      pinned: input.pinned,
      expiresAt: input.expiresAt ? Timestamp.fromDate(input.expiresAt) : null,
      updatedAt: Timestamp.now(),
    });

  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "announcement.updated",
    targetType: "announcement",
    targetId: id,
    before: auditSummary({
      title: before.title,
      body: before.body,
      severity: before.severity,
      pinned: before.pinned,
      expiresAt: before.expiresAt?.toDate() ?? null,
    }),
    after: auditSummary(input),
  });
}

export async function publishAnnouncement(actor: SessionUser, id: string): Promise<void> {
  const before = await requireAnnouncement(id);

  if (before.publishedAt) {
    return;
  }

  const now = Timestamp.now();
  await getFirebaseAdminFirestore().doc(paths.announcement(id)).update({
    publishedAt: now,
    updatedAt: now,
  });

  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "announcement.published",
    targetType: "announcement",
    targetId: id,
    before: { published: false },
    after: { published: true },
  });
}

export async function unpublishAnnouncement(actor: SessionUser, id: string): Promise<void> {
  const before = await requireAnnouncement(id);

  if (!before.publishedAt) {
    return;
  }

  await getFirebaseAdminFirestore().doc(paths.announcement(id)).update({
    publishedAt: null,
    updatedAt: Timestamp.now(),
  });

  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "announcement.unpublished",
    targetType: "announcement",
    targetId: id,
    before: { published: true },
    after: { published: false },
  });
}

export async function softDeleteAnnouncement(actor: SessionUser, id: string): Promise<void> {
  const before = await requireAnnouncement(id);
  const now = Timestamp.now();

  await getFirebaseAdminFirestore().doc(paths.announcement(id)).update({
    deletedAt: now,
    updatedAt: now,
  });

  await writeAuditLog({
    actorUid: actor.userId,
    actorRole: actor.role,
    action: "announcement.deleted",
    targetType: "announcement",
    targetId: id,
    before: { title: before.title, published: before.publishedAt !== null },
    after: { deleted: true },
  });
}
