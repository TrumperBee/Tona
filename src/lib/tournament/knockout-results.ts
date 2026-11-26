// GCC - knockout leg result entry, correction and clearing with auto-advance.
//
// Every mutation reads the tournament, every knockout tie and every knockout
// match inside ONE transaction. The affected tie is resolved from its leg
// scores, and the winner is written into each dependent slot in the same
// transaction: no separate "advance" button exists.
//
// No away-goals rule is applied. A tie level on aggregate becomes
// `needs_decider` and its previous winner is removed. A correction or clear is
// refused when any dependent tie already holds a result, because rewriting an
// earlier round after a later result would silently rewrite history.
import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { withPublicInvalidation } from "@/lib/cache/public-data";
import type { TournamentAccess } from "@/lib/auth/guards";
import { resolveTie, type KnockoutPlayer } from "@/lib/engine";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { notify } from "@/lib/notifications/service";
import { TournamentMutationError } from "@/lib/tournament/errors";
import { finaliseTournamentCompletion } from "@/lib/stats/completion";
import { refreshPlayersStats } from "@/lib/stats/server";
import {
  announceCompletion,
  betterAndWorse,
  blockingDependentTie,
  completionFromTie,
  isKnockoutRound,
  readCompletionTargets,
  readEngineMatch,
  readKnockoutState,
  resolvableForTie,
  shortTieLabel,
  stageBracketAdvance,
  stageTournamentCompletion,
  stageTournamentReopen,
  tiePatchFromResolution,
  type CompletionSummary,
} from "@/lib/tournament/knockout";
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

interface KnockoutCommit {
  readonly tournament: TournamentDocument;
  readonly tieId: string;
  readonly round: string;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly status: string;
  readonly aggregate: { readonly higherGoals: number; readonly lowerGoals: number };
  readonly previousResult: { readonly homeGoals: number; readonly awayGoals: number } | null;
  readonly editCount: number;
  readonly completion: CompletionSummary | null;
  readonly reopened: boolean;
  /** The winner's next tie, once both of its players are known. */
  readonly readyForWinner: {
    readonly tieId: string;
    readonly round: string;
    readonly opponentUid: string;
    readonly opponentTag: string;
  } | null;
  /** Resolved winner of the changed tie, or null when it is undecided. */
  readonly winnerUid: string | null;
}

async function applyKnockoutMatchChange(
  access: TournamentAccess,
  tournamentId: string,
  matchId: string,
  change: KnockoutMatchChange,
): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));

  const committed = await firestore.runTransaction(async (transaction): Promise<KnockoutCommit> => {
    const state = await readKnockoutState(transaction, tournamentId);
    const tournament = state.tournament;
    const canEdit =
      tournament.status === "knockout" ||
      (tournament.status === "completed" && access.user.role === "super_admin");

    if (!canEdit) {
      throw new TournamentMutationError(
        tournament.status === "completed"
          ? "Only the Super Admin may change a result after the tournament is complete."
          : "Knockout results can only be recorded while the knockout is running.",
        tournament.status === "completed" ? 403 : 409,
      );
    }

    const matchSnapshot = state.matches.find((document) => document.id === matchId);

    if (!matchSnapshot || matchSnapshot.data().tournamentId !== tournamentId) {
      throw new TournamentMutationError("Match not found.", 404);
    }

    const matchData = matchSnapshot.data();
    const stage = matchData.stage;

    if (!isKnockoutRound(stage)) {
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

    const stored = state.ties.find((tie) => tie.id === tieId);

    if (!stored) {
      throw new TournamentMutationError("Knockout tie not found.", 404);
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

    if (change.action !== "enter") {
      const blocker = blockingDependentTie(state, tieId);

      if (blocker) {
        throw new TournamentMutationError(
          `That change would rewrite ${shortTieLabel(blocker.id)}, which already has a result. Clear or correct that later tie first.`,
          409,
        );
      }
    }

    const legMatches = state.matches.filter((document) => document.data().tieId === tieId);
    const engineMatches = legMatches.map((document) => {
      const base = readEngineMatch(document.data(), 1);

      if (document.id !== matchId) {
        return base;
      }

      return {
        ...base,
        homeGoals: change.homeGoals,
        awayGoals: change.awayGoals,
      };
    });
    const resolvable = resolvableForTie(stored.tie);
    const resolution = resolveTie(resolvable, engineMatches);
    const { better, worse } = betterAndWorse(stored.tie);
    const winner: KnockoutPlayer | null =
      resolution.winnerUid === better.playerId
        ? better
        : resolution.winnerUid === worse.playerId
          ? worse
          : null;
    const now = Timestamp.now();

    // The final can end the competition. Read everything completion needs
    // before the first write of this transaction.
    const completionTargets =
      stored.tie.round === "final" ? await readCompletionTargets(transaction, tournamentId) : null;

    if (change.action === "clear") {
      transaction.update(matchSnapshot.ref, {
        result: null,
        status: "scheduled",
        updatedAt: now,
      });
    } else {
      transaction.update(matchSnapshot.ref, {
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

    transaction.update(stored.ref, tiePatchFromResolution(resolution, stored.tie, now));

    const advanced = stageBracketAdvance({
      transaction,
      firestore,
      tournamentId,
      now,
      before: state.bracket,
      ties: state.ties,
      matches: state.matches,
      changedTieId: tieId,
      winner,
    });

    const finalTie = advanced.bracket.ties.find((tie) => tie.round === "final") ?? null;
    let completion: CompletionSummary | null = null;
    let reopened = false;

    if (completionTargets && finalTie?.winner) {
      completion = stageTournamentCompletion({
        transaction,
        tournamentRef,
        finalTie,
        registeredUids: completionTargets.registeredUids,
        membershipSnapshots: completionTargets.membershipSnapshots,
        now,
      });
    } else if (!finalTie?.winner && tournament.status === "completed") {
      stageTournamentReopen({ transaction, tournamentRef, now });
      reopened = true;
    }

    return {
      tournament,
      tieId,
      round: stored.tie.round,
      homeUid: readText(matchData.homeUid, ""),
      awayUid: readText(matchData.awayUid, ""),
      homeTag: readText(matchData.homeTag, "Player"),
      awayTag: readText(matchData.awayTag, "Player"),
      status: resolution.status,
      aggregate: resolution.aggregate,
      previousResult: hasResult
        ? {
            homeGoals: previousResult?.homeGoals as number,
            awayGoals: previousResult?.awayGoals as number,
          }
        : null,
      editCount:
        typeof (previousResult as { editCount?: unknown } | null)?.editCount === "number"
          ? ((previousResult as { editCount: number }).editCount ?? 0) + 1
          : 1,
      completion,
      reopened,
      readyForWinner: advanced.readyForWinner,
      winnerUid: resolution.winnerUid,
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
        : { status: "completed", result: committed.previousResult },
    after: {
      status: change.action === "clear" ? "scheduled" : "completed",
      result:
        change.action === "clear"
          ? null
          : { homeGoals: change.homeGoals, awayGoals: change.awayGoals },
      tieId: committed.tieId,
      tieStatus: committed.status,
      aggregate: committed.aggregate,
      ...(change.action === "correct" ? { editCount: committed.editCount } : {}),
    },
    reason: change.reason,
  });

  if (committed.reopened) {
    await writeAuditLog({
      actorUid: access.user.userId,
      actorRole: access.user.role,
      action: "tournament.knockout.reopened",
      targetType: "tournament",
      targetId: tournamentId,
      tournamentId,
      before: { status: "completed" },
      after: { status: "knockout" },
      reason: change.reason,
    });
  }

  const link = `/tournaments/${committed.tournament.slug}/matches/${matchId}`;
  const scoreText =
    change.homeGoals === null || change.awayGoals === null
      ? "The score was cleared."
      : `The score is ${change.homeGoals}-${change.awayGoals}.`;
  const title =
    change.action === "clear"
      ? "Knockout result cleared"
      : change.action === "correct"
        ? "Knockout result corrected"
        : "Knockout result recorded";

  await notify({
    recipients: [committed.homeUid, committed.awayUid],
    type: "result_recorded",
    title,
    body: `${committed.tournament.name}: ${scoreText} Your tie is now ${committed.status.replace("_", " ")}.`,
    link,
    email: {
      paragraphs: [
        `${committed.tournament.name}: ${scoreText}`,
        `Your tie is now ${committed.status.replace("_", " ")}.`,
      ],
      buttonLabel: "View your tie",
    },
  }).catch(() => undefined);

  if (change.action !== "clear" && committed.readyForWinner && committed.winnerUid) {
    const next = committed.readyForWinner;

    await notify({
      recipients: committed.winnerUid,
      type: "knockout_tie_ready",
      title: "Your next knockout tie is ready",
      body: `${committed.tournament.name}: your next tie is ready against @${next.opponentTag}.`,
      link: `/tournaments/${committed.tournament.slug}`,
      email: {
        heading: "Your next knockout tie is ready",
        paragraphs: [
          `${committed.tournament.name}: your next tie is ready.`,
          `Opponent: @${next.opponentTag}`,
        ],
        bullets: [`Round: ${next.round.replace("_", " ")}`],
        buttonLabel: "View your tie",
      },
    }).catch(() => undefined);
  }

  if (committed.completion) {
    await announceCompletion(access, tournamentId, committed.tournament, committed.completion);
    await finaliseTournamentCompletion(tournamentId).catch((error) => {
      console.error("finaliseTournamentCompletion failed", error);
    });
  } else {
    await refreshPlayersStats([committed.homeUid, committed.awayUid]).catch(() => undefined);
  }
}

async function enterKnockoutMatchResultWrite(
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

async function correctKnockoutMatchResultWrite(
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

async function clearKnockoutMatchResultWrite(
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

// Re-exported so the route layer can surface the champion after a final result.
export { completionFromTie };

export const enterKnockoutMatchResult = withPublicInvalidation(enterKnockoutMatchResultWrite);
export const correctKnockoutMatchResult = withPublicInvalidation(correctKnockoutMatchResultWrite);
export const clearKnockoutMatchResult = withPublicInvalidation(clearKnockoutMatchResultWrite);
