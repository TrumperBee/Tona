// GCC - a player's cross-tournament fixtures.
//
// Server-rendered from real published matches only. A fixture appears here after
// an organiser publishes a schedule and the player is one of its participants.
// There is no share action: no WhatsApp link, no invented result.
import { CalendarDays, Swords, Trophy } from "lucide-react";
import Link from "next/link";

import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { ReportProblemButton } from "@/components/player/report-problem-button";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState, StatCard } from "@/components/ui/data-display";
import { requirePageSignedIn } from "@/lib/auth/page-access";
import { countryFlag, countryName } from "@/lib/config/countries";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import { getPlayerFixtures } from "@/lib/data/player-fixtures";
import { formatDate } from "@/lib/utils/dates";

export const metadata = { title: "My fixtures" };

export default async function FixturesPage() {
  const user = await requirePageSignedIn("/dashboard/fixtures");
  const fixtures = await getPlayerFixtures(user.userId);

  const completed = fixtures.filter((fixture) => fixture.status === "completed").length;
  const scheduled = fixtures.length - completed;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Player dashboard"
        title="My fixtures"
        description="Every published league-phase and knockout match you are part of, across all competitions. A fixture appears only after its organiser publishes the schedule."
        actions={
          <Link href="/tournaments" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            Find tournaments
          </Link>
        }
      />

      {fixtures.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          eyebrow="My fixtures"
          title="No published fixtures yet"
          description="When you enter a competition, its organiser confirms the field, completes the draw and publishes the schedule. Your matches then appear here with the real opponent, home or away side and status."
          action={
            <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
              Browse tournaments
            </Link>
          }
        />
      ) : (
        <>
          <section>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Total fixtures" value={fixtures.length} icon={Swords} />
              <StatCard label="Scheduled" value={scheduled} icon={CalendarDays} />
              <StatCard
                label="Completed"
                value={completed}
                icon={Trophy}
                hint={
                  completed === 0
                    ? "Scores appear after an admin records a result."
                    : "From recorded match results."
                }
              />
            </div>
          </section>

          <section>
            <SectionHeading
              title="Fixtures"
              description="Ordered by scheduled date and then matchday. Opponents come from their public profiles."
            />
            <ul className="mt-5 space-y-3">
              {fixtures.map((fixture) => {
                const status = TOURNAMENT_STATUS_META[fixture.tournamentStatus];
                const score =
                  fixture.status === "completed" &&
                  fixture.homeGoals !== null &&
                  fixture.awayGoals !== null
                    ? `${fixture.homeGoals}–${fixture.awayGoals}`
                    : null;

                return (
                  <li key={`${fixture.tournamentId}-${fixture.matchId}`}>
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="text-lg">
                              <Link
                                href={`/tournaments/${fixture.tournamentSlug}`}
                                className="underline-offset-4 hover:underline"
                              >
                                {fixture.tournamentName}
                              </Link>
                            </CardTitle>
                            <p className="mt-1 text-xs text-grey-500">
                              {fixture.stage === "league"
                                ? `Matchday ${fixture.matchday}`
                                : `Knockout${fixture.leg ? ` · Leg ${fixture.leg}` : ""}`}{" "}
                              ·{" "}
                              {fixture.scheduledAt
                                ? formatDate(fixture.scheduledAt)
                                : "Date to be confirmed"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={status.tone}>{status.label}</Badge>
                            <Badge tone={fixture.isHome ? "info" : "neutral"}>
                              {fixture.isHome ? "Home" : "Away"}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap items-center gap-3">
                          <Avatar
                            name={fixture.opponentTag}
                            src={fixture.opponentAvatarUrl}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                              Opponent
                            </p>
                            <Link
                              href={`/players/${encodeURIComponent(fixture.opponentTag)}`}
                              className="truncate text-sm font-semibold text-grey-100 underline-offset-4 hover:underline"
                            >
                              @{fixture.opponentTag}
                            </Link>
                            {fixture.opponentCountry ? (
                              <p className="text-xs text-grey-500">
                                <span aria-hidden="true">
                                  {countryFlag(fixture.opponentCountry)}
                                </span>{" "}
                                {countryName(fixture.opponentCountry) ?? fixture.opponentCountry}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                              {score ? "Result" : "Status"}
                            </p>
                            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-white">
                              {score ?? "Scheduled"}
                            </p>
                            <p className="text-[11px] text-grey-500">
                              {fixture.homeTag} vs {fixture.awayTag}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                          <Link
                            href={`/tournaments/${fixture.tournamentSlug}/matches/${fixture.matchId}`}
                            className="text-xs font-semibold text-electric-300 underline-offset-4 hover:underline"
                          >
                            Open match page
                          </Link>
                          {fixture.status === "completed" ? (
                            <ReportProblemButton
                              tournamentId={fixture.tournamentId}
                              matchId={fixture.matchId}
                              matchLabel={`${fixture.homeTag} ${score ?? ""} ${fixture.awayTag}`}
                            />
                          ) : (
                            <p className="text-[11px] text-grey-500">
                              A problem can be reported after a result is recorded.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
