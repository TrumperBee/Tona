// GCC - one public, shareable match page.
//
// The match must belong to a tournament whose fixtures are public. The Admin
// SDK bypasses Security Rules, so the status check is repeated here. Only
// public profile display data is returned.
import "server-only";

import { getPublicTournamentBySlug } from "@/lib/data/public-tournaments";
import { isFixturesPublicStatus } from "@/lib/data/public-fixtures";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { MatchStatus, TournamentStatus } from "@/types/domain";

export interface PublicMatchPlayer {
  readonly uid: string;
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
  readonly country: string;
}

export interface PublicMatchDetail {
  readonly tournamentId: string;
  readonly tournamentName: string;
  readonly tournamentSlug: string;
  readonly tournamentStatus: TournamentStatus;
  readonly timezone: string;
  readonly matchId: string;
  readonly matchday: number;
  readonly status: MatchStatus;
  readonly scheduledAt: string | null;
  readonly home: PublicMatchPlayer;
  readonly away: PublicMatchPlayer;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
  readonly enteredByTag: string | null;
  readonly enteredAt: string | null;
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

async function publicPlayer(uid: string, fallbackTag: string): Promise<PublicMatchPlayer> {
  const snapshot = await getFirebaseAdminFirestore().doc(paths.publicProfile(uid)).get();
  const data = snapshot.exists ? (snapshot.data() ?? {}) : {};

  return {
    uid,
    gamerTag: readText(data.gamerTag, fallbackTag),
    avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
    country: typeof data.country === "string" ? data.country : "",
  };
}

/**
 * Returns the public match or null when the tournament or match is not public.
 * Never throws.
 */
export async function getPublicMatch(
  slug: string,
  matchId: string,
): Promise<PublicMatchDetail | null> {
  if (slug.trim().length === 0 || matchId.trim().length === 0) {
    return null;
  }

  try {
    const tournament = await getPublicTournamentBySlug(slug);

    if (!tournament || !isFixturesPublicStatus(tournament.status)) {
      return null;
    }

    const snapshot = await getFirebaseAdminFirestore()
      .doc(paths.tournamentMatch(tournament.id, matchId))
      .get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() ?? {};

    if (data.tournamentId !== tournament.id) {
      return null;
    }

    const homeUid = readText(data.homeUid, "");
    const awayUid = readText(data.awayUid, "");
    const result =
      typeof data.result === "object" && data.result !== null
        ? (data.result as Record<string, unknown>)
        : null;
    const enteredBy = typeof result?.enteredBy === "string" ? result.enteredBy : "";
    const [home, away, editor] = await Promise.all([
      publicPlayer(homeUid, readText(data.homeTag, "Player")),
      publicPlayer(awayUid, readText(data.awayTag, "Player")),
      enteredBy
        ? getFirebaseAdminFirestore().doc(paths.publicProfile(enteredBy)).get()
        : Promise.resolve(null),
    ]);

    return {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      tournamentSlug: tournament.slug,
      tournamentStatus: tournament.status,
      timezone: tournament.timezone,
      matchId: snapshot.id,
      matchday: typeof data.matchday === "number" ? data.matchday : 0,
      status: data.status === "completed" ? "completed" : "scheduled",
      scheduledAt: toIsoString(data.scheduledAt),
      home,
      away,
      homeGoals: typeof result?.homeGoals === "number" ? result.homeGoals : null,
      awayGoals: typeof result?.awayGoals === "number" ? result.awayGoals : null,
      enteredByTag: editor?.exists ? readText(editor.data()?.gamerTag, "Tournament admin") : null,
      enteredAt: toIsoString(result?.enteredAt),
    };
  } catch {
    return null;
  }
}
