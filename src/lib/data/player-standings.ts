// GCC - a player's current league positions.
//
// Server-only. Reads the player's memberships and then the standings document
// for each tournament that is in or past its league phase. A missing standing
// document is simply not shown: the platform never invents a position.
import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { StandingBand, StandingsForm } from "@/lib/engine/standings/types";
import type { TournamentStatus } from "@/types/domain";

export interface PlayerStanding {
  readonly tournamentId: string;
  readonly slug: string;
  readonly name: string;
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
  readonly provisional: boolean;
}

const ACTIVE_STANDING_STATUSES: readonly TournamentStatus[] = [
  "fixtures_published",
  "league_phase",
  "knockout",
];

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

function readForm(value: unknown): StandingsForm[] {
  return Array.isArray(value)
    ? value
        .filter(
          (entry): entry is StandingsForm =>
            typeof entry === "string" && (FORMS as readonly string[]).includes(entry),
        )
        .slice(-5)
    : [];
}

function readBand(value: unknown): StandingBand {
  return typeof value === "string" && (BANDS as readonly string[]).includes(value)
    ? (value as StandingBand)
    : "eliminated";
}

export async function getPlayerStandings(uid: string): Promise<PlayerStanding[]> {
  try {
    const firestore = getFirebaseAdminFirestore();
    const memberships = await firestore.collection(paths.userMemberships(uid)).get();
    const active = memberships.docs
      .map((document) => ({ id: document.id, data: document.data() }))
      .filter(
        (entry) =>
          entry.data.playerStatus === "registered" &&
          (ACTIVE_STANDING_STATUSES as readonly string[]).includes(entry.data.status),
      );

    const rows = await Promise.all(
      active.map(async (entry): Promise<PlayerStanding | null> => {
        const standing = await firestore.doc(paths.tournamentStanding(entry.id, uid)).get();

        if (!standing.exists) {
          return null;
        }

        const data = standing.data() ?? {};

        return {
          tournamentId: entry.id,
          slug: typeof entry.data.slug === "string" ? entry.data.slug : "",
          name: typeof entry.data.name === "string" ? entry.data.name : "Tournament",
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
          provisional: data.provisional !== false,
        };
      }),
    );

    return rows
      .filter((row): row is PlayerStanding => row !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
