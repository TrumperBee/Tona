// GCC - knockout leg result entry, correction and clearing.
//
// Every mutation re-reads the tournament, the leg match, its tie and every leg
// of that tie inside one transaction. The tie is recomputed from the current
// leg scores, so the stored aggregate, status and winner always match the
// matches. A round is locked as soon as the next round has been published.
//
// No away-goals rule is applied. A level tie becomes `needs_decider` and only
// an organiser decider can complete it.
import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import type { TournamentAccess } from "@/lib/auth/guards";
import { knockoutRoundAfter, resolveTie, type KnockoutRound } from "@/lib/engine";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { createNotification } from "@/lib/notifications";
import { TournamentMutationError } from "@/lib/tournament/errors";
import { readEngineMatch, readEngineTie, tiePatchFromResolution } from "@/lib/tournament/knockout";
import {
  isResultEntryTournamentStatus,
  planResultTransition,
  type ResultAction,
} from "@/lib/tournament/result-state";
import type {
  MatchResultClearInput,
  MatchResultCorrectionInput,
  MatchResultEntryInput,
} from "@/lib/validation/match";
import type { TournamentDocument } from "@/types/domain";

interface KnockoutMatchChange {
  readonly action: ResultAction;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
  readonly reason: string | null;
}

function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

async function applyKnockoutMatchChange(
  access: TournamentAccess,
  tournamentId: string,
  matchId: string,
  change: KnockoutMatchChange,
): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const matchRef = firestore.doc(paths.tournamentMatch(tournamentId, matchId));

  const committed = await firestore.runTransaction(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;
    const matchSnapshot = await transaction.get(matchRef);

    if (!matchSnapshot.exists || matchSnapshot.data()?.tournamentId !== tournamentId) {
      throw new TournamentMutationError("Match not found.", 404);
    }

    const matchData = matchSnapshot.data() as Record<string, unknown>;
    const stage = matchData.stage;

    if (
      stage !== "playoff" &&
      stage !== "r16" &&
      stage !== "qf" &&
      stage !== "sf" &&
      stage !== "final"
    ) {
      throw new TournamentMutationError("That match is not a knockout tie.", 409);
    }

    if (!isResultEntryTournamentStatus(tournament.status, stage)) {
      throw new TournamentMutationError(
        "Knockout results can only be recorded while the knockout is running.",
        409,
      );
    }

    const tieId = matchData.tieId;

    if (typeof tieId !== "string" || tieId.length === 0) {
      throw new TournamentMutationError("That knockout match has no tie.", 409);
    }

    const tieRef = firestore.doc(paths.tournamentKnockoutTie(tournamentId, tieId));
    const tieSnapshot = await transaction.get(tieRef);

    if (!tieSnapshot.exists) {
      throw new TournamentMutationError("Knockout tie not found.", 404);
    }

    const tieData = tieSnapshot.data() as Record<string, unknown>;
    const tie = readEngineTie(tieData);
    const nextRound = knockoutRoundAfter(tie.round as KnockoutRound);

    if (nextRound) {
      const nextTies = await transaction.get(
        firestore
          .collection(paths.tournamentKnockoutTies(tournamentId))
          .where("round", "==", nextRound)
          .limit(1),
      );

      if (!nextTies.empty) {
        throw new TournamentMutationError(
          "This round is locked because the next round has been published.",
          409,
        );
      }
    }

    const previousResult =
      typeof matchData.result === "object" && matchData.result !== null
        ? (matchData.result as { homeGoals?: unknown; awayGoals?: unknown })
        : null;
    const hasResult =
      typeof previousResult?.homeGoals === "number" &&
      typeof previousResult?.awayGoals === "number";
    const plan = planResultTransition(change.action, {
      stage,
      status: matchData.status === "completed" ? "completed" : "scheduled",
      hasResult,
    });

    if (!plan.ok) {
      throw new TournamentMutationError(plan.message, 409);
    }

    const legMatches = await transaction.get(
      firestore.collection(paths.tournamentMatches(tournamentId)).where("tieId", "==", tieId),
    );
    const now = Timestamp.now();
    const engineMatches = legMatches.docs.map((document, index) => {
      const data = document.data();
      const base = readEngineMatch(data, index + 1);

      if (document.id !== matchId) {
        return base;
      }

      return {
        ...base,
        homeGoals: change.homeGoals,
        awayGoals: change.awayGoals,
      };
    });
    const resolution = resolveTie(tie, engineMatches);

    if (change.action === "clear") {
      transaction.update(matchRef, {
        result: null,
        status: "scheduled",
        updatedAt: now,
      });
    } else {
      transaction.update(matchRef, {
        result: {
          homeGoals: change.homeGoals,
          awayGoals: change.awayGoals,
          enteredBy:
            change.action === "correct" && typeof previousResult === "object"
              ? ((previousResult as { enteredBy?: string }).enteredBy ?? access.user.userId)
              : access.user.userId,
          enteredAt:
            change.action === "correct" &&
            typeof previousResult === "object" &&
            (previousResult as { enteredAt?: unknown }).enteredAt
              ? (previousResult as { enteredAt: unknown }).enteredAt
              : now,
          ...(change.action === "correct"
            ? {
                lastEditedBy: access.user.userId,
                lastEditedAt: now,
                editCount:
                  typeof (previousResult as { editCount?: unknown } | null)?.editCount === "number"
                    ? ((previousResult as { editCount: number }).editCount ?? 0) + 1
                    : 1,
              }
            : { editCount: 0 }),
        },
        status: "completed",
        updatedAt: now,
      });
    }

    transaction.update(tieRef, tiePatchFromResolution(resolution, tie, now));

    return {
      tournament,
      tie,
      resolution,
      homeUid: readText(matchData.homeUid, ""),
      awayUid: readText(matchData.awayUid, ""),
      homeTag: readText(matchData.homeTag, "Player"),
      awayTag: readText(matchData.awayTag, "Player"),
      previousResult: hasResult ? previousResult : null,
      editCount:
        typeof (previousResult as { editCount?: unknown } | null)?.editCount === "number"
          ? ((previousResult as { editCount: number }).editCount ?? 0) + 1
          : 1,
    };
  });

  const auditAction =
    change.action === "enter"
      ? "match.result_entered"
      : change.action === "correct"
        ? "match.result_corrected"
        : "match.result_cleared";

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: auditAction,
    targetType: "match",
    targetId: matchId,
    tournamentId,
    before:
      change.action === "enter"
        ? { status: "scheduled", result: null }
        : {
            status: "completed",
            result: committed.previousResult
              ? {
                  homeGoals: committed.previousResult.homeGoals,
                  awayGoals: committed.previousResult.awayGoals,
                }
              : null,
          },
    after: {
      status: change.action === "clear" ? "scheduled" : "completed",
      result:
        change.action === "clear"
          ? null
          : { homeGoals: change.homeGoals, awayGoals: change.awayGoals },
      tieId: committed.tie.tieId,
      tieStatus: committed.resolution.status,
      aggregate: committed.resolution.aggregate,
      ...(change.action === "correct" ? { editCount: committed.editCount } : {}),
    },
    reason: change.reason,
  });

  const link = `/tournaments/${committed.tournament.slug}/matches/${matchId}`;
  const scoreText =
    change.homeGoals === null || change.awayGoals === null
      ? "The score was cleared."
      : `The score is ${change.homeGoals}-${change.awayGoals}.`;

  await Promise.all([
    createNotification(committed.homeUid, {
      type: "result",
      title:
        change.action === "clear"
          ? "Knockout result cleared"
          : change.action === "correct"
            ? "Knockout result corrected"
            : "Knockout result recorded",
      body: `${committed.tournament.name}: ${scoreText} Your tie is now ${committed.resolution.status.replace("_", " ")}.`,
      link,
    }),
    createNotification(committed.awayUid, {
      type: "result",
      title:
        change.action === "clear"
          ? "Knockout result cleared"
          : change.action === "correct"
            ? "Knockout result corrected"
            : "Knockout result recorded",
      body: `${committed.tournament.name}: ${scoreText} Your tie is now ${committed.resolution.status.replace("_", " ")}.`,
      link,
    }),
  ]).catch(() => undefined);
}

export async function enterKnockoutMatchResult(
  access: TournamentAccess,
  tournamentId: string,
  input: MatchResultEntryInput,
): Promise<void> {
  await applyKnockoutMatchChange(access, tournamentId, input.matchId, {
    action: "enter",
    homeGoals: input.homeGoals,
    awayGoals: input.awayGoals,
    reason: null,
  });
}

export async function correctKnockoutMatchResult(
  access: TournamentAccess,
  tournamentId: string,
  input: MatchResultCorrectionInput,
): Promise<void> {
  await applyKnockoutMatchChange(access, tournamentId, input.matchId, {
    action: "correct",
    homeGoals: input.homeGoals,
    awayGoals: input.awayGoals,
    reason: input.reason,
  });
}

export async function clearKnockoutMatchResult(
  access: TournamentAccess,
  tournamentId: string,
  input: MatchResultClearInput,
): Promise<void> {
  await applyKnockoutMatchChange(access, tournamentId, input.matchId, {
    action: "clear",
    homeGoals: null,
    awayGoals: null,
    reason: input.reason,
  });
}

/** True when a stored match belongs to a knockout stage. */
export function isKnockoutStage(value: unknown): boolean {
  return (
    value === "playoff" || value === "r16" || value === "qf" || value === "sf" || value === "final"
  );
}
