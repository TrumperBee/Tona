// GCC - tournament summary card. All values are real server data.
//
// The effective registration state (open / opens soon / full / closed) is
// computed with the same pure `getRegistrationState` the server uses, so the
// pill never disagrees with the actual entry decision. The countdown targets
// whichever moment matters next: the opening or the closing of registration.
import Link from "next/link";
import { ArrowRight, Building2, CalendarDays, Users } from "lucide-react";

import { Countdown } from "@/components/ui/countdown";
import { Badge, Card, StatusPill } from "@/components/ui/card";
import { getGame } from "@/lib/config/games";
import type { PublicTournamentSummary } from "@/lib/data/public-tournaments";
import { getRegistrationState, type RegistrationState } from "@/lib/tournament/registration-state";
import { formatDate } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

const STATE_PILLS: Readonly<
  Record<
    RegistrationState,
    { label: string; tone: "success" | "info" | "warning" | "danger" | "neutral" }
  >
> = {
  open: { label: "Registration open", tone: "success" },
  opens_soon: { label: "Opens soon", tone: "info" },
  full: { label: "Field full", tone: "warning" },
  closed: { label: "Registration closed", tone: "neutral" },
  not_published: { label: "Not published", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
  suspended: { label: "Suspended", tone: "danger" },
};

export function TournamentCard({ tournament }: { readonly tournament: PublicTournamentSummary }) {
  const game = getGame(tournament.gameId);
  const start = tournament.startsAt ? formatDate(tournament.startsAt) : null;
  const state = getRegistrationState(tournament, new Date());
  const statePill = STATE_PILLS[state];
  const fill = Math.min(
    100,
    Math.round((tournament.registrationCount / Math.max(tournament.maxParticipants, 1)) * 100),
  );

  // Countdown target: while entries are (or will be) possible, the moment that
  // ends the window; once past it, nothing ticks.
  const countdownTarget =
    state === "open" || state === "full"
      ? tournament.registrationClosesAt
      : state === "opens_soon"
        ? tournament.registrationOpensAt
        : null;
  const countdownLabel =
    state === "opens_soon" ? "Registration opens in" : "Registration closes in";

  return (
    <Card
      variant="elevated"
      className="group relative flex h-full flex-col overflow-hidden transition-colors hover:border-electric-400/30"
    >
      {tournament.coverImageUrl ? (
        <div className="relative h-36 w-full overflow-hidden bg-navy-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tournament.coverImageUrl}
            alt=""
            className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4">
            <Badge tone="neutral">{game.name}</Badge>
            <StatusPill tone={statePill.tone} pulse={state === "open"}>
              {statePill.label}
            </StatusPill>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-5">
          <Badge tone="neutral">{game.name}</Badge>
          <StatusPill tone={statePill.tone} pulse={state === "open"}>
            {statePill.label}
          </StatusPill>
        </div>
      )}

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
          {tournament.organisationName ? (
            <div className="flex items-center gap-2">
              <Building2 aria-hidden="true" className="h-4 w-4 shrink-0 text-grey-500" />
              <dt className="sr-only">Organiser</dt>
              <dd>
                <Link
                  href={`/organisers/${tournament.ownerUid}`}
                  className="rounded font-medium text-grey-300 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                >
                  {tournament.organisationName}
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
            <span className="flex items-center gap-1.5">
              <Users aria-hidden="true" className="h-3.5 w-3.5 text-grey-500" />
              {tournament.registrationCount} / {tournament.maxParticipants} registered
            </span>
            <span>{tournament.maxParticipants - tournament.registrationCount} left</span>
          </div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={tournament.maxParticipants}
            aria-valuenow={tournament.registrationCount}
            aria-label={`${tournament.registrationCount} of ${tournament.maxParticipants} places taken`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-colors",
                state === "full" ? "bg-warning" : "bg-electric-400",
              )}
              style={{ width: `${fill}%` }}
            />
          </div>
        </div>

        {countdownTarget ? (
          <Countdown
            className="mt-4"
            size="sm"
            target={countdownTarget}
            label={countdownLabel}
            completeLabel={state === "opens_soon" ? "Opening now" : "Registration closed"}
          />
        ) : null}

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
