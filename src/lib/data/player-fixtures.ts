// GCC - a signed-in player's cross-tournament fixture list.
//
// Server-only. The collection-group query uses the existing
// `participants CONTAINS + matchday` index. Because the Admin SDK bypasses
// Security Rules, tournament visibility is re-checked in code: a match is shown
// only when its tournament has published fixtures and is not cancelled or
// suspended. Opponent avatars and countries come from public profiles.
import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { isFixturesPublicStatus } from "@/lib/data/public-fixtures";
import type { MatchStatus, StageType, TournamentDocument, TournamentStatus } from "@/types/domain";

const MATCH_LIMIT = 200;

export interface PlayerFixtureRow {
  readonly matchId: string;
  readonly tournamentId: string;
  readonly tournamentName: string;
  readonly tournamentSlug: string;
  readonly tournamentStatus: TournamentStatus;
  readonly stage: StageType;
  readonly leg: number | null;
  readonly matchday: number;
  readonly opponentUid: string;
  readonly opponentTag: string;
  readonly opponentAvatarUrl: string | null;
  readonly opponentCountry: string;
  readonly isHome: boolean;
  readonly status: MatchStatus;
  readonly scheduledAt: string | null;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
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

/**
 * Every published fixture for one player, in scheduled order and then by
 * matchday. Returns an empty list honestly when nothing is scheduled.
 */
export async function getPlayerFixtures(uid: string): Promise<PlayerFixtureRow[]> {
  if (!uid) {
    return [];
  }

  try {
    const firestore = getFirebaseAdminFirestore();
    const matchesSnapshot = await firestore
      .collectionGroup("matches")
      .where("participants", "array-contains", uid)
      .orderBy("matchday", "asc")
      .limit(MATCH_LIMIT)
      .get();

    if (matchesSnapshot.empty) {
      return [];
    }

    const tournamentIds = [
      ...new Set(
        matchesSnapshot.docs
          .map((document) => document.data().tournamentId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const tournamentSnapshots = await Promise.all(
      tournamentIds.map((id) => firestore.doc(paths.tournament(id)).get()),
    );
    const tournaments = new Map<string, TournamentDocument>();

    for (const snapshot of tournamentSnapshots) {
      if (snapshot.exists) {
        tournaments.set(snapshot.id, snapshot.data() as TournamentDocument);
      }
    }

    const visibleMatches = matchesSnapshot.docs.flatMap((document) => {
      const data = document.data();
      const tournamentId = typeof data.tournamentId === "string" ? data.tournamentId : "";
      const tournament = tournaments.get(tournamentId);

      if (!tournament || !isFixturesPublicStatus(tournament.status)) {
        return [];
      }

      const homeUid = typeof data.homeUid === "string" ? data.homeUid : "";
      const awayUid = typeof data.awayUid === "string" ? data.awayUid : "";

      if (homeUid !== uid && awayUid !== uid) {
        return [];
      }

      return [
        {
          documentId: document.id,
          tournamentId,
          data,
          tournament,
          homeUid,
          awayUid,
          opponentUid: homeUid === uid ? awayUid : homeUid,
        },
      ];
    });

    const opponentUids = [
      ...new Set(
        visibleMatches
          .map((match) => match.opponentUid)
          .filter((opponentUid) => opponentUid.length > 0),
      ),
    ];
    const opponentSnapshots = await Promise.all(
      opponentUids.map((opponentUid) => firestore.doc(paths.publicProfile(opponentUid)).get()),
    );
    const opponents = new Map<
      string,
      { gamerTag: string; avatarUrl: string | null; country: string }
    >();

    for (const snapshot of opponentSnapshots) {
      if (!snapshot.exists) {
        continue;
      }

      const data = snapshot.data() ?? {};

      opponents.set(snapshot.id, {
        gamerTag: readText(data.gamerTag, "Player"),
        avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
        country: typeof data.country === "string" ? data.country : "",
      });
    }

    return visibleMatches
      .map((match): PlayerFixtureRow => {
        const data = match.data;
        const opponent = opponents.get(match.opponentUid);
        const result =
          typeof data.result === "object" && data.result !== null
            ? (data.result as Record<string, unknown>)
            : null;

        return {
          matchId: match.documentId,
          tournamentId: match.tournamentId,
          tournamentName: readText(match.tournament.name, "Tournament"),
          tournamentSlug: match.tournament.slug,
          tournamentStatus: match.tournament.status,
          stage:
            data.stage === "playoff" ||
            data.stage === "r16" ||
            data.stage === "qf" ||
            data.stage === "sf" ||
            data.stage === "final"
              ? data.stage
              : "league",
          leg: typeof data.leg === "number" ? data.leg : null,
          matchday: typeof data.matchday === "number" ? data.matchday : 0,
          opponentUid: match.opponentUid,
          opponentTag:
            opponent?.gamerTag ??
            readText(match.homeUid === uid ? data.awayTag : data.homeTag, "Player"),
          opponentAvatarUrl: opponent?.avatarUrl ?? null,
          opponentCountry: opponent?.country ?? "",
          isHome: match.homeUid === uid,
          status: data.status === "completed" ? "completed" : "scheduled",
          scheduledAt: toIsoString(data.scheduledAt),
          homeTag: readText(data.homeTag, "Player"),
          awayTag: readText(data.awayTag, "Player"),
          homeGoals: typeof result?.homeGoals === "number" ? result.homeGoals : null,
          awayGoals: typeof result?.awayGoals === "number" ? result.awayGoals : null,
        };
      })
      .sort((a, b) => {
        const first = a.scheduledAt ? Date.parse(a.scheduledAt) : Number.MAX_SAFE_INTEGER;
        const second = b.scheduledAt ? Date.parse(b.scheduledAt) : Number.MAX_SAFE_INTEGER;

        if (first !== second) {
          return first - second;
        }

        const stageOrder: readonly StageType[] = ["league", "playoff", "r16", "qf", "sf", "final"];
        const stageDelta = stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);

        if (stageDelta !== 0) {
          return stageDelta;
        }

        return a.matchday - b.matchday;
      });
  } catch {
    return [];
  }
}
