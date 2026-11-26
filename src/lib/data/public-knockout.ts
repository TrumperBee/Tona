// GCC - public knockout bracket.
//
// Server-only. The whole bracket is public as soon as the knockout stage is
// generated. Every value is a projection of a server-written document: no
// bracket is generated here and no result is inferred.
import "server-only";

import {
  KNOCKOUT_ROUND_LABELS,
  KNOCKOUT_ROUNDS,
  type KnockoutDecidedBy,
  type KnockoutLegs,
  type KnockoutRound,
} from "@/lib/engine/knockout";
import type { StandingBand } from "@/lib/engine/standings/types";
import { cachePublicData } from "@/lib/cache/public-data";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { slotSourceLabel } from "@/lib/tournament/knockout";
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

export interface PublicKnockoutSlot {
  readonly uid: string | null;
  readonly gamerTag: string | null;
  readonly avatarUrl: string | null;
  readonly position: number | null;
  /** Placeholder text such as "Winner of R16 3" before the slot resolves. */
  readonly source: string;
}

export interface PublicKnockoutTie {
  readonly tieId: string;
  readonly round: KnockoutRound;
  readonly bracketSlot: number;
  readonly legs: KnockoutLegs;
  readonly group: string | null;
  readonly higher: PublicKnockoutSlot;
  readonly lower: PublicKnockoutSlot;
  readonly status: KnockoutTieStatus;
  readonly aggregate: { readonly higherGoals: number; readonly lowerGoals: number };
  readonly legsPlayed: number;
  readonly winnerUid: string | null;
  readonly decidedBy: KnockoutDecidedBy | null;
  readonly deciderNote: string | null;
  readonly penalties: { readonly higher: number; readonly lower: number } | null;
  readonly matches: readonly PublicKnockoutMatch[];
  readonly complete: boolean;
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
  readonly ties: readonly PublicKnockoutTie[];
  readonly qualifiers: readonly PublicKnockoutQualifier[];
  readonly champion: PublicKnockoutParticipant | null;
  readonly runnerUp: PublicKnockoutParticipant | null;
  readonly legs: KnockoutLegs | null;
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

interface PlayerDirectoryEntry {
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
}

function readSlot(
  value: unknown,
  players: ReadonlyMap<string, PlayerDirectoryEntry>,
): PublicKnockoutSlot {
  const data =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const ref =
    typeof data.ref === "object" && data.ref !== null ? (data.ref as Record<string, unknown>) : {};
  const uid =
    typeof data.uid === "string" && data.uid.length > 0 && typeof data.position === "number"
      ? data.uid
      : null;
  const player = uid ? players.get(uid) : undefined;
  const source =
    ref.type === "seed" && typeof ref.seed === "number"
      ? slotSourceLabel({ type: "seed", seed: ref.seed })
      : ref.type === "winnerOf" && typeof ref.tieId === "string"
        ? slotSourceLabel({ type: "winnerOf", tieId: ref.tieId })
        : "To be decided";

  return {
    uid,
    gamerTag: readText(data.gamerTag, "") || player?.gamerTag || (uid ? uid.slice(0, 12) : null),
    avatarUrl: player?.avatarUrl ?? null,
    position: typeof data.position === "number" ? data.position : null,
    source,
  };
}

/**
 * Reads the generated knockout bracket for a public tournament page. Returns
 * null before the bracket exists or when Firestore is unavailable. Never throws.
 */
async function getPublicKnockoutUncached(
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

    const players = new Map<string, PlayerDirectoryEntry>();

    for (const document of standingsSnapshot.docs) {
      const data = document.data();

      players.set(document.id, {
        gamerTag: readText(data.gamerTag, document.id.slice(0, 12) || "Player"),
        avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
      });
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

    const ties: PublicKnockoutTie[] = [];

    for (const document of tiesSnapshot.docs) {
      const data = document.data();
      const round = readRound(data.round);

      if (!round) {
        continue;
      }

      const tieId = readText(data.tieId, document.id);
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
      const status = readTieStatus(data.status);

      ties.push({
        tieId,
        round,
        bracketSlot: readNumber(data.bracketSlot),
        legs: data.legs === 1 ? 1 : 2,
        group:
          data.group === "A" || data.group === "B" || data.group === "C" || data.group === "D"
            ? data.group
            : null,
        higher: readSlot(data.higher, players),
        lower: readSlot(data.lower, players),
        status,
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
        complete: status === "completed" && typeof data.winnerUid === "string",
      });
    }

    if (ties.length === 0) {
      return null;
    }

    const rounds = KNOCKOUT_ROUNDS.flatMap((round): PublicKnockoutRound[] => {
      const roundTies = ties
        .filter((tie) => tie.round === round)
        .sort((a, b) => a.bracketSlot - b.bracketSlot);

      return roundTies.length === 0
        ? []
        : [{ round, label: KNOCKOUT_ROUND_LABELS[round], ties: roundTies }];
    });

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

    const tournamentData = tournamentSnapshot.data() ?? {};
    const championUid =
      typeof tournamentData.championUid === "string" ? tournamentData.championUid : null;
    const runnerUpUid =
      typeof tournamentData.runnerUpUid === "string" ? tournamentData.runnerUpUid : null;

    function participant(uid: string | null): PublicKnockoutParticipant | null {
      if (!uid) {
        return null;
      }

      const player = players.get(uid);

      return {
        uid,
        gamerTag: player?.gamerTag ?? (uid.slice(0, 12) || "Player"),
        avatarUrl: player?.avatarUrl ?? null,
      };
    }

    return {
      rounds,
      ties,
      qualifiers,
      champion: participant(championUid),
      runnerUp: participant(runnerUpUid),
      legs: tournamentData.knockoutLegs === 1 ? 1 : tournamentData.knockoutLegs === 2 ? 2 : null,
      leagueClosed: Boolean(tournamentData.leaguePhaseClosedAt),
      completed: tournamentData.status === "completed" || tournamentData.status === "archived",
    };
  } catch {
    return null;
  }
}

export const getPublicKnockout = cachePublicData(getPublicKnockoutUncached, [
  "public-tournament-knockout",
]);
