// GCC - public tournament detail.
// Real Firestore data only. Sections that need fixtures, standings or results
// say so honestly rather than showing a sample table.
import {
  ArrowLeft,
  CalendarDays,
  CircleDot,
  Clock,
  Gamepad2,
  ListChecks,
  MapPin,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { EHubMarketPromo } from "@/components/marketplace/ehubmarket-promo";
import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle, StatusPill } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { getGame } from "@/lib/config/games";
import { getTournamentFormat } from "@/lib/config/formats";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import { getPublicTournamentBySlug } from "@/lib/data/public-tournaments";
import { formatDate, formatDateTime, isIanaTimezone } from "@/lib/utils/dates";

interface TournamentPageProps {
  params: Promise<{ slug: string }>;
}

const getTournament = cache(getPublicTournamentBySlug);

export async function generateMetadata({ params }: TournamentPageProps) {
  const { slug } = await params;
  const tournament = await getTournament(slug);

  if (!tournament) {
    return { title: "Tournament not found" };
  }

  return {
    title: tournament.name,
    description:
      tournament.description ||
      `${tournament.name} on GCC: format, dates, status and registration information.`,
    openGraph: {
      title: tournament.name,
      description:
        tournament.description ||
        `${tournament.name} on GCC: format, dates, status and registration information.`,
    },
  };
}

export default async function TournamentPage({ params }: TournamentPageProps) {
  const { slug } = await params;
  const tournament = await getTournament(slug);

  if (!tournament) {
    notFound();
  }

  const game = getGame(tournament.gameId);
  const meta = TOURNAMENT_STATUS_META[tournament.status];
  const format = getTournamentFormat(tournament.formatId);
  const timezone = isIanaTimezone(tournament.timezone) ? tournament.timezone : "UTC";
  const registrationOpen = tournament.status === "registration_open";
  const spotsLeft = Math.max(tournament.maxParticipants - tournament.registrationCount, 0);

  const facts = [
    { label: "Game", value: game.name, icon: Gamepad2 },
    { label: "Season", value: tournament.season || "To be confirmed", icon: CalendarDays },
    { label: "Format", value: format?.name ?? "36-team league phase", icon: CircleDot },
    {
      label: "Field size",
      value: `${tournament.registrationCount} / ${tournament.maxParticipants} registered`,
      icon: Users,
    },
    {
      label: "Starts",
      value: tournament.startsAt
        ? formatDateTime(tournament.startsAt, { timeZone: timezone })
        : "To be confirmed",
      icon: CalendarDays,
    },
    {
      label: "Time zone",
      value: timezone,
      icon: MapPin,
    },
  ] as const;

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow={`${game.name} · ${tournament.season || "Season to be confirmed"}`}
            title={tournament.name}
            description={
              tournament.description ||
              "The organiser has not published a description for this competition yet."
            }
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Tournaments", href: "/tournaments" },
              { label: tournament.name },
            ]}
            actions={
              registrationOpen ? (
                <Link
                  href={`/tournaments/${tournament.slug}/register`}
                  className={buttonStyles({ size: "md" })}
                >
                  Registration details
                  <ArrowLeft aria-hidden="true" className="h-4 w-4 rotate-180" />
                </Link>
              ) : (
                <Link
                  href="/tournaments"
                  className={buttonStyles({ variant: "secondary", size: "md" })}
                >
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  All tournaments
                </Link>
              )
            }
          />

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <StatusPill tone={meta.tone} pulse={meta.live}>
              {meta.label}
            </StatusPill>
            <Badge tone="neutral">{game.name}</Badge>
            {format ? <Badge tone="info">{format.participants} teams</Badge> : null}
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-grey-400">{meta.description}</p>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container grid gap-6 py-10 lg:grid-cols-[1.4fr_0.6fr] lg:items-start">
          <div className="space-y-6">
            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Competition facts</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {facts.map((fact) => {
                    const Icon = fact.icon;

                    return (
                      <div
                        key={fact.label}
                        className="flex items-start gap-3 rounded-lg border border-white/10 bg-navy-950/50 p-3.5"
                      >
                        <Icon
                          aria-hidden="true"
                          className="mt-0.5 h-4 w-4 shrink-0 text-grey-500"
                        />
                        <div className="min-w-0">
                          <dt className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                            {fact.label}
                          </dt>
                          <dd className="mt-0.5 text-sm font-medium text-grey-100">{fact.value}</dd>
                        </div>
                      </div>
                    );
                  })}
                </dl>

                {tournament.registrationOpensAt || tournament.registrationClosesAt ? (
                  <p className="mt-4 text-xs leading-5 text-grey-500">
                    {tournament.registrationOpensAt
                      ? `Registration opened ${formatDate(tournament.registrationOpensAt, { timeZone: timezone })}. `
                      : null}
                    {tournament.registrationClosesAt
                      ? `Registration closes ${formatDateTime(tournament.registrationClosesAt, { timeZone: timezone })}.`
                      : null}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rules</CardTitle>
              </CardHeader>
              <CardContent>
                {tournament.rules ? (
                  <p className="whitespace-pre-line text-sm leading-7 text-grey-300">
                    {tournament.rules}
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-grey-400">
                    The organiser has not published the competition rules yet. Rules will appear
                    here before registration opens or before the first fixture is played.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <EmptyState
                size="sm"
                icon={Swords}
                title="Fixtures not published"
                description="When the organiser confirms the field and publishes fixtures, every matchday appears here with real home and away assignments."
              />
              <EmptyState
                size="sm"
                icon={ListChecks}
                title="No standings yet"
                description="The league table is generated from verified results. It is never filled with sample scores."
              />
            </div>
          </div>

          <aside className="space-y-4">
            <Card variant="gold" className="p-5">
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
                Registration
              </p>
              <p className="mt-2 font-display text-3xl font-semibold text-white">
                {tournament.registrationCount}
                <span className="ml-1 text-base font-medium text-grey-400">
                  / {tournament.maxParticipants}
                </span>
              </p>
              <p className="mt-1 text-sm text-grey-400">
                {registrationOpen
                  ? spotsLeft > 0
                    ? `${spotsLeft} ${spotsLeft === 1 ? "place" : "places"} remaining`
                    : "The field is full"
                  : meta.description}
              </p>
              {registrationOpen ? (
                <Link
                  href={`/tournaments/${tournament.slug}/register`}
                  className={buttonStyles({ size: "sm", className: "mt-5 w-full" })}
                >
                  How to register
                </Link>
              ) : null}
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 text-electric-300" />
                <p className="text-sm font-semibold text-white">Verified record</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-grey-400">
                Results and standings are stored by the platform, not calculated in the browser.
                Corrections are recorded with an audit entry.
              </p>
            </Card>

            {tournament.matchDurationMinutes ? (
              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <Clock aria-hidden="true" className="h-4 w-4 text-grey-400" />
                  <p className="text-sm font-semibold text-white">Match length</p>
                </div>
                <p className="mt-1 font-display text-2xl font-semibold text-white">
                  {tournament.matchDurationMinutes} min
                </p>
                <p className="mt-1 text-xs text-grey-500">
                  Per match, as published by the organiser.
                </p>
              </Card>
            ) : null}

            {format ? (
              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <Trophy aria-hidden="true" className="h-4 w-4 text-gold-300" />
                  <p className="text-sm font-semibold text-white">Qualification</p>
                </div>
                <ul className="mt-3 space-y-2 text-xs text-grey-400">
                  {format.qualification.map((band) => (
                    <li key={band.id} className="flex items-center justify-between gap-3">
                      <span>
                        {band.fromPosition}–{band.toPosition}
                      </span>
                      <span className="text-right font-medium text-grey-300">{band.label}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </aside>
        </div>
      </section>

      <section>
        <div className="container py-10 sm:py-14">
          <EHubMarketPromo />
        </div>
      </section>
    </>
  );
}
