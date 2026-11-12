// GCC - organiser league table.
//
// The workspace layout renders the guard, header, stepper and tabs. This page
// loads the server-written table and offers only the integrity actions; there
// is no manual row editor anywhere in the product.
import { ListOrdered } from "lucide-react";
import { notFound } from "next/navigation";

import { StandingsActions } from "@/components/organiser/standings-actions";
import { WorkspaceToolNotice } from "@/components/organiser/workspace-tool-notice";
import { StandingsTable } from "@/components/tournament/standings-table";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { AuthorizationError, NotFoundError } from "@/lib/auth/guards";
import { TIEBREAKER_PROFILE_LABELS } from "@/lib/engine/standings/types";
import { isFixturesPublicStatus } from "@/lib/data/public-fixtures";
import { getOrganiserStandings } from "@/lib/tournament/standings";

export const metadata = { title: "Standings" };

interface StandingsPageProps {
  readonly params: Promise<{ id: string }>;
}

export default async function StandingsPage({ params }: StandingsPageProps) {
  const { id } = await params;

  let view: Awaited<ReturnType<typeof getOrganiserStandings>>;

  try {
    view = await getOrganiserStandings(id);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  if (!isFixturesPublicStatus(view.tournament.status)) {
    return (
      <WorkspaceToolNotice
        icon={ListOrdered}
        title="Standings"
        description="The league table is generated from recorded results. It becomes visible to players and spectators at the same moment fixtures are published."
        availabilityTitle="Standings are not available yet"
        availabilityDescription="Publish the league-phase fixtures first. Every result then rebuilds the table inside the same transaction."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
              League table
            </p>
            <p className="mt-1 text-sm leading-6 text-grey-300">
              {view.rows.length} players · {view.tournament.leagueMatchesCompleted ?? 0} of 144
              league matches recorded
            </p>
          </div>
          <p className="text-xs text-grey-500">
            Tie-break:{" "}
            <span className="font-semibold text-grey-300">
              {TIEBREAKER_PROFILE_LABELS[view.profile]}
            </span>
          </p>
        </CardContent>
      </Card>

      {view.rows.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="The table is not built yet"
          description="Publish the fixture list to create the 36 zero-match rows. They are ordered by the stored drawing of lots until results arrive."
        />
      ) : (
        <StandingsTable
          rows={view.rows}
          profile={view.profile}
          provisional={view.provisional}
          updatedAt={view.updatedAt}
        />
      )}

      <StandingsActions tournamentId={id} />
    </div>
  );
}
