// GCC - organiser tournament list queries.
//
// Every query is scoped to the caller's uid on the server; the client can
// never widen it. Lists move one opaque cursor at a time and the total is an
// exact Firestore count() aggregate.
import "server-only";

import type { DocumentSnapshot, Query } from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { parsePageSize } from "@/lib/super-admin/query";
import type { TournamentDocument, TournamentStatus } from "@/types/domain";

export interface OrganiserTournamentRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly gameId: TournamentDocument["gameId"];
  readonly status: TournamentStatus;
  readonly season: string;
  readonly coverImageUrl: string | null;
  readonly registrationCount: number;
  readonly maxParticipants: number;
  readonly startsAt: Date | null;
  readonly registrationClosesAt: Date | null;
  readonly updatedAt: Date | null;
}

export interface OrganiserTournamentListResult {
  readonly rows: readonly OrganiserTournamentRow[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly firstId: string | null;
  readonly lastId: string | null;
}

export interface OrganiserTournamentListOptions {
  readonly status?: TournamentStatus | null;
  readonly search?: string | null;
  readonly after?: string | null;
  readonly before?: string | null;
  readonly pageSize?: number;
}

function toRow(id: string, data: TournamentDocument): OrganiserTournamentRow {
  return {
    id,
    name: data.name,
    slug: data.slug,
    gameId: data.gameId,
    status: data.status,
    season: data.season ?? "",
    coverImageUrl: data.coverImageUrl ?? null,
    registrationCount: data.registrationCount ?? 0,
    maxParticipants: data.maxParticipants ?? 36,
    startsAt: data.startsAt?.toDate() ?? null,
    registrationClosesAt: data.registrationClosesAt?.toDate() ?? null,
    updatedAt: data.updatedAt?.toDate() ?? null,
  };
}

async function cursorSnapshot(id: string | null | undefined): Promise<DocumentSnapshot | null> {
  if (!id) return null;
  const snapshot = await getFirebaseAdminFirestore().doc(paths.tournament(id)).get();
  return snapshot.exists ? snapshot : null;
}

/** Lists one organiser's tournaments, most recently updated first. */
export async function listOrganiserTournaments(
  ownerUid: string,
  options: OrganiserTournamentListOptions = {},
): Promise<OrganiserTournamentListResult> {
  const firestore = getFirebaseAdminFirestore();
  const collection = firestore.collection(paths.tournaments());
  const pageSize = parsePageSize(String(options.pageSize ?? ""));
  const search = options.search?.trim() ?? "";
  let filtered: Query = collection.where("ownerUid", "==", ownerUid);

  if (options.status) filtered = filtered.where("status", "==", options.status);

  if (search.length > 0) {
    filtered = filtered
      .where("name", ">=", search)
      .where("name", "<=", `${search}\uf8ff`)
      .orderBy("name", "asc");
  } else {
    filtered = filtered.orderBy("updatedAt", "desc");
  }

  let query = filtered;
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
    rows: docs.map((document) => toRow(document.id, document.data() as TournamentDocument)),
    total: countSnapshot.data().count,
    hasMore: snapshot.docs.length > pageSize,
    firstId: docs[0]?.id ?? null,
    lastId: docs[docs.length - 1]?.id ?? null,
  };
}

/** Loads every tournament an organiser owns. Equality-only; automatic index. */
export async function getOrganiserTournaments(
  ownerUid: string,
): Promise<readonly OrganiserTournamentRow[]> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.tournaments())
    .where("ownerUid", "==", ownerUid)
    .get();

  return snapshot.docs.map((document) => toRow(document.id, document.data() as TournamentDocument));
}
