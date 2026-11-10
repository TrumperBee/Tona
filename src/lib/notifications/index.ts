// GCC - in-app notification writer and reader.
//
// Notifications are server-written to `users/{uid}/notifications/{id}` and
// owner-read only by Security Rules. There is no client write path. The batch
// variant chunks at Firestore's 500-operation limit.
import "server-only";

import { Timestamp, type DocumentSnapshot, type Query } from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type {
  NotificationBellData,
  NotificationListResult,
  NotificationRow,
} from "@/lib/notifications/types";
import { safeRedirectPath } from "@/lib/security/redirect";
import type { NotificationDocument, NotificationType } from "@/types/domain";

export const NOTIFICATION_PAGE_SIZE = 20;
export const NOTIFICATION_BELL_LIMIT = 5;
export const FIRESTORE_BATCH_LIMIT = 500;

export interface CreateNotificationInput {
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly link?: string | null;
}

function normaliseContent(input: CreateNotificationInput) {
  return {
    type: input.type,
    title: input.title.trim().slice(0, 120),
    body: input.body.trim().slice(0, 1000),
    link: input.link ? safeRedirectPath(input.link) : null,
  };
}

/** Writes one notification and returns its document id. */
export async function createNotification(
  uid: string,
  input: CreateNotificationInput,
): Promise<string> {
  const firestore = getFirebaseAdminFirestore();
  const reference = firestore.collection(paths.userNotifications(uid)).doc();
  const content = normaliseContent(input);

  await reference.create({
    ...content,
    read: false,
    createdAt: Timestamp.now(),
  });

  return reference.id;
}

/** Writes the same notification for many recipients, chunked at 500. */
export async function createNotifications(
  uids: readonly string[],
  input: CreateNotificationInput,
): Promise<number> {
  const recipients = [...new Set(uids.filter((uid) => uid.trim().length > 0))];

  if (recipients.length === 0) {
    return 0;
  }

  const firestore = getFirebaseAdminFirestore();
  const content = normaliseContent(input);
  let written = 0;

  for (let offset = 0; offset < recipients.length; offset += FIRESTORE_BATCH_LIMIT) {
    const chunk = recipients.slice(offset, offset + FIRESTORE_BATCH_LIMIT);
    const batch = firestore.batch();

    for (const uid of chunk) {
      const reference = firestore.collection(paths.userNotifications(uid)).doc();
      batch.create(reference, {
        ...content,
        read: false,
        createdAt: Timestamp.now(),
      });
    }

    await batch.commit();
    written += chunk.length;
  }

  return written;
}

function toRow(document: DocumentSnapshot): NotificationRow {
  const data = document.data() as NotificationDocument;

  return {
    id: document.id,
    type: data.type,
    title: data.title,
    body: data.body,
    link: data.link ?? null,
    read: data.read === true,
    createdAt: data.createdAt?.toDate() ?? null,
  };
}

async function cursorSnapshot(
  uid: string,
  id: string | null | undefined,
): Promise<DocumentSnapshot | null> {
  if (!id) return null;
  const snapshot = await getFirebaseAdminFirestore().doc(paths.userNotification(uid, id)).get();
  return snapshot.exists ? snapshot : null;
}

/** Owner notification inbox, newest first, cursor-paginated. */
export async function listNotifications(
  uid: string,
  options: {
    readonly after?: string | null;
    readonly before?: string | null;
    readonly pageSize?: number;
  } = {},
): Promise<NotificationListResult> {
  const firestore = getFirebaseAdminFirestore();
  const collection = firestore.collection(paths.userNotifications(uid));
  const pageSize = Math.min(
    25,
    Math.max(5, Math.trunc(options.pageSize ?? NOTIFICATION_PAGE_SIZE)),
  );
  let query: Query = collection.orderBy("createdAt", "desc");

  const afterSnapshot = await cursorSnapshot(uid, options.after);
  if (afterSnapshot) query = query.startAfter(afterSnapshot);

  const beforeSnapshot = await cursorSnapshot(uid, options.before);
  if (beforeSnapshot) query = query.endBefore(beforeSnapshot);

  const pagedQuery = beforeSnapshot ? query.limitToLast(pageSize + 1) : query.limit(pageSize + 1);
  const [snapshot, countSnapshot, unreadSnapshot] = await Promise.all([
    pagedQuery.get(),
    collection.count().get(),
    collection.where("read", "==", false).count().get(),
  ]);

  const rawDocs = snapshot.docs;
  const docs =
    beforeSnapshot && rawDocs.length > pageSize ? rawDocs.slice(1) : rawDocs.slice(0, pageSize);

  return {
    rows: docs.map(toRow),
    total: countSnapshot.data().count,
    unread: unreadSnapshot.data().count,
    hasMore: beforeSnapshot ? docs.length > 0 : rawDocs.length > pageSize,
    firstId: docs[0]?.id ?? null,
    lastId: docs[docs.length - 1]?.id ?? null,
  };
}

/** Five newest notifications plus an exact unread count for the header bell. */
export async function getNotificationBellData(uid: string): Promise<NotificationBellData> {
  const firestore = getFirebaseAdminFirestore();
  const collection = firestore.collection(paths.userNotifications(uid));
  const [latestSnapshot, unreadSnapshot] = await Promise.all([
    collection.orderBy("createdAt", "desc").limit(NOTIFICATION_BELL_LIMIT).get(),
    collection.where("read", "==", false).count().get(),
  ]);

  return {
    unreadCount: unreadSnapshot.data().count,
    items: latestSnapshot.docs.map(toRow),
  };
}

/** Marks up to 50 named notifications, or every unread notification, as read. */
export async function markNotificationsRead(
  uid: string,
  input: { readonly ids: readonly string[] } | { readonly all: true },
): Promise<number> {
  const firestore = getFirebaseAdminFirestore();

  if ("all" in input) {
    const collection = firestore.collection(paths.userNotifications(uid));
    let updated = 0;
    // Repeat in case the owner has more than one batch of unread messages. The
    // `read == false` filter means each committed batch leaves the result set.
    for (let round = 0; round < 20; round += 1) {
      const snapshot = await collection
        .where("read", "==", false)
        .limit(FIRESTORE_BATCH_LIMIT)
        .get();

      if (snapshot.empty) break;

      const batch = firestore.batch();
      snapshot.docs.forEach((document) => batch.update(document.ref, { read: true }));
      await batch.commit();
      updated += snapshot.size;

      if (snapshot.size < FIRESTORE_BATCH_LIMIT) break;
    }

    return updated;
  }

  const ids = [...new Set(input.ids)];
  if (ids.length === 0) return 0;

  const references = ids.map((id) => firestore.doc(paths.userNotification(uid, id)));
  const snapshots = await firestore.getAll(...references);
  const batch = firestore.batch();
  let updated = 0;

  for (const snapshot of snapshots) {
    if (!snapshot.exists) continue;
    const data = snapshot.data() as NotificationDocument;
    if (data.read === true) continue;
    batch.update(snapshot.ref, { read: true });
    updated += 1;
  }

  if (updated > 0) {
    await batch.commit();
  }

  return updated;
}
