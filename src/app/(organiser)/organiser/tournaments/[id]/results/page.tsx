// GCC - organiser result entry.
//
// The workspace layout renders the guard, header, stepper and tabs. This page
// loads only this tournament's published matches and 36 registrations, then
// hands them to the client board. Players never reach this route with write
// rights; the server module also enforces ownership on every mutation.
import { ClipboardList } from "lucide-react";
import { notFound } from "next/navigation";

import { ResultsBoard } from "@/components/organiser/results-board";
import { WorkspaceToolNotice } from "@/components/organiser/workspace-tool-notice";
import { AuthorizationError, NotFoundError } from "@/lib/auth/guards";
import { getOrganiserResults } from "@/lib/tournament/results";
import { isResultEntryTournamentStatus } from "@/lib/tournament/result-state";
import { firstQueryValue } from "@/lib/super-admin/query";

export const metadata = { title: "Results" };

interface ResultsPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResultsPage({ params, searchParams }: ResultsPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const initialMatchId = firstQueryValue(query.match);

  let view: Awaited<ReturnType<typeof getOrganiserResults>>;

  try {
    view = await getOrganiserResults(id);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  if (!isResultEntryTournamentStatus(view.tournament.status)) {
    return (
      <WorkspaceToolNotice
        icon={ClipboardList}
        title="Results"
        description="Record final scores as the tournament owner or Super Admin. A recorded result updates the league table immediately; corrections require a reason and are kept in the audit history."
        availabilityTitle="Result recording is not open at this stage"
        availabilityDescription="Publish the league-phase fixtures first. Results are recorded only while the competition is at fixtures published or in the league phase."
      />
    );
  }

  return (
    <ResultsBoard
      tournamentId={id}
      timezone={view.tournament.timezone}
      matches={view.matches}
      players={view.players}
      initialMatchId={initialMatchId}
    />
  );
}
