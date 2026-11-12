// GCC - public league table.
//
// Server-only. The table is a projection of the server-written standings
// documents; this module never computes or invents a row. It stays private
// until the schedule is public, exactly like fixtures and results.
import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { isFixturesPublicStatus } from "@/lib/data/public-fixtures";
import type {
  StandingBand,
  StandingsForm,
  TiebreakCriterion,
  TiebreakerProfile,
} from "@/lib/engine/standings/types";
import type { TournamentStatus } from "@/types/domain";

export interface PublicStandingRow {
  readonly uid: string;
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
  readonly position: number;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
  readonly form: readonly StandingsForm[];
  readonly band: StandingBand;
  readonly separatedBy: TiebreakCriterion | null;
  readonly provisional: boolean;
}

export interface PublicStandings {
  readonly rows: readonly PublicStandingRow[];
  readonly provisional: boolean;
}

const BANDS: readonly StandingBand[] = [
  "direct",
  "playoff_seeded",
  "playoff_unseeded",
  "eliminated",
];

const FORMS: readonly StandingsForm[] = ["W", "D", "L"];

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readBand(value: unknown): StandingBand {
  return typeof value === "string" && (BANDS as readonly string[]).includes(value)
    ? (value as StandingBand)
    : "eliminated";
}

function readForm(value: unknown): StandingsForm[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (entry): entry is StandingsForm =>
        typeof entry === "string" && (FORMS as readonly string[]).includes(entry),
    )
    .slice(-5);
}

/**
 * Reads the public table. Returns null while the tournament has no public
 * schedule or before the first standings write.
 */
export async function getPublicStandings(
  tournamentId: string,
  status: TournamentStatus,
): Promise<PublicStandings | null> {
  if (!isFixturesPublicStatus(status)) {
    return null;
  }

  try {
    const firestore = getFirebaseAdminFirestore();
    const snapshot = await firestore
      .collection(paths.tournamentStandings(tournamentId))
      .orderBy("position", "asc")
      .get();

    if (snapshot.empty) {
      return null;
    }

    const rows = snapshot.docs.map((document): PublicStandingRow => {
      const data = document.data();

      return {
        uid: document.id,
        gamerTag: readText(data.gamerTag, document.id.slice(0, 12) || "Player"),
        avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
        position: readNumber(data.position),
        played: readNumber(data.played),
        won: readNumber(data.won),
        drawn: readNumber(data.drawn),
        lost: readNumber(data.lost),
        goalsFor: readNumber(data.goalsFor),
        goalsAgainst: readNumber(data.goalsAgainst),
        goalDifference: readNumber(data.goalDifference),
        points: readNumber(data.points),
        form: readForm(data.form),
        band: readBand(data.band),
        separatedBy:
          typeof data.separatedBy === "string" ? (data.separatedBy as TiebreakCriterion) : null,
        provisional: data.provisional !== false,
      };
    });

    return {
      rows,
      provisional: rows[0]?.provisional ?? true,
    };
  } catch {
    return null;
  }
}

/** Profile used by the table's tie-break explanation. */
export function readTiebreakerProfile(value: unknown): TiebreakerProfile {
  return value === "classic" ? "classic" : "uefa";
}
