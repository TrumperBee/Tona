// GCC - public, shareable match page.
//
// Shows only public tournament and public-profile data. A match page exists only
// while its tournament's fixtures are public, and it never substitutes a sample
// score for a match that has not been recorded.
import { ArrowLeft, CalendarDays, Flag, Swords, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/data-display";
import { countryFlag, countryName } from "@/lib/config/countries";
import { getPublicMatch } from "@/lib/data/public-match";
import { formatDate, formatDateTime } from "@/lib/utils/dates";

interface MatchPageProps {
  readonly params: Promise<{ slug: string; matchId: string }>;
}

export async function generateMetadata({ params }: MatchPageProps) {
  const { slug, matchId } = await params;
  const match = await getPublicMatch(slug, matchId);

  if (!match) {
    return { title: "Match" };
  }

  const score =
    match.status === "completed" && match.homeGoals !== null && match.awayGoals !== null
      ? `${match.home.gamerTag} ${match.homeGoals} - ${match.awayGoals} ${match.away.gamerTag}`
      : `${match.home.gamerTag} vs ${match.away.gamerTag}`;

  return {
    title: `${score} · ${match.tournamentName}`,
    description:
      match.status === "completed"
        ? `${score} on matchday ${match.matchday} of ${match.tournamentName}.`
        : `${score} on matchday ${match.matchday} of ${match.tournamentName}. The result has not been recorded yet.`,
    openGraph: {
      title: `${score} · ${match.tournamentName}`,
      description: `Matchday ${match.matchday} · ${match.tournamentName}`,
      type: "website",
    },
  };
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { slug, matchId } = await params;
  const match = await getPublicMatch(slug, matchId);

  if (!match) {
    notFound();
  }

  const completed =
    match.status === "completed" && match.homeGoals !== null && match.awayGoals !== null;
  const homeLabel = match.home.gamerTag;
  const awayLabel = match.away.gamerTag;

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-14">
          <PageHeader
            eyebrow={match.tournamentName}
            title={`${homeLabel} vs ${awayLabel}`}
            description={`Matchday ${match.matchday} · ${match.tournamentName}`}
            breadcrumbs={[
              { label: "Tournaments", href: "/tournaments" },
              { label: match.tournamentName, href: `/tournaments/${match.tournamentSlug}` },
              { label: "Match" },
            ]}
            actions={
              <Link
                href={`/tournaments/${match.tournamentSlug}`}
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Back to tournament
              </Link>
            }
          />
        </div>
      </section>

      <section>
        <div className="container py-10 sm:py-14">
          <Card variant="elevated">
            <CardContent className="p-6 sm:p-8">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
                <div className="flex flex-col items-center text-center">
                  <Avatar name={homeLabel} src={match.home.avatarUrl} size="xl" />
                  <Link
                    href={`/players/${encodeURIComponent(homeLabel)}`}
                    className="mt-3 text-base font-semibold text-white underline-offset-4 hover:underline"
                  >
                    {homeLabel}
                  </Link>
                  {match.home.country ? (
                    <p className="mt-1 text-xs text-grey-500">
                      <span aria-hidden="true">{countryFlag(match.home.country)}</span>{" "}
                      {countryName(match.home.country) ?? match.home.country}
                    </p>
                  ) : null}
                  <Badge tone="neutral" className="mt-2">
                    Home
                  </Badge>
                </div>

                <div className="text-center">
                  {completed ? (
                    <p className="font-display text-5xl font-semibold tabular-nums text-white sm:text-6xl">
                      {match.homeGoals}
                      <span className="mx-1 text-grey-500">–</span>
                      {match.awayGoals}
                    </p>
                  ) : (
                    <p className="font-display text-3xl font-semibold uppercase tracking-display text-grey-400">
                      vs
                    </p>
                  )}
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                    Matchday {match.matchday}
                  </p>
                  <Badge tone={completed ? "success" : "neutral"} className="mt-2">
                    {completed ? "Completed" : "Scheduled"}
                  </Badge>
                </div>

                <div className="flex flex-col items-center text-center">
                  <Avatar name={awayLabel} src={match.away.avatarUrl} size="xl" />
                  <Link
                    href={`/players/${encodeURIComponent(awayLabel)}`}
                    className="mt-3 text-base font-semibold text-white underline-offset-4 hover:underline"
                  >
                    {awayLabel}
                  </Link>
                  {match.away.country ? (
                    <p className="mt-1 text-xs text-grey-500">
                      <span aria-hidden="true">{countryFlag(match.away.country)}</span>{" "}
                      {countryName(match.away.country) ?? match.away.country}
                    </p>
                  ) : null}
                  <Badge tone="neutral" className="mt-2">
                    Away
                  </Badge>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-grey-500">
                <span className="flex items-center gap-1.5">
                  <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
                  {match.scheduledAt
                    ? formatDate(match.scheduledAt, { timeZone: match.timezone })
                    : "Date to be confirmed"}
                </span>
                {completed ? (
                  <span className="flex items-center gap-1.5">
                    <Trophy aria-hidden="true" className="h-3.5 w-3.5" />
                    {match.enteredByTag
                      ? `Recorded by ${match.enteredByTag}`
                      : "Result recorded by an admin"}
                    {match.enteredAt ? ` · ${formatDateTime(match.enteredAt)}` : ""}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Swords aria-hidden="true" className="h-3.5 w-3.5" />
                    The result has not been recorded yet.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-grey-400">
            <Flag aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-electric-300" />
            <p>
              Results are entered only by the tournament owner or a Super Admin. If you played in
              this match and believe the score is wrong, open{" "}
              <Link
                href="/dashboard/fixtures"
                className="font-semibold text-electric-300 underline-offset-4 hover:underline"
              >
                My fixtures
              </Link>{" "}
              and use “Report a problem”.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
