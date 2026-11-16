// GCC - organiser knockout workspace.
//
// The server loads the frozen league progress and the generated bracket behind
// the ownership guard. The client board only sends explicit generate, generate
// reset, leg result and decider actions; it never supplies a tie, a seed, a
// participant or a match id.
import { notFound } from "next/navigation";

import { KnockoutBoard } from "@/components/organiser/knockout-board";
import { AuthorizationError, NotFoundError } from "@/lib/auth/guards";
import { getOrganiserKnockout } from "@/lib/tournament/knockout";

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

  return (
    <KnockoutBoard
      tournamentId={id}
      tournamentStatus={view.tournament.status}
      leagueMatchesCompleted={view.leagueMatchesCompleted}
      leagueMatchesTotal={view.leagueMatchesTotal}
      generated={view.generated}
      seed={view.seed}
      legs={view.legs}
      bracketHash={view.bracketHash}
      ties={view.ties}
      championTag={view.championTag}
      runnerUpTag={view.runnerUpTag}
      qualifiers={view.qualifiers}
    />
  );
}
