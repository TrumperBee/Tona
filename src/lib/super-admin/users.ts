// GCC - Super Admin user queries.
//
// Every list is cursor-paginated with an explicit limit and an aggregate count.
// No endpoint reads a whole collection. Equality filters use the composite
// indexes declared in firestore.indexes.json.
import "server-only";

import type { DocumentSnapshot, Query, Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type {
  AccountStatus,
  AdminApplicationDocument,
  AuditLogDocument,
  MembershipDocument,
  UserDocument,
  UserRole,
} from "@/types/domain";
import type { GameId } from "@/lib/config/games";

export const USER_PAGE_SIZE = 20;

export interface UserListOptions {
  readonly role?: UserRole;
  readonly status?: AccountStatus;
  readonly country?: string;
  readonly game?: GameId;
  readonly search?: string | null;
  readonly after?: string | null;
  readonly before?: string | null;
  readonly pageSize?: number;
}

export interface UserListRow {
  readonly uid: string;
  readonly fullName: string;
  readonly gamerTag: string;
  readonly email: string;
  readonly country: string;
  readonly role: UserRole;
  readonly status: AccountStatus;
  readonly avatarUrl: string | null;
  readonly createdAt: Date | null;
}

export interface UserListResult {
  readonly rows: readonly UserListRow[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly firstId: string | null;
  readonly lastId: string | null;
  readonly searchMode: "email" | "tag" | null;
}

function clampPageSize(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return USER_PAGE_SIZE;
  return Math.min(25, Math.max(10, Math.trunc(value)));
}

function userRow(uid: string, data: Partial<UserDocument>): UserListRow {
  return {
    uid,
    fullName: data.fullName ?? "Unknown player",
    gamerTag: data.gamerTag ?? "unknown",
    email: data.email ?? "",
    country: data.country ?? "",
    role: data.role ?? "user",
    status: data.status ?? "active",
    avatarUrl: data.avatarUrl ?? null,
    createdAt: data.createdAt?.toDate() ?? null,
  };
}

/**
 * Builds the equality-filter part of a user query in a fixed field order so it
 * matches the declared composite indexes (role, status, country, preferredGame).
 */
function applyUserFilters(
  query: Query,
  options: Pick<UserListOptions, "role" | "status" | "country" | "game">,
): Query {
  let next = query;

  if (options.role) next = next.where("role", "==", options.role);
  if (options.status) next = next.where("status", "==", options.status);
  if (options.country) next = next.where("country", "==", options.country);
  if (options.game) next = next.where("preferredGame", "==", options.game);

  return next;
}

function userFilterKey(options: UserListOptions): {
  role?: UserRole;
  status?: AccountStatus;
  country?: string;
  game?: GameId;
} {
  return {
    role: options.role,
    status: options.status,
    country: options.country,
    game: options.game,
  };
}

async function cursorSnapshot(
  reference: string,
  id: string | null | undefined,
): Promise<DocumentSnapshot | null> {
  if (!id) return null;
  const snapshot = await getFirebaseAdminFirestore().doc(`${reference}/${id}`).get();
  return snapshot.exists ? snapshot : null;
}

/** Paginated user search/list, newest first. */
export async function listUsers(options: UserListOptions): Promise<UserListResult> {
  const firestore = getFirebaseAdminFirestore();
  const collection = firestore.collection(paths.users());
  const pageSize = clampPageSize(options.pageSize);
  const search = options.search?.trim().toLowerCase() ?? "";

  if (search.length > 0) {
    return searchUsers(search, options.after ?? null, options.before ?? null, pageSize);
  }

  const filtered = applyUserFilters(collection, userFilterKey(options));
  let query = filtered.orderBy("createdAt", "desc");

  const afterSnapshot = await cursorSnapshot(paths.users(), options.after);
  if (afterSnapshot) query = query.startAfter(afterSnapshot);

  const beforeSnapshot = await cursorSnapshot(paths.users(), options.before);
  if (beforeSnapshot) query = query.endBefore(beforeSnapshot);

  // When moving backwards, limitToLast returns the rows immediately before the
  // cursor rather than the newest rows in the whole range. The extra row is a
  // look-behind marker and is dropped from the displayed page.
  const pagedQuery = beforeSnapshot ? query.limitToLast(pageSize + 1) : query.limit(pageSize + 1);
  const [snapshot, countSnapshot] = await Promise.all([pagedQuery.get(), filtered.count().get()]);

  const rawDocs = snapshot.docs;
  const docs =
    beforeSnapshot && rawDocs.length > pageSize ? rawDocs.slice(1) : rawDocs.slice(0, pageSize);

  return {
    rows: docs.map((document) => userRow(document.id, document.data() as UserDocument)),
    total: countSnapshot.data().count,
    hasMore: beforeSnapshot ? docs.length > 0 : rawDocs.length > pageSize,
    firstId: docs[0]?.id ?? null,
    lastId: docs[docs.length - 1]?.id ?? null,
    searchMode: null,
  };
}

async function searchUsers(
  search: string,
  afterId: string | null,
  beforeId: string | null,
  pageSize: number,
): Promise<UserListResult> {
  const firestore = getFirebaseAdminFirestore();
  const collection = firestore.collection(paths.users());

  // A full email address is an exact lookup. Anything else is a gamer-tag
  // prefix search over the normalised field.
  if (search.includes("@")) {
    const snapshot = await collection.where("email", "==", search).limit(1).get();
    const rows = snapshot.docs.map((document) =>
      userRow(document.id, document.data() as UserDocument),
    );

    return {
      rows,
      total: rows.length,
      hasMore: false,
      firstId: rows[0]?.uid ?? null,
      lastId: rows[0]?.uid ?? null,
      searchMode: "email",
    };
  }

  let query = collection
    .where("gamerTagLower", ">=", search)
    .where("gamerTagLower", "<=", `${search}\uf8ff`)
    .orderBy("gamerTagLower", "asc");

  if (afterId) {
    const cursor = await cursorSnapshot(paths.users(), afterId);
    if (cursor) query = query.startAfter(cursor);
  }

  let usingBefore = false;

  if (beforeId) {
    const cursor = await cursorSnapshot(paths.users(), beforeId);
    if (cursor) {
      query = query.endBefore(cursor);
      usingBefore = true;
    }
  }

  const [snapshot, countSnapshot] = await Promise.all([
    (usingBefore ? query.limitToLast(pageSize + 1) : query.limit(pageSize + 1)).get(),
    collection
      .where("gamerTagLower", ">=", search)
      .where("gamerTagLower", "<=", `${search}\uf8ff`)
      .count()
      .get(),
  ]);

  const rawDocs = snapshot.docs;
  const docs =
    usingBefore && rawDocs.length > pageSize ? rawDocs.slice(1) : rawDocs.slice(0, pageSize);

  return {
    rows: docs.map((document) => userRow(document.id, document.data() as UserDocument)),
    total: countSnapshot.data().count,
    hasMore: usingBefore ? docs.length > 0 : rawDocs.length > pageSize,
    firstId: docs[0]?.id ?? null,
    lastId: docs[docs.length - 1]?.id ?? null,
    searchMode: "tag",
  };
}

export interface UserDetail {
  readonly uid: string;
  readonly user: UserDocument;
  readonly disabled: boolean;
  readonly lastSignInAt: Date | null;
  readonly memberships: ReadonlyArray<MembershipDocument>;
  readonly applications: ReadonlyArray<{ id: string; data: AdminApplicationDocument }>;
  readonly audit: ReadonlyArray<{ id: string; data: AuditLogDocument }>;
}

/** Loads one user with Auth state, memberships, applications and target audit. */
export async function getUserDetail(uid: string): Promise<UserDetail | null> {
  const firestore = getFirebaseAdminFirestore();
  const userReference = firestore.doc(paths.user(uid));
  const [userSnapshot, authUser, memberships, applications, audit] = await Promise.all([
    userReference.get(),
    getFirebaseAdminAuth()
      .getUser(uid)
      .catch(() => null),
    firestore
      .collection(paths.userMemberships(uid))
      .orderBy("registeredAt", "desc")
      .limit(20)
      .get(),
    firestore
      .collection(paths.adminApplications())
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get(),
    firestore
      .collection(paths.auditLogs())
      .where("targetType", "==", "user")
      .where("targetId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get(),
  ]);

  if (!userSnapshot.exists) {
    return null;
  }

  return {
    uid,
    user: userSnapshot.data() as UserDocument,
    disabled: authUser?.disabled ?? false,
    lastSignInAt: authUser?.metadata.lastSignInTime
      ? new Date(authUser.metadata.lastSignInTime)
      : null,
    memberships: memberships.docs.map((document) => document.data() as MembershipDocument),
    applications: applications.docs.map((document) => ({
      id: document.id,
      data: document.data() as AdminApplicationDocument,
    })),
    audit: audit.docs.map((document) => ({
      id: document.id,
      data: document.data() as AuditLogDocument,
    })),
  };
}

/** Resolves a gamer-tag prefix or a UID to actor UIDs for audit filtering. */
export async function resolveActorUids(actor: string): Promise<readonly string[]> {
  const query = actor.trim().toLowerCase();

  if (query.length === 0) {
    return [];
  }

  // UIDs are long and opaque; a short value is treated as a gamer-tag prefix.
  if (query.length >= 20) {
    const snapshot = await getFirebaseAdminFirestore().doc(paths.user(actor.trim())).get();
    return snapshot.exists ? [actor.trim()] : [];
  }

  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.users())
    .where("gamerTagLower", ">=", query)
    .where("gamerTagLower", "<=", `${query}\uf8ff`)
    .orderBy("gamerTagLower", "asc")
    .limit(10)
    .get();

  return snapshot.docs.map((document) => document.id);
}

export interface TimestampedRow {
  readonly createdAt: Timestamp | null;
}
