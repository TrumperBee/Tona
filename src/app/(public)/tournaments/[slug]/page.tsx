// GCC - public tournament detail.
//
// Real Firestore data only. The primary registration action is decided by the
// same pure `getRegistrationState` the server uses for the real entry
// decision, combined with the viewer's own session. Cancelled competitions
// stay reachable by direct link and render the cancellation notice only
// (ADR-039 as revised in Phase 8).
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  CircleDot,
  Clock,
  Gamepad2,
  Globe2,
  ListChecks,
  MapPin,
  ShieldCheck,
  Smartphone,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { OrganisedBy } from "@/components/tournament/organised-by";
import { PublicFixturesPanel } from "@/components/tournament/public-fixtures-panel";
import { PublicPotsPanel } from "@/components/tournament/public-pots-panel";
import { PublicSectionTabs } from "@/components/tournament/public-section-tabs";
import { RegisterAction } from "@/components/tournament/register-action";
import { TournamentDates } from "@/components/tournament/tournament-dates";
import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle, StatusPill } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/data-display";
import { Countdown } from "@/components/ui/countdown";
import { getCurrentUser } from "@/lib/auth/guards";
import { PLATFORMS, getGame, getGamePlatforms, type PlatformId } from "@/lib/config/games";
import { getTournamentFormat } from "@/lib/config/formats";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import { countryName } from "@/lib/config/countries";
import {
  getPublicDraw,
  getPublicTournamentBySlug,
  getTournamentParticipants,
  getViewerRegistration,
} from "@/lib/data/public-tournaments";
import { getPublicFixtures } from "@/lib/data/public-fixtures";
import { formatDate } from "@/lib/utils/dates";
import { getRegistrationState } from "@/lib/tournament/registration-state";

interface TournamentPageProps {
  readonly params: Promise<{ slug: string }>;
}

const getTournament = cache(getPublicTournamentBySlug);

export async function generateMetadata({ params }: TournamentPageProps) {
  const { slug } = await params;
  const tournament = await getTournament(slug);

  if (!tournament) {
    return { title: "Tournament not found" };
  }

  const description =
    tournament.description ||
    `${tournament.name} on GCC: format, dates, status and registration information.`;

  return {
    title: tournament.name,
    description,
    openGraph: {
      title: tournament.name,
      description,
      ...(tournament.coverImageUrl ? { images: [{ url: tournament.coverImageUrl }] } : {}),
    },
  };
}

function platformLabel(id: string): string {
  return PLATFORMS.find((platform) => platform.id === id)?.name ?? id;
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
  const timezone = tournament.timezone;
  const state = getRegistrationState(tournament, new Date());
  const cancelled = state === "cancelled";

  // A cancelled competition is reachable by direct link for the notice only.
  if (cancelled) {
    return (
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow={`${game.name} · ${tournament.season || "Season to be confirmed"}`}
            title={tournament.name}
            description="This competition was cancelled by its organiser."
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Tournaments", href: "/tournaments" },
              { label: tournament.name },
            ]}
            actions={
              <Link
                href="/tournaments"
                className={buttonStyles({ variant: "secondary", size: "md" })}
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Browse tournaments
              </Link>
            }
          />

          <div className="mt-8 max-w-xl">
            <EmptyState
              icon={Ban}
              eyebrow="Competition cancelled"
              title="This competition will not be played"
              description="The organiser cancelled this competition. It no longer appears in tournament lists and no new entries are possible. Registered players keep their entry records and were notified by the platform."
            />
          </div>
        </div>
      </section>
    );
  }

  const user = await getCurrentUser();
  const viewerRegistration = user ? await getViewerRegistration(tournament.id, user.userId) : null;
  const spotsLeft = Math.max(tournament.maxParticipants - tournament.registrationCount, 0);
  const fill = Math.min(
    100,
    Math.round((tournament.registrationCount / Math.max(tournament.maxParticipants, 1)) * 100),
  );

  const countdownTarget =
    state === "open" || state === "full"
      ? tournament.registrationClosesAt
      : state === "opens_soon"
        ? tournament.registrationOpensAt
        : null;

  const participants = await getTournamentParticipants(tournament.id);
  const publicDraw = await getPublicDraw(tournament.id);
  const publicFixtures = await getPublicFixtures(tournament.id, tournament.status);

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
        ? formatDate(tournament.startsAt, { timeZone: timezone })
        : "To be confirmed",
      icon: CalendarDays,
    },
    { label: "Time zone", value: timezone, icon: MapPin },
  ] as const;

  return (
    <>
      <section className="relative border-b border-white/10">
        {tournament.coverImageUrl ? (
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tournament.coverImageUrl}
              alt=""
              className="h-full w-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-navy-950/60 to-navy-950" />
          </div>
        ) : null}

        <div className="container relative py-12 sm:py-16">
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
              <Link
                href="/tournaments"
                className={buttonStyles({ variant: "secondary", size: "md" })}
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                All tournaments
              </Link>
            }
          />

          <div className="mt-6 flex flex-wrap items-center gap-4">
            {tournament.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tournament.logoUrl}
                alt={`${tournament.name} logo`}
                className="h-14 w-14 rounded-lg border border-white/15 object-cover"
              />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={meta.tone} pulse={meta.live}>
                {meta.label}
              </StatusPill>
              <Badge tone="neutral">{game.name}</Badge>
              {format ? <Badge tone="info">{format.participants} teams</Badge> : null}
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-grey-400">{meta.description}</p>
          <div className="mt-4">
            <OrganisedBy ownerUid={tournament.ownerUid} />
          </div>
        </div>
      </section>

      <PublicSectionTabs
        pots={publicDraw ? <PublicPotsPanel draw={publicDraw} timezone={timezone} /> : null}
        fixtures={
          publicFixtures ? (
            <PublicFixturesPanel
              matches={publicFixtures.matches}
              matchdays={publicFixtures.matchdays}
              viewerUid={user?.userId ?? null}
              timezone={timezone}
            />
          ) : null
        }
      >
        <section className="border-b border-white/10">
          <div className="container grid gap-6 py-10 lg:grid-cols-[1.4fr_0.6fr] lg:items-start">
            <div className="space-y-6">
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                  <TournamentDates
                    opensAt={tournament.registrationOpensAt}
                    closesAt={tournament.registrationClosesAt}
                    startsAt={tournament.startsAt}
                    timezone={timezone}
                  />
                </CardContent>
              </Card>

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
                            <dd className="mt-0.5 text-sm font-medium text-grey-100">
                              {fact.value}
                            </dd>
                          </div>
                        </div>
                      );
                    })}
                  </dl>

                  {tournament.allowedPlatforms || tournament.allowedCountries ? (
                    <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-navy-950/50 p-3.5">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
                        <Smartphone aria-hidden="true" className="h-4 w-4" />
                        Entry restrictions
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {tournament.allowedPlatforms ? (
                          <>
                            <span className="text-xs text-grey-500">Platforms:</span>
                            {tournament.allowedPlatforms.map((platform) => (
                              <Badge key={platform} tone="neutral">
                                {platformLabel(platform)}
                              </Badge>
                            ))}
                          </>
                        ) : (
                          <span className="text-xs text-grey-500">
                            All platforms (
                            {getGamePlatforms(tournament.gameId)
                              .map((platform: PlatformId) => platformLabel(platform))
                              .join(", ")}
                            ) are welcome.
                          </span>
                        )}
                      </div>
                      {tournament.allowedCountries ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-grey-500">Countries:</span>
                          {tournament.allowedCountries.map((code) => (
                            <Badge key={code} tone="neutral">
                              {countryName(code) ?? code}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-grey-500">
                          Players from every country are welcome.
                        </p>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  {tournament.rules ? (
                    <details className="group">
                      <summary className="cursor-pointer list-none rounded-lg border border-white/10 bg-navy-950/50 p-3.5 text-sm font-semibold text-grey-200 transition-colors hover:text-white">
                        Show the full published rules
                      </summary>
                      <div className="mt-4 max-h-[32rem] overflow-y-auto pr-1">
                        <p className="whitespace-pre-line text-sm leading-7 text-grey-300">
                          {tournament.rules}
                        </p>
                      </div>
                    </details>
                  ) : (
                    <p className="text-sm leading-6 text-grey-400">
                      The organiser has not published the competition rules yet. Rules appear here
                      before registration opens or before the first fixture is played.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Participants</CardTitle>
                </CardHeader>
                <CardContent>
                  {participants.length > 0 ? (
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {participants.map((participant) => (
                        <li key={participant.uid}>
                          <Link
                            href={`/players/${encodeURIComponent(participant.gamerTag)}`}
                            className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-navy-950/50 p-2.5 transition-colors hover:border-electric-400/30"
                          >
                            <Avatar
                              name={participant.gamerTag}
                              src={participant.avatarUrl}
                              size="sm"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-grey-100">
                                {participant.gamerTag}
                              </span>
                              <span className="block text-xs text-grey-500">
                                {participant.country}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm leading-6 text-grey-400">
                      No players are registered yet. Entries appear here the moment players register
                      through the platform.
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                {publicFixtures ? (
                  <Card variant="elevated">
                    <CardHeader>
                      <CardTitle className="text-lg">Fixtures published</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm leading-6 text-grey-400">
                      {publicFixtures.matches.length} matches across eight matchdays. Open the
                      Fixtures tab to browse each matchday and, if you are playing, your own
                      matches.
                    </CardContent>
                  </Card>
                ) : (
                  <EmptyState
                    size="sm"
                    icon={Swords}
                    title="Fixtures not published"
                    description="When the organiser confirms the field and publishes fixtures, every matchday appears here with real home and away assignments."
                  />
                )}
                <EmptyState
                  size="sm"
                  icon={ListChecks}
                  title="No standings yet"
                  description="The league table is generated from verified results. It is never filled with sample scores."
                />
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6">
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
                <div
                  className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={tournament.maxParticipants}
                  aria-valuenow={tournament.registrationCount}
                  aria-label={`${tournament.registrationCount} of ${tournament.maxParticipants} places taken`}
                >
                  <div
                    className="h-full rounded-full bg-electric-400"
                    style={{ width: `${fill}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-grey-400">
                  {state === "open"
                    ? spotsLeft > 0
                      ? `${spotsLeft} ${spotsLeft === 1 ? "place" : "places"} remaining`
                      : "The field is full"
                    : meta.description}
                </p>

                <div className="mt-5">
                  <RegisterAction
                    tournamentId={tournament.id}
                    slug={tournament.slug}
                    state={state}
                    signedIn={Boolean(user)}
                    registered={viewerRegistration !== null}
                    opensAtLabel={
                      tournament.registrationOpensAt
                        ? formatDate(tournament.registrationOpensAt, { timeZone: timezone })
                        : null
                    }
                  />
                </div>
              </Card>

              {countdownTarget ? (
                <Card className="p-5">
                  <Countdown
                    target={countdownTarget}
                    label={
                      state === "opens_soon" ? "Registration opens in" : "Registration closes in"
                    }
                    completeLabel={state === "opens_soon" ? "Opening now" : "Registration closed"}
                  />
                </Card>
              ) : null}

              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4 text-electric-300" />
                  <p className="text-sm font-semibold text-white">Verified record</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-grey-400">
                  Entries, results and standings are stored by the platform, not calculated in the
                  browser. Corrections are recorded with an audit entry.
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

              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <Globe2 aria-hidden="true" className="h-4 w-4 text-grey-400" />
                  <p className="text-sm font-semibold text-white">Time zone</p>
                </div>
                <p className="mt-1 text-xs text-grey-400">
                  All times on this page follow the competition time zone ({timezone}). Switch to
                  your local time in the schedule card.
                </p>
              </Card>
            </aside>
          </div>
        </section>
      </PublicSectionTabs>
    </>
  );
}
