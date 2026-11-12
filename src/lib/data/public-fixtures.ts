// GCC - public league-phase fixtures.
//
// Server-only. Fixtures are returned only after the tournament has published
// them; a private draft never reaches this module. The public page receives
// plain serialisable rows for its matchday selector and "My matches" filter.
import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { MatchStatus, TournamentStatus } from "@/types/domain";

export const FIXTURE_PUBLIC_STATUSES: readonly TournamentStatus[] = [
  "fixtures_published",
  "league_phase",
  "knockout",
  "completed",
  "archived",
];

export function isFixturesPublicStatus(status: TournamentStatus): boolean {
  return FIXTURE_PUBLIC_STATUSES.includes(status);
}

export interface PublicFixtureRow {
  readonly id: string;
  readonly matchday: number;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly scheduledAt: string | null;
  readonly status: MatchStatus;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
}

export interface PublicMatchdayWindow {
  readonly number: number;
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface PublicFixtures {
  readonly matchdays: readonly PublicMatchdayWindow[];
  readonly matches: readonly PublicFixtureRow[];
}

function toIsoString(value: unknown): string | null {
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

function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function compareText(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

/**
 * Reads the published fixtures for a public tournament page. Never throws and
 * returns null while the schedule is private or missing.
 */
export async function getPublicFixtures(
  tournamentId: string,
  status: TournamentStatus,
): Promise<PublicFixtures | null> {
  if (!isFixturesPublicStatus(status)) {
    return null;
  }

  try {
    const firestore = getFirebaseAdminFirestore();
    const [matchdaysSnapshot, matchesSnapshot] = await Promise.all([
      firestore.collection(paths.tournamentMatchdays(tournamentId)).get(),
      firestore.collection(paths.tournamentMatches(tournamentId)).get(),
    ]);

    const matchdays = matchdaysSnapshot.docs
      .map((document) => {
        const data = document.data();
        const number = typeof data.number === "number" ? data.number : Number(document.id);
        const startsOn = toIsoString(data.startsOn);
        const endsOn = toIsoString(data.endsOn);

        if (!Number.isInteger(number) || !startsOn || !endsOn) {
          return null;
        }

        return { number, startsOn, endsOn };
      })
      .filter((entry): entry is PublicMatchdayWindow => entry !== null)
      .sort((a, b) => a.number - b.number);

    const matches = matchesSnapshot.docs
      .map((document): PublicFixtureRow => {
        const data = document.data();
        const result =
          typeof data.result === "object" && data.result !== null
            ? (data.result as Record<string, unknown>)
            : null;

        return {
          id: document.id,
          matchday: typeof data.matchday === "number" ? data.matchday : 0,
          homeUid: readText(data.homeUid, ""),
          awayUid: readText(data.awayUid, ""),
          homeTag: readText(data.homeTag, "Player"),
          awayTag: readText(data.awayTag, "Player"),
          scheduledAt: toIsoString(data.scheduledAt),
          status: data.status === "completed" ? "completed" : "scheduled",
          homeGoals: typeof result?.homeGoals === "number" ? result.homeGoals : null,
          awayGoals: typeof result?.awayGoals === "number" ? result.awayGoals : null,
        };
      })
      .sort((a, b) => {
        if (a.matchday !== b.matchday) {
          return a.matchday - b.matchday;
        }

        return compareText(a.id, b.id);
      });

    if (matches.length === 0) {
      return null;
    }

    return { matchdays, matches };
  } catch {
    return null;
  }
}
