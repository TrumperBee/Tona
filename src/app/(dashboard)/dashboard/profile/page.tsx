// GCC - own profile.
//
// Reads the server-written private profile, public profile and membership
// snapshots. Statistics are real values (zero for a new account), never sample
// numbers. The avatar control uploads through the server route.
import { CalendarDays, Gamepad2, Globe2, ListOrdered, Pencil, Swords, Trophy } from "lucide-react";
import Link from "next/link";

import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { CursorNav } from "@/components/super-admin/cursor-nav";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState, StatCard } from "@/components/ui/data-display";
import { requirePageSignedIn } from "@/lib/auth/page-access";
import { countryFlag, countryName } from "@/lib/config/countries";
import { getGame, PLATFORMS } from "@/lib/config/games";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import { getPlayerMatchHistory, type MatchOutcome } from "@/lib/data/player-match-history";
import { getPlayerStandings } from "@/lib/data/player-standings";
import { STANDING_BAND_LABELS } from "@/lib/engine/standings/types";
import { getOwnProfile } from "@/lib/profile/server";
import { firstQueryValue } from "@/lib/super-admin/query";
import { formatDate } from "@/lib/utils/dates";

export const metadata = { title: "Profile" };

const OUTCOME_META: Record<
  MatchOutcome,
  { readonly label: string; readonly tone: "success" | "neutral" | "danger" }
> = {
  win: { label: "Win", tone: "success" },
  draw: { label: "Draw", tone: "neutral" },
  loss: { label: "Loss", tone: "danger" },
};

interface ProfilePageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function historyHref(cursor: {
  readonly after?: string | null;
  readonly before?: string | null;
}): string {
  const params = new URLSearchParams();

  if (cursor.after) params.set("after", cursor.after);
  if (cursor.before) params.set("before", cursor.before);

  const query = params.toString();
  return query ? `/dashboard/profile?${query}` : "/dashboard/profile";
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const user = await requirePageSignedIn("/dashboard/profile");
  const params = await searchParams;
  const after = firstQueryValue(params.after);
  const before = firstQueryValue(params.before);
  const [profile, history, standings] = await Promise.all([
    getOwnProfile(user.userId),
    getPlayerMatchHistory(user.userId, { after, before }),
    getPlayerStandings(user.userId),
  ]);

  if (!profile) {
    return (
      <EmptyState
        icon={Globe2}
        eyebrow="Profile"
        title="Your profile document is missing"
        description="Your sign-in works, but the server could not find your player profile. Contact the GCC team so the account can be repaired."
        action={
          <Link href="/contact" className={buttonStyles({ size: "sm" })}>
            Contact the team
          </Link>
        }
      />
    );
  }

  const { user: privateProfile, publicProfile, memberships } = profile;
  const stats = publicProfile?.stats.overall;
  const game = getGame(privateProfile.preferredGame);
  const platform = PLATFORMS.find((candidate) => candidate.id === privateProfile.platform);
  const played = stats?.played ?? 0;
  const wins = stats?.wins ?? 0;
  const winRate = played > 0 ? `${Math.round((wins / played) * 100)}%` : "—";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Player profile"
        title="Your profile"
        description="Your permanent gamer tag, display details and verified competitive record."
        actions={
          <Link href="/dashboard/profile/edit" className={buttonStyles({ size: "sm" })}>
            <Pencil aria-hidden="true" className="h-4 w-4" />
            Edit profile
          </Link>
        }
      />

      <Card variant="elevated">
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
          <AvatarUploader
            name={privateProfile.gamerTag}
            initialAvatarUrl={privateProfile.avatarUrl}
          />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
              Gamer tag
            </p>
            <h2 className="mt-1 font-display text-4xl font-semibold uppercase tracking-display text-white">
              @{privateProfile.gamerTag}
            </h2>
            <p className="mt-1 text-sm text-grey-400">{privateProfile.fullName}</p>
            <p className="mt-3 text-sm leading-6 text-grey-300">
              {privateProfile.community
                ? `${privateProfile.community} · ${game.name}`
                : `Playing ${game.name}${platform ? ` on ${platform.name}` : ""}.`}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="neutral">
                <span aria-hidden="true">{countryFlag(privateProfile.country)}</span>
                {countryName(privateProfile.country)}
              </Badge>
              <Badge tone="info">
                <Gamepad2 aria-hidden="true" className="h-3.5 w-3.5" />
                {game.name}
              </Badge>
              <Badge tone="neutral">{platform?.name ?? privateProfile.platform}</Badge>
            </div>

            <p className="mt-4 text-xs leading-5 text-grey-500">
              Gamer tags are permanent. Contact the GCC team if your tag contains a mistake.
            </p>
          </div>
        </CardContent>
      </Card>

      <section>
        <SectionHeading
          title="Competitive record"
          description="Pulled from your public profile. New accounts show zero until an admin records a real match."
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Wins" value={stats?.wins ?? 0} />
          <StatCard label="Draws" value={stats?.draws ?? 0} />
          <StatCard label="Losses" value={stats?.losses ?? 0} />
          <StatCard
            label="Win rate"
            value={winRate}
            hint={played > 0 ? "From recorded matches." : "Appears after matches are recorded."}
          />
          <StatCard label="Goals for" value={stats?.goalsFor ?? 0} />
          <StatCard label="Goals against" value={stats?.goalsAgainst ?? 0} />
          <StatCard label="Tournaments" value={stats?.tournaments ?? 0} />
          <StatCard
            label="Platform rank"
            value="Unranked"
            hint="The rating system opens in a later phase. No placeholder rank is shown."
          />
        </div>
      </section>

      <section>
        <SectionHeading
          title="My tournaments"
          action={
            <Link
              href="/tournaments"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              Find tournaments
            </Link>
          }
        />
        <div className="mt-5">
          {memberships.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              eyebrow="My tournaments"
              title="No tournament entries yet"
              description="When you enter a real competition it appears here, with its current status and a link to the event."
              action={
                <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
                  Browse tournaments
                </Link>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {memberships.map((membership) => {
                const status = TOURNAMENT_STATUS_META[membership.status];

                return (
                  <Card key={membership.tournamentId}>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{membership.name}</CardTitle>
                          <p className="mt-1 text-xs text-grey-500">
                            {getGame(membership.gameId).name}
                          </p>
                        </div>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Link
                        href={`/tournaments/${membership.slug}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-electric-300 underline-offset-4 hover:underline"
                      >
                        <Trophy aria-hidden="true" className="h-4 w-4" />
                        Open tournament
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionHeading
          title="League positions"
          description="Your current row in every tournament that is at or past its league phase."
        />
        <div className="mt-5">
          {standings.length === 0 ? (
            <EmptyState
              icon={ListOrdered}
              eyebrow="League positions"
              title="No league table yet"
              description="A position appears after the organiser publishes fixtures and the first table is built from recorded results."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {standings.map((standing) => (
                <Card key={standing.tournamentId}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">{standing.name}</CardTitle>
                        <p className="mt-1 text-xs text-grey-500">
                          {STANDING_BAND_LABELS[standing.band]}
                        </p>
                      </div>
                      <p className="font-display text-2xl font-semibold tabular-nums text-white">
                        {standing.position}
                        <span className="ml-1 text-xs font-medium uppercase text-grey-500">
                          pos
                        </span>
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs tabular-nums text-grey-400">
                      {standing.points} pts · MP {standing.played} · W {standing.won} · D{" "}
                      {standing.drawn} · L {standing.lost}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/tournaments/${standing.slug}`}
                        className="text-sm font-semibold text-electric-300 underline-offset-4 hover:underline"
                      >
                        Open table
                      </Link>
                      {standing.provisional ? (
                        <Badge tone="warning">Provisional</Badge>
                      ) : (
                        <Badge tone="success">Final</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionHeading
          title="Match history"
          description="Completed matches from every competition, newest recorded first. Only results entered by a tournament admin appear here."
        />
        <div className="mt-5">
          {history.rows.length === 0 ? (
            <EmptyState
              icon={Swords}
              eyebrow="Match history"
              title="No recorded matches yet"
              description="History is built from results entered by tournament admins. It stays empty until your first real match is recorded."
            />
          ) : (
            <ul className="space-y-3">
              {history.rows.map((match) => {
                const outcome = OUTCOME_META[match.outcome];

                return (
                  <li key={match.cursor}>
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="text-base">
                              <Link
                                href={`/tournaments/${match.tournamentSlug}`}
                                className="underline-offset-4 hover:underline"
                              >
                                {match.tournamentName}
                              </Link>
                            </CardTitle>
                            <p className="mt-1 text-xs text-grey-500">
                              Matchday {match.matchday}
                              {match.recordedAt
                                ? ` · recorded ${formatDate(match.recordedAt)}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={outcome.tone}>{outcome.label}</Badge>
                            <Badge tone={match.isHome ? "info" : "neutral"}>
                              {match.isHome ? "Home" : "Away"}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap items-center gap-3">
                          <Avatar
                            name={match.opponentTag}
                            src={match.opponentAvatarUrl}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                              Opponent
                            </p>
                            <Link
                              href={`/players/${encodeURIComponent(match.opponentTag)}`}
                              className="truncate text-sm font-semibold text-grey-100 underline-offset-4 hover:underline"
                            >
                              @{match.opponentTag}
                            </Link>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                              Score
                            </p>
                            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-white">
                              {match.homeGoals}–{match.awayGoals}
                            </p>
                            <Link
                              href={`/tournaments/${match.tournamentSlug}/matches/${match.matchId}`}
                              className="text-[11px] font-semibold text-electric-300 underline-offset-4 hover:underline"
                            >
                              Open match
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}

          <CursorNav
            previousHref={
              (after || before) && history.firstCursor
                ? historyHref({ before: history.firstCursor })
                : null
            }
            nextHref={
              history.hasMore && history.lastCursor
                ? historyHref({ after: history.lastCursor })
                : null
            }
            summary={`Showing ${history.rows.length} of ${history.total} recorded matches.`}
          />
        </div>
      </section>
    </div>
  );
}
