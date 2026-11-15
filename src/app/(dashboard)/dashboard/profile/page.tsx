// GCC - own profile.
//
// Reads the server-written private profile, public profile and membership
// snapshots. Statistics are real values (zero for a new account), never sample
// numbers. The avatar control uploads through the server route.
import {
  CalendarDays,
  ChevronRight,
  Gamepad2,
  Globe2,
  ListOrdered,
  Pencil,
  Swords,
  Trophy,
} from "lucide-react";
import Link from "next/link";

import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { CursorNav } from "@/components/super-admin/cursor-nav";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompactListRow } from "@/components/ui/compact-list-row";
import { Avatar, EmptyState } from "@/components/ui/data-display";
import { SectionCard } from "@/components/ui/section-card";
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

      <Card variant="elevated" className="overflow-hidden">
        <div
          aria-hidden="true"
          className="h-20 bg-gradient-to-r from-electric-500/25 via-navy-800 to-gold-400/20 sm:h-24"
        />
        <div className="-mt-12 flex flex-col items-center gap-4 px-4 pb-5 text-center sm:-mt-14 sm:flex-row sm:items-end sm:gap-6 sm:px-6 sm:text-left">
          <AvatarUploader
            name={privateProfile.gamerTag}
            initialAvatarUrl={privateProfile.avatarUrl}
          />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
              Gamer tag
            </p>
            <h2 className="mt-1 break-words font-display text-3xl font-semibold uppercase tracking-display text-white sm:text-4xl">
              @{privateProfile.gamerTag}
            </h2>
            <p className="mt-1 text-sm text-grey-400">{privateProfile.fullName}</p>
            <p className="mt-3 text-sm leading-6 text-grey-300">
              {privateProfile.community
                ? `${privateProfile.community} · ${game.name}`
                : `Playing ${game.name}${platform ? ` on ${platform.name}` : ""}.`}
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
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

            <p className="mt-4 text-xs leading-5 text-grey-400">
              Gamer tags are permanent. Contact the GCC team if your tag contains a mistake.
            </p>
          </div>
        </div>
      </Card>

      <section>
        <SectionHeading
          title="Competitive record"
          description="Pulled from your public profile. New accounts show zero until an admin records a real match."
        />
        <SectionCard
          id="competitive-record"
          className="mt-4"
          bodyClassName="p-3 sm:p-5"
          title="Season totals"
        >
          <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { label: "Wins", value: stats?.wins ?? 0 },
              { label: "Draws", value: stats?.draws ?? 0 },
              { label: "Losses", value: stats?.losses ?? 0 },
              { label: "Win rate", value: winRate },
              { label: "Goals for", value: stats?.goalsFor ?? 0 },
              { label: "Goals against", value: stats?.goalsAgainst ?? 0 },
              { label: "Tournaments", value: stats?.tournaments ?? 0 },
              { label: "Platform rank", value: "Unranked" },
            ].map((tile) => (
              <div
                key={tile.label}
                className="rounded-lg border border-white/10 bg-navy-950/50 px-3 py-3 text-center"
              >
                <dt className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
                  {tile.label}
                </dt>
                <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-white">
                  {tile.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 px-1 text-xs leading-5 text-grey-400">
            {played > 0
              ? "Recorded from completed matches only."
              : "No matches recorded yet, so every total is a real zero."}{" "}
            The rating system opens in a later phase; no placeholder rank is shown.
          </p>
        </SectionCard>
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
        <div className="mt-4">
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
            <SectionCard id="my-tournaments" bodyClassName="p-0">
              <ul className="divide-y divide-white/10">
                {memberships.map((membership) => {
                  const status = TOURNAMENT_STATUS_META[membership.status];

                  return (
                    <li key={membership.tournamentId}>
                      <CompactListRow
                        href={`/tournaments/${membership.slug}`}
                        ariaLabel={`Open ${membership.name}, ${getGame(membership.gameId).name}, ${status.label}`}
                        leading={
                          <span className="grid h-10 w-10 place-items-center rounded-lg border border-electric-400/20 bg-electric-500/10 text-electric-300">
                            <Trophy aria-hidden="true" className="h-5 w-5" />
                          </span>
                        }
                        title={membership.name}
                        subtitle={getGame(membership.gameId).name}
                        trailing={
                          <span className="flex items-center gap-2">
                            <Badge tone={status.tone}>{status.label}</Badge>
                            <ChevronRight aria-hidden="true" className="h-4 w-4 text-grey-500" />
                          </span>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
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
                        <p className="mt-1 text-xs text-grey-400">
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
                            <p className="mt-1 text-xs text-grey-400">
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
                            <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
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
                            <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                              Score
                            </p>
                            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-white">
                              {match.homeGoals}–{match.awayGoals}
                            </p>
                            <Link
                              href={`/tournaments/${match.tournamentSlug}/matches/${match.matchId}`}
                              className="text-xs font-semibold text-electric-300 underline-offset-4 hover:underline"
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
