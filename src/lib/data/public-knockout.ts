// GCC - public knockout bracket.
//
// Server-only. Ties are public only once the tournament reaches the knockout
// stage (or is completed/archived); an unpublished draft never reaches this
// module. Every value is a projection of a server-written document: no bracket
// is generated here and no result is inferred.
import "server-only";

import {
  KNOCKOUT_ROUND_LABELS,
  KNOCKOUT_ROUNDS,
  type KnockoutDecidedBy,
  type KnockoutLegs,
  type KnockoutRound,
  type PlayoffGroup,
} from "@/lib/engine/knockout";
import type { StandingBand } from "@/lib/engine/standings/types";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { KnockoutTieStatus, TournamentStatus } from "@/types/domain";

export const KNOCKOUT_PUBLIC_STATUSES: readonly TournamentStatus[] = [
  "knockout",
  "completed",
  "archived",
];

export function isKnockoutPublicStatus(status: TournamentStatus): boolean {
  return KNOCKOUT_PUBLIC_STATUSES.includes(status);
}

export interface PublicKnockoutMatch {
  readonly id: string;
  readonly leg: number;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
  readonly status: "scheduled" | "completed";
}

export interface PublicKnockoutTie {
  readonly tieId: string;
  readonly round: KnockoutRound;
  readonly bracketSlot: number;
  readonly legs: KnockoutLegs;
  readonly higherSeedTag: string;
  readonly higherSeedPosition: number;
  readonly lowerSeedTag: string;
  readonly lowerSeedPosition: number;
  readonly higherSeedUid: string;
  readonly lowerSeedUid: string;
  readonly group: PlayoffGroup | null;
  readonly status: KnockoutTieStatus;
  readonly aggregate: { readonly higherGoals: number; readonly lowerGoals: number };
  readonly legsPlayed: number;
  readonly winnerUid: string | null;
  readonly decidedBy: KnockoutDecidedBy | null;
  readonly deciderNote: string | null;
  readonly penalties: { readonly higher: number; readonly lower: number } | null;
  readonly matches: readonly PublicKnockoutMatch[];
}

export interface PublicKnockoutRound {
  readonly round: KnockoutRound;
  readonly label: string;
  readonly ties: readonly PublicKnockoutTie[];
}

export interface PublicKnockoutQualifier {
  readonly uid: string;
  readonly gamerTag: string;
  readonly position: number;
  readonly band: StandingBand;
}

export interface PublicKnockoutParticipant {
  readonly uid: string;
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
}

export interface PublicKnockout {
  readonly rounds: readonly PublicKnockoutRound[];
  readonly qualifiers: readonly PublicKnockoutQualifier[];
  readonly champion: PublicKnockoutParticipant | null;
  readonly runnerUp: PublicKnockoutParticipant | null;
  readonly leagueClosed: boolean;
  readonly completed: boolean;
}

const BANDS: readonly StandingBand[] = [
  "direct",
  "playoff_seeded",
  "playoff_unseeded",
  "eliminated",
];

function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readRound(value: unknown): KnockoutRound | null {
  return typeof value === "string" && (KNOCKOUT_ROUNDS as readonly string[]).includes(value)
    ? (value as KnockoutRound)
    : null;
}

function readTieStatus(value: unknown): KnockoutTieStatus {
  return value === "in_progress" || value === "needs_decider" || value === "completed"
    ? value
    : "pending";
}

function readSeedPosition(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function readBand(value: unknown): StandingBand {
  return typeof value === "string" && (BANDS as readonly string[]).includes(value)
    ? (value as StandingBand)
    : "eliminated";
}

/**
 * Reads the published knockout bracket for a public tournament page. Returns
 * null before the league closes, when no round has been published, or when
 * Firestore is unavailable. Never throws.
 */
export async function getPublicKnockout(
  tournamentId: string,
  status: TournamentStatus,
): Promise<PublicKnockout | null> {
  if (!isKnockoutPublicStatus(status)) {
    return null;
  }

  try {
    const firestore = getFirebaseAdminFirestore();
    const [tournamentSnapshot, tiesSnapshot, matchesSnapshot, standingsSnapshot] =
      await Promise.all([
        firestore.doc(paths.tournament(tournamentId)).get(),
        firestore.collection(paths.tournamentKnockoutTies(tournamentId)).get(),
        firestore.collection(paths.tournamentMatches(tournamentId)).get(),
        firestore.collection(paths.tournamentStandings(tournamentId)).get(),
      ]);

    if (tiesSnapshot.empty) {
      return null;
    }

    const standingsByUid = new Map<
      string,
      { readonly gamerTag: string; readonly avatarUrl: string | null; readonly band: StandingBand }
    >();

    for (const document of standingsSnapshot.docs) {
      const data = document.data();

      standingsByUid.set(document.id, {
        gamerTag: readText(data.gamerTag, document.id.slice(0, 12) || "Player"),
        avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
        band: readBand(data.band),
      });
    }

    const tagsByUid = new Map<string, string>();

    for (const document of tiesSnapshot.docs) {
      const data = document.data();

      if (typeof data.higherSeedUid === "string") {
        tagsByUid.set(
          data.higherSeedUid,
          readText(data.higherSeedTag, data.higherSeedUid.slice(0, 12) || "Player"),
        );
      }

      if (typeof data.lowerSeedUid === "string") {
        tagsByUid.set(
          data.lowerSeedUid,
          readText(data.lowerSeedTag, data.lowerSeedUid.slice(0, 12) || "Player"),
        );
      }
    }

    const matchesByTie = new Map<string, PublicKnockoutMatch[]>();

    for (const document of matchesSnapshot.docs) {
      const data = document.data();

      if (typeof data.tieId !== "string" || typeof data.leg !== "number") {
        continue;
      }

      const result =
        typeof data.result === "object" && data.result !== null
          ? (data.result as Record<string, unknown>)
          : null;
      const list = matchesByTie.get(data.tieId) ?? [];

      list.push({
        id: document.id,
        leg: data.leg,
        homeTag: readText(data.homeTag, "Player"),
        awayTag: readText(data.awayTag, "Player"),
        homeGoals: typeof result?.homeGoals === "number" ? result.homeGoals : null,
        awayGoals: typeof result?.awayGoals === "number" ? result.awayGoals : null,
        status: data.status === "completed" ? "completed" : "scheduled",
      });
      matchesByTie.set(data.tieId, list);
    }

    const tiesByRound = new Map<KnockoutRound, PublicKnockoutTie[]>();

    for (const document of tiesSnapshot.docs) {
      const data = document.data();
      const round = readRound(data.round);
      const higherSeedPosition = readSeedPosition(data.higherSeedPosition);
      const lowerSeedPosition = readSeedPosition(data.lowerSeedPosition);

      if (!round || higherSeedPosition === null || lowerSeedPosition === null) {
        continue;
      }

      const tieId = readText(data.tieId, document.id);
      const list = tiesByRound.get(round) ?? [];
      const aggregate =
        typeof data.aggregate === "object" && data.aggregate !== null
          ? {
              higherGoals: readNumber((data.aggregate as Record<string, unknown>).higherGoals),
              lowerGoals: readNumber((data.aggregate as Record<string, unknown>).lowerGoals),
            }
          : { higherGoals: 0, lowerGoals: 0 };
      const penalties =
        typeof data.penalties === "object" && data.penalties !== null
          ? {
              higher: readNumber((data.penalties as Record<string, unknown>).higher),
              lower: readNumber((data.penalties as Record<string, unknown>).lower),
            }
          : null;

      list.push({
        tieId,
        round,
        bracketSlot: readNumber(data.bracketSlot),
        legs: data.legs === 1 ? 1 : 2,
        higherSeedTag: readText(
          data.higherSeedTag,
          tagsByUid.get(readText(data.higherSeedUid, "")) ?? "Player",
        ),
        higherSeedPosition,
        lowerSeedTag: readText(
          data.lowerSeedTag,
          tagsByUid.get(readText(data.lowerSeedUid, "")) ?? "Player",
        ),
        lowerSeedPosition,
        higherSeedUid: readText(data.higherSeedUid, ""),
        lowerSeedUid: readText(data.lowerSeedUid, ""),
        group:
          data.group === "A" || data.group === "B" || data.group === "C" || data.group === "D"
            ? data.group
            : null,
        status: readTieStatus(data.status),
        aggregate,
        legsPlayed: readNumber(data.legsPlayed),
        winnerUid: typeof data.winnerUid === "string" ? data.winnerUid : null,
        decidedBy:
          data.decidedBy === "aggregate" ||
          data.decidedBy === "extra_time" ||
          data.decidedBy === "penalties"
            ? data.decidedBy
            : null,
        deciderNote: typeof data.deciderNote === "string" ? data.deciderNote : null,
        penalties,
        matches: (matchesByTie.get(tieId) ?? []).sort((a, b) => a.leg - b.leg),
      });
      tiesByRound.set(round, list);
    }

    const rounds = KNOCKOUT_ROUNDS.flatMap((round): PublicKnockoutRound[] => {
      const ties = (tiesByRound.get(round) ?? []).sort((a, b) => a.bracketSlot - b.bracketSlot);

      return ties.length === 0 ? [] : [{ round, label: KNOCKOUT_ROUND_LABELS[round], ties }];
    });

    if (rounds.length === 0) {
      return null;
    }

    const qualifiers = standingsSnapshot.docs
      .map((document): PublicKnockoutQualifier | null => {
        const data = document.data();
        const position = readSeedPosition(data.position);

        if (position === null) {
          return null;
        }

        return {
          uid: document.id,
          gamerTag: readText(data.gamerTag, document.id.slice(0, 12) || "Player"),
          position,
          band: readBand(data.band),
        };
      })
      .filter((row): row is PublicKnockoutQualifier => row !== null)
      .sort((a, b) => a.position - b.position);

    const finalRound = tiesByRound.get("final") ?? [];
    const finalTie = finalRound.length === 1 ? (finalRound[0] as PublicKnockoutTie) : null;
    const finalData =
      finalTie === null
        ? null
        : (tiesSnapshot.docs.find((document) => document.data().round === "final")?.data() ?? null);
    const championUid =
      finalTie && finalTie.status === "completed" && finalTie.winnerUid ? finalTie.winnerUid : null;
    const runnerUpUid =
      championUid && finalData && typeof finalData.higherSeedUid === "string"
        ? championUid === finalData.higherSeedUid
          ? readText(finalData.lowerSeedUid, "")
          : readText(finalData.higherSeedUid, "")
        : null;

    function participant(uid: string | null): PublicKnockoutParticipant | null {
      if (!uid) {
        return null;
      }

      const standing = standingsByUid.get(uid);

      return {
        uid,
        gamerTag: standing?.gamerTag ?? tagsByUid.get(uid) ?? "Player",
        avatarUrl: standing?.avatarUrl ?? null,
      };
    }

    const tournamentData = tournamentSnapshot.data() ?? {};

    return {
      rounds,
      qualifiers,
      champion: participant(championUid),
      runnerUp: participant(runnerUpUid),
      leagueClosed: Boolean(tournamentData.leaguePhaseClosedAt),
      completed: tournamentData.status === "completed" || tournamentData.status === "archived",
    };
  } catch {
    return null;
  }
}
