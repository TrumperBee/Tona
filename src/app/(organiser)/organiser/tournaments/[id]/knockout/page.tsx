// GCC - organiser knockout workspace.
//
// The server loads the frozen league progress, every drawn/published round and
// the private drafts behind the ownership guard. The client board only sends
// explicit draw, publish, result, decider and completion actions; it never
// supplies a tie, a seed or a match id.
import { notFound } from "next/navigation";

import {
  KnockoutBoard,
  type KnockoutBoardRound,
  type KnockoutBoardTie,
} from "@/components/organiser/knockout-board";
import { AuthorizationError, NotFoundError } from "@/lib/auth/guards";
import { getOrganiserKnockout } from "@/lib/tournament/knockout";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata = { title: "Knockout" };

interface KnockoutPageProps {
  readonly params: Promise<{ id: string }>;
}

export default async function KnockoutPage({ params }: KnockoutPageProps) {
  const { id } = await params;

  let view: Awaited<ReturnType<typeof getOrganiserKnockout>>;

  try {
    view = await getOrganiserKnockout(id);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const rounds: KnockoutBoardRound[] = view.rounds.map((round) => ({
    round: round.round,
    label: round.label,
    legs: round.legs,
    published: round.published,
    complete: round.complete,
    draft: round.draft
      ? {
          seed: round.draft.seed,
          legs: round.draft.legs,
          generatedAt: formatDateTime(round.draft.generatedAt.toDate(), {
            timeZone: view.tournament.timezone,
          }),
          generationCount: round.draft.generationCount,
          ties: round.draft.ties.map((tie) => ({
            tieId: tie.tieId,
            bracketSlot: tie.bracketSlot,
            higherSeedTag: tie.higherSeedTag,
            higherSeedPosition: tie.higherSeedPosition,
            lowerSeedTag: tie.lowerSeedTag,
            lowerSeedPosition: tie.lowerSeedPosition,
            group: tie.group,
          })),
        }
      : null,
    ties: round.ties.map((tie): KnockoutBoardTie => ({
      tieId: tie.tieId,
      bracketSlot: tie.bracketSlot,
      legs: tie.legs,
      higherSeedUid: tie.higherSeedUid,
      higherSeedTag: tie.higherSeedTag,
      higherSeedPosition: tie.higherSeedPosition,
      lowerSeedUid: tie.lowerSeedUid,
      lowerSeedTag: tie.lowerSeedTag,
      lowerSeedPosition: tie.lowerSeedPosition,
      group: tie.group,
      status: tie.status,
      aggregate: tie.aggregate,
      legsPlayed: tie.legsPlayed,
      winnerUid: tie.winnerUid,
      decidedBy: tie.decidedBy,
      deciderNote: tie.deciderNote,
      penalties: tie.penalties,
      matches: tie.matches.map((match) => ({
        id: match.id,
        leg: match.leg,
        homeUid: match.homeUid,
        awayUid: match.awayUid,
        homeTag: match.homeTag,
        awayTag: match.awayTag,
        homeGoals: match.homeGoals,
        awayGoals: match.awayGoals,
        status: match.status,
      })),
    })),
  }));

  return (
    <KnockoutBoard
      tournamentId={id}
      tournamentStatus={view.tournament.status}
      leagueMatchesCompleted={view.leagueMatchesCompleted}
      leagueMatchesTotal={view.leagueMatchesTotal}
      leagueClosed={view.leagueClosed}
      rounds={rounds}
      championTag={view.championTag}
      runnerUpTag={view.runnerUpTag}
    />
  );
}
