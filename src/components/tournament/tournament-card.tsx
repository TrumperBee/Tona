// GCC - tournament summary card. All values are real server data.
import Link from "next/link";
import { ArrowRight, CalendarDays, Users } from "lucide-react";

import { OrganisedBy } from "@/components/tournament/organised-by";
import { Badge, Card, StatusPill } from "@/components/ui/card";
import { getGame } from "@/lib/config/games";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import type { PublicTournamentSummary } from "@/lib/data/public-tournaments";
import { formatDate } from "@/lib/utils/dates";

export function TournamentCard({ tournament }: { readonly tournament: PublicTournamentSummary }) {
  const game = getGame(tournament.gameId);
  const meta = TOURNAMENT_STATUS_META[tournament.status];
  const start = tournament.startsAt ? formatDate(tournament.startsAt) : null;

  return (
    <Card
      variant="elevated"
      className="group relative flex h-full flex-col overflow-hidden transition-colors hover:border-electric-400/30"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 p-5">
        <Badge tone="neutral">{game.name}</Badge>
        <StatusPill tone={meta.tone} pulse={tournament.status === "league_phase"}>
          {meta.label}
        </StatusPill>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
          {tournament.season || "Season to be confirmed"}
        </p>
        <h3 className="mt-2 font-display text-2xl font-semibold uppercase leading-tight tracking-display text-white">
          <Link
            href={`/tournaments/${tournament.slug}`}
            className="rounded after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
          >
            {tournament.name}
          </Link>
        </h3>

        <dl className="mt-4 space-y-2 text-sm text-grey-400">
          {start ? (
            <div className="flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="h-4 w-4 text-grey-500" />
              <dt className="sr-only">Starts</dt>
              <dd>Starts {start}</dd>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Users aria-hidden="true" className="h-4 w-4 text-grey-500" />
            <dt className="sr-only">Registration</dt>
            <dd>
              {tournament.registrationCount} / {tournament.maxParticipants} registered
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Organiser</dt>
            <dd>
              <OrganisedBy ownerUid={tournament.ownerUid} />
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex items-center justify-between gap-3 pt-6">
          <span className="text-xs font-semibold uppercase tracking-eyebrow text-electric-300">
            View tournament
          </span>
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 text-electric-300 transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </div>
    </Card>
  );
}
