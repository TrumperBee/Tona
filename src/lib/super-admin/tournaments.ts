// GCC - read-only tournament list for the Super Admin console.
//
// Phase 5 deliberately exposes no management actions. The list is cursor
// paginated and bounded; Phase 8 will add the operator controls.
import "server-only";

import type { DocumentSnapshot, Query } from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { GameId } from "@/lib/config/games";
import { parsePageSize } from "@/lib/super-admin/query";
import type { TournamentDocument, TournamentStatus } from "@/types/domain";

export interface TournamentListOptions {
  readonly status?: TournamentStatus | null;
  readonly search?: string | null;
  readonly after?: string | null;
  readonly before?: string | null;
  readonly pageSize?: number;
}

export interface TournamentListRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly gameId: GameId;
  readonly status: TournamentStatus;
  readonly ownerUid: string;
  readonly registrationCount: number;
  readonly maxParticipants: number;
  readonly startsAt: Date | null;
  readonly createdAt: Date | null;
}

export interface TournamentListResult {
  readonly rows: readonly TournamentListRow[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly firstId: string | null;
  readonly lastId: string | null;
}

function toRow(id: string, data: TournamentDocument): TournamentListRow {
  return {
    id,
    name: data.name,
    slug: data.slug,
    gameId: data.gameId,
    status: data.status,
    ownerUid: data.ownerUid,
    registrationCount: data.registrationCount ?? 0,
    maxParticipants: data.maxParticipants ?? 0,
    startsAt: data.startsAt?.toDate() ?? null,
    createdAt: data.createdAt?.toDate() ?? null,
  };
}

async function cursorSnapshot(id: string | null | undefined): Promise<DocumentSnapshot | null> {
  if (!id) return null;
  const snapshot = await getFirebaseAdminFirestore().doc(paths.tournament(id)).get();
  return snapshot.exists ? snapshot : null;
}

export async function listTournaments(
  options: TournamentListOptions,
): Promise<TournamentListResult> {
  const firestore = getFirebaseAdminFirestore();
  const collection = firestore.collection(paths.tournaments());
  const pageSize = parsePageSize(String(options.pageSize ?? ""));
  const search = options.search?.trim() ?? "";
  let filtered: Query = collection;

  if (options.status) filtered = filtered.where("status", "==", options.status);

  if (search.length > 0) {
    filtered = filtered
      .where("name", ">=", search)
      .where("name", "<=", `${search}\uf8ff`)
      .orderBy("name", "asc");
  } else {
    filtered = filtered.orderBy("createdAt", "desc");
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
