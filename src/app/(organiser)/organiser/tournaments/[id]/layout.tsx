// GCC - tournament workspace layout.
//
// Every tool below this layout is scoped to one tournament. The guard reads
// ownership from the server document: another organiser's id renders the
// branded 404 exactly like a missing id, so no competition's existence leaks.
import { ExternalLink, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { WorkspaceStepper } from "@/components/organiser/workspace-stepper";
import { WorkspaceTabs } from "@/components/organiser/workspace-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, StatusPill } from "@/components/ui/card";
import { getGame } from "@/lib/config/games";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import { AuthorizationError, NotFoundError } from "@/lib/auth/guards";
import { isPubliclyListedStatus } from "@/lib/data/public-tournaments";
import { getTournamentWorkspace } from "@/lib/organiser/workspace-access";
import { getWorkspaceSteps, getWorkspaceTabs } from "@/lib/tournament/workspace";
import { formatDate } from "@/lib/utils/dates";

interface TournamentWorkspaceLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: TournamentWorkspaceLayoutProps) {
  const { id } = await params;

  try {
    const { tournament } = await getTournamentWorkspace(id);
    return { title: `${tournament.name} — Organiser workspace` };
  } catch {
    return { title: "Tournament workspace" };
  }
}

export default async function TournamentWorkspaceLayout({
  children,
  params,
}: TournamentWorkspaceLayoutProps) {
  const { id } = await params;

  let tournament;

  try {
    tournament = (await getTournamentWorkspace(id)).tournament;
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      // Not owned (or not real): identical branded 404, no 403 information leak.
      notFound();
    }

    throw error;
  }

  const meta = TOURNAMENT_STATUS_META[tournament.status];
  const game = getGame(tournament.gameId);
  const steps = getWorkspaceSteps(tournament);
  const tabs = getWorkspaceTabs(tournament);
  const isPublic = isPubliclyListedStatus(tournament.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${game.name}${tournament.season ? ` · ${tournament.season}` : ""}`}
        title={tournament.name}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Organiser", href: "/organiser" },
          { label: "Tournaments", href: "/organiser/tournaments" },
          { label: tournament.name },
        ]}
        actions={
          isPublic ? (
            <Link
              href={`/tournaments/${tournament.slug}`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              View public page
            </Link>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={meta.tone} pulse={meta.live}>
          {meta.label}
        </StatusPill>
        <Badge tone="neutral">{game.name}</Badge>
        <Badge tone="info">
          <Users aria-hidden="true" className="h-3.5 w-3.5" />
          {tournament.registrationCount} / {tournament.maxParticipants} registered
        </Badge>
        {tournament.startsAt ? (
          <Badge tone="neutral">Starts {formatDate(tournament.startsAt.toDate())}</Badge>
        ) : null}
      </div>

      <section
        aria-label="Lifecycle"
        className="rounded-xl border border-white/10 bg-navy-900/40 p-4"
      >
        <WorkspaceStepper steps={steps} />
      </section>

      <WorkspaceTabs tournamentId={id} tabs={tabs} />

      <div className="min-w-0">{children}</div>
    </div>
  );
}
