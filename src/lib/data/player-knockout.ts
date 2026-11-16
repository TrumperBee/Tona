// GCC - a signed-in player's knockout status.
//
// Server-only. For every entered tournament in or past the knockout, this
// module reads the generated bracket and reports an honest outcome: still
// alive, waiting for a dependent tie to fill, eliminated, runner-up or
// champion. The bracket is written in one server action, so a direct qualifier
// has a Round-of-16 tie whose opponent is still a placeholder.
import "server-only";

import { KNOCKOUT_ROUND_LABELS, KNOCKOUT_ROUNDS, type KnockoutRound } from "@/lib/engine/knockout";
import type { StandingBand } from "@/lib/engine/standings/types";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { slotSourceLabel } from "@/lib/tournament/knockout";
import type { KnockoutTieStatus, TournamentStatus } from "@/types/domain";

const KNOCKOUT_STATUSES: readonly TournamentStatus[] = ["knockout", "completed", "archived"];

const BANDS: readonly StandingBand[] = [
  "direct",
  "playoff_seeded",
  "playoff_unseeded",
  "eliminated",
];

export type PlayerKnockoutOutcome =
  "champion" | "runner_up" | "active" | "qualified_waiting" | "eliminated";

export interface PlayerKnockoutStatus {
  readonly tournamentId: string;
  readonly slug: string;
  readonly name: string;
  readonly outcome: PlayerKnockoutOutcome;
  readonly round: KnockoutRound | null;
  readonly roundLabel: string | null;
  readonly tieId: string | null;
  readonly opponentTag: string | null;
  /** Placeholder shown when the opponent slot is not decided yet. */
  readonly opponentSource: string | null;
  readonly tieStatus: KnockoutTieStatus | null;
  /** Goals scored by the player in the latest tie, never the raw higher/lower aggregate. */
  readonly goalsFor: number | null;
  readonly goalsAgainst: number | null;
  readonly played: number;
  readonly band: StandingBand | null;
  readonly nextMatchId: string | null;
  readonly nextLeg: number | null;
}

function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBand(value: unknown): StandingBand | null {
  return typeof value === "string" && (BANDS as readonly string[]).includes(value)
    ? (value as StandingBand)
    : null;
}

function readRound(value: unknown): KnockoutRound | null {
  return typeof value === "string" && (KNOCKOUT_ROUNDS as readonly string[]).includes(value)
    ? (value as KnockoutRound)
    : null;
}

function roundIndex(round: KnockoutRound): number {
  return KNOCKOUT_ROUNDS.indexOf(round);
}

interface SlotData {
  readonly uid: string | null;
  readonly gamerTag: string | null;
  readonly position: number | null;
  readonly source: string;
}

function readSlot(value: unknown): SlotData {
  const data =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const ref =
    typeof data.ref === "object" && data.ref !== null ? (data.ref as Record<string, unknown>) : {};
  const uid = typeof data.uid === "string" && data.uid.length > 0 ? data.uid : null;
  const source =
    ref.type === "seed" && typeof ref.seed === "number"
      ? slotSourceLabel({ type: "seed", seed: ref.seed })
      : ref.type === "winnerOf" && typeof ref.tieId === "string"
        ? slotSourceLabel({ type: "winnerOf", tieId: ref.tieId })
        : "To be decided";

  return {
    uid,
    gamerTag: typeof data.gamerTag === "string" && data.gamerTag.length > 0 ? data.gamerTag : null,
    position: typeof data.position === "number" ? data.position : null,
    source,
  };
}

export async function getPlayerKnockoutStatus(uid: string): Promise<PlayerKnockoutStatus[]> {
  if (!uid) {
    return [];
  }

  try {
    const firestore = getFirebaseAdminFirestore();
    const memberships = await firestore.collection(paths.userMemberships(uid)).get();
    const active = memberships.docs
      .map((document) => ({ id: document.id, data: document.data() }))
      .filter(
        (entry) =>
          entry.data.playerStatus === "registered" &&
          (KNOCKOUT_STATUSES as readonly string[]).includes(entry.data.status),
      );

    const rows = await Promise.all(
      active.map(async (entry): Promise<PlayerKnockoutStatus | null> => {
        const tournamentId = entry.id;
        const [tiesSnapshot, matchesSnapshot, standingSnapshot] = await Promise.all([
          firestore.collection(paths.tournamentKnockoutTies(tournamentId)).get(),
          firestore.collection(paths.tournamentMatches(tournamentId)).get(),
          firestore.doc(paths.tournamentStanding(tournamentId, uid)).get(),
        ]);

        const matchesByTie = new Map<
          string,
          { readonly id: string; readonly leg: number; readonly status: string }[]
        >();

        for (const document of matchesSnapshot.docs) {
          const data = document.data();

          if (typeof data.tieId !== "string") {
            continue;
          }

          const list = matchesByTie.get(data.tieId) ?? [];

          list.push({
            id: document.id,
            leg: readNumber(data.leg),
            status: data.status === "completed" ? "completed" : "scheduled",
          });
          matchesByTie.set(data.tieId, list);
        }

        const playerTies = tiesSnapshot.docs
          .map((document) => {
            const data = document.data();

            return {
              id: document.id,
              data,
              round: readRound(data.round),
              higher: readSlot(data.higher),
              lower: readSlot(data.lower),
            };
          })
          .filter(
            (
              tie,
            ): tie is {
              id: string;
              data: Record<string, unknown>;
              round: KnockoutRound;
              higher: SlotData;
              lower: SlotData;
            } => tie.round !== null && (tie.higher.uid === uid || tie.lower.uid === uid),
          )
          .sort((a, b) => {
            const roundDelta = roundIndex(b.round) - roundIndex(a.round);

            if (roundDelta !== 0) {
              return roundDelta;
            }

            return readNumber(b.data.bracketSlot) - readNumber(a.data.bracketSlot);
          });

        const standingData = standingSnapshot.exists ? (standingSnapshot.data() ?? {}) : null;
        const band = standingData ? readBand(standingData.band) : null;
        const latest = playerTies[0] ?? null;
        const base = {
          tournamentId,
          slug: readText(entry.data.slug, ""),
          name: readText(entry.data.name, "Tournament"),
          band,
        } as const;

        if (!latest) {
          return {
            ...base,
            outcome: band === "eliminated" ? "eliminated" : "qualified_waiting",
            round: null,
            roundLabel: null,
            tieId: null,
            opponentTag: null,
            opponentSource: null,
            tieStatus: null,
            goalsFor: null,
            goalsAgainst: null,
            played: 0,
            nextMatchId: null,
            nextLeg: null,
          };
        }

        const isHigher = latest.higher.uid === uid;
        const own = isHigher ? latest.higher : latest.lower;
        const other = isHigher ? latest.lower : latest.higher;
        const tieStatus: KnockoutTieStatus =
          latest.data.status === "in_progress" ||
          latest.data.status === "needs_decider" ||
          latest.data.status === "completed"
            ? latest.data.status
            : "pending";
        const aggregate =
          typeof latest.data.aggregate === "object" && latest.data.aggregate !== null
            ? (latest.data.aggregate as Record<string, unknown>)
            : null;
        const goalsFor = aggregate
          ? readNumber(aggregate[isHigher ? "higherGoals" : "lowerGoals"])
          : null;
        const goalsAgainst = aggregate
          ? readNumber(aggregate[isHigher ? "lowerGoals" : "higherGoals"])
          : null;
        const winnerUid = typeof latest.data.winnerUid === "string" ? latest.data.winnerUid : null;
        const nextMatch = (matchesByTie.get(latest.id) ?? [])
          .filter((match) => match.status !== "completed")
          .sort((a, b) => a.leg - b.leg)[0];
        const shared = {
          ...base,
          round: latest.round,
          roundLabel: KNOCKOUT_ROUND_LABELS[latest.round],
          tieId: latest.id,
          opponentTag: other.uid ? other.gamerTag : null,
          opponentSource: other.uid ? null : other.source,
          tieStatus,
          goalsFor,
          goalsAgainst,
          played: readNumber(latest.data.legsPlayed),
          nextMatchId: nextMatch?.id ?? null,
          nextLeg: nextMatch?.leg ?? null,
          position: own.position,
        } as const;

        if (tieStatus !== "completed") {
          return { ...shared, outcome: "active" };
        }

        if (latest.round === "final") {
          return {
            ...shared,
            outcome: winnerUid === uid ? "champion" : "runner_up",
          };
        }

        if (winnerUid !== uid) {
          return { ...shared, outcome: "eliminated" };
        }

        return { ...shared, outcome: "qualified_waiting" };
      }),
    );

    return rows
      .filter((row): row is PlayerKnockoutStatus => row !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
