// GCC - public archives.
//
// Completed, archived and cancelled competitions are preserved. Cancelled
// records are read through the Admin SDK only, which matches ADR-044: the
// archive links to the read-only tournament notice page rather than exposing a
// client-readable document.
import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { isGameId, type GameId } from "@/lib/config/games";
import type { TournamentStatus } from "@/types/domain";

export const ARCHIVE_PAGE_SIZE = 12;

const ARCHIVE_STATUSES: readonly TournamentStatus[] = ["completed", "archived", "cancelled"];
const READS_PER_STATUS = 300;

export interface ArchiveRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly gameId: GameId;
  readonly season: string;
  readonly status: TournamentStatus;
  readonly completedAt: string | null;
  readonly startsAt: string | null;
  readonly registrationCount: number;
  /** True when a Hall of Fame induction exists for this tournament. */
  readonly hasHallOfFame: boolean;
}

export interface ArchivePage {
  readonly rows: readonly ArchiveRow[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
  readonly seasons: readonly string[];
}

function toIso(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function readText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export async function listArchive(options: {
  readonly gameId?: GameId | null;
  readonly season?: string | null;
  readonly search?: string | null;
  readonly page?: number;
}): Promise<ArchivePage> {
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const search = (options.search ?? "").trim().toLowerCase();
  const firestore = getFirebaseAdminFirestore();

  try {
    const snapshots = await Promise.all(
      ARCHIVE_STATUSES.map((status) =>
        firestore
          .collection(paths.tournaments())
          .where("status", "==", status)
          .limit(READS_PER_STATUS)
          .get(),
      ),
    );
    const rows = snapshots
      .flatMap((snapshot) => snapshot.docs)
      .map((document): ArchiveRow | null => {
        const data = document.data();
        const gameId = data.gameId;

        if (!isGameId(gameId)) return null;

        return {
          id: document.id,
          slug: readText(data.slug, document.id),
          name: readText(data.name, "Tournament"),
          gameId,
          season: readText(data.season),
          status: data.status as TournamentStatus,
          completedAt: toIso(data.completedAt),
          startsAt: toIso(data.startsAt),
          registrationCount:
            typeof data.registrationCount === "number" ? data.registrationCount : 0,
          hasHallOfFame: false,
        };
      })
      .filter((row): row is ArchiveRow => row !== null)
      .sort((left, right) => {
        const leftDate = left.completedAt ?? left.startsAt ?? "";
        const rightDate = right.completedAt ?? right.startsAt ?? "";
        return rightDate.localeCompare(leftDate);
      });
    const seasons = [
      ...new Set(rows.map((row) => row.season).filter((season) => season.length > 0)),
    ];
    const filtered = rows
      .filter((row) => (options.gameId ? row.gameId === options.gameId : true))
      .filter((row) => (options.season ? row.season === options.season : true))
      .filter((row) => (search ? row.name.toLowerCase().includes(search) : true));
    const start = (page - 1) * ARCHIVE_PAGE_SIZE;
    const pageRows = filtered.slice(start, start + ARCHIVE_PAGE_SIZE);
    const inducted = await Promise.all(
      pageRows.map(async (row) => {
        try {
          const snapshot = await firestore.doc(paths.hallOfFameEntry(row.id)).get();
          return snapshot.exists;
        } catch {
          return false;
        }
      }),
    );

    return {
      rows: pageRows.map((row, index) => ({ ...row, hasHallOfFame: inducted[index] ?? false })),
      total: filtered.length,
      page,
      pageCount: Math.max(1, Math.ceil(filtered.length / ARCHIVE_PAGE_SIZE)),
      seasons: seasons.sort((left, right) => right.localeCompare(left)),
    };
  } catch {
    return { rows: [], total: 0, page, pageCount: 1, seasons: [] };
  }
}
