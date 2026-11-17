// GCC - own profile.
//
// Reads the server-written private profile, public profile and membership
// snapshots. Statistics are real values (zero for a new account), never sample
// numbers. The avatar control uploads through the server route.
import { CalendarDays, Gamepad2, Globe2, ListOrdered, Pencil, Swords, Trophy } from "lucide-react";
import Link from "next/link";

import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ExportButton } from "@/components/graphics/export-button";
import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { PlayerStatsPanel } from "@/components/stats/player-stats-panel";
import { CursorNav } from "@/components/super-admin/cursor-nav";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SITE_URL } from "@/lib/config/site";
import { graphicBranding, playerCardGraphicData } from "@/lib/graphics/data";
import { qrSvgDataUrl } from "@/lib/graphics/qr";
import { getPlayerHistory, getPlayerRatingCards } from "@/lib/stats/server";
import { buildGameStats, buildTournamentStats } from "@/lib/stats/view";
import { firstQueryValue } from "@/lib/super-admin/query";
import { formatDate } from "@/lib/utils/dates";
import { EMPTY_PROFILE_STATS, PLAYER_FINAL_STAGE_LABELS } from "@/types/domain";

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
  const [profile, history, standings, ratingCards, careerHistory] = await Promise.all([
    getOwnProfile(user.userId),
    getPlayerMatchHistory(user.userId, { after, before }),
    getPlayerStandings(user.userId),
    getPlayerRatingCards(user.userId),
    getPlayerHistory(user.userId, { limit: 50 }),
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
  const stats = publicProfile?.stats.overall ?? EMPTY_PROFILE_STATS.overall;
  const game = getGame(privateProfile.preferredGame);
  const platform = PLATFORMS.find((candidate) => candidate.id === privateProfile.platform);
  const games = buildGameStats(publicProfile?.stats ?? EMPTY_PROFILE_STATS, ratingCards);
  const tournaments = buildTournamentStats(careerHistory);
  const preferredGameStats = games.find((entry) => entry.gameId === privateProfile.preferredGame);
  const profileUrl = `${SITE_URL}/players/${encodeURIComponent(privateProfile.gamerTag)}`;
  const profileQr = await qrSvgDataUrl(profileUrl);
  const profileGraphic = playerCardGraphicData({
    player: {
      uid: user.userId,
      gamerTag: privateProfile.gamerTag,
      avatarUrl: privateProfile.avatarUrl,
    },
    country: privateProfile.country,
    community: privateProfile.community,
    favouriteClub: privateProfile.favouriteClub,
    platform: platform?.name ?? privateProfile.platform,
    game: game.name,
    played: stats.played,
    wins: stats.wins,
    draws: stats.draws,
    losses: stats.losses,
    goalsFor: stats.goalsFor,
    goalsAgainst: stats.goalsAgainst,
    tournaments: stats.tournaments,
    titles: stats.titles,
    winRate: stats.winRate,
    rating: preferredGameStats?.rating ?? null,
    rank: preferredGameStats?.rank ?? null,
    eligible: preferredGameStats?.eligible ?? false,
    ratedMatches: preferredGameStats?.ratedMatches ?? 0,
    profileUrl,
    qrSvg: profileQr,
  });
  const profileBranding = graphicBranding({
    tournamentName: `@${privateProfile.gamerTag}`,
    tournamentSlug: privateProfile.gamerTag,
    gameName: game.name,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Player profile"
        title="Your profile"
        description="Your permanent gamer tag, display details and verified competitive record."
        actions={
          <>
            <Link href="/dashboard/profile/edit" className={buttonStyles({ size: "sm" })}>
              <Pencil aria-hidden="true" className="h-4 w-4" />
              Edit profile
            </Link>
            <ExportButton
              payload={{ template: "player-profile", data: profileGraphic }}
              branding={profileBranding}
              label="Share profile"
              size="sm"
            />
          </>
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
          description="Exact totals recomputed from completed matches. Switch between every competition, one game, or a single completed tournament."
        />
        <div className="mt-4">
          <PlayerStatsPanel overall={stats} games={games} tournaments={tournaments} />
        </div>
      </section>

      <section>
        <SectionHeading
          title="Tournament history"
          description="Your final position in every completed competition. Titles are counted from Hall of Fame entries, never typed in by hand."
        />
        <div className="mt-5">
          {careerHistory.length === 0 ? (
            <EmptyState
              icon={Trophy}
              eyebrow="Tournament history"
              title="No completed tournaments yet"
              description="A tournament appears here with its final position once its final result is recorded and the competition is completed."
            />
          ) : (
            <SectionCard id="tournament-history" bodyClassName="p-0">
              <ul className="divide-y divide-white/10">
                {careerHistory.map((entry) => (
                  <li key={entry.tournamentId}>
                    <div className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
                      <span
                        className={
                          entry.wonTitle
                            ? "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold-400/40 bg-gold-400/10 font-display text-sm font-semibold text-gold-200"
                            : "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.04] font-display text-sm font-semibold text-grey-200"
                        }
                        aria-label={`Final position ${entry.finalPosition}`}
                      >
                        {entry.finalPosition}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/tournaments/${entry.slug}`}
                          className="block truncate text-sm font-semibold text-grey-100 underline-offset-4 hover:underline"
                        >
                          {entry.tournamentName}
                        </Link>
                        <p className="mt-0.5 text-xs text-grey-500">
                          {getGame(entry.gameId).name}
                          {entry.season ? ` · ${entry.season}` : ""}
                          {entry.completedAt ? ` · ${formatDate(entry.completedAt)}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={entry.wonTitle ? "gold" : "neutral"}>
                          {entry.wonTitle ? (
                            <Trophy aria-hidden="true" className="h-3.5 w-3.5" />
                          ) : null}
                          {entry.wonTitle
                            ? "Champion"
                            : PLAYER_FINAL_STAGE_LABELS[entry.finalStage]}
                        </Badge>
                        <span className="text-xs tabular-nums text-grey-400">
                          {entry.wins}W {entry.draws}D {entry.losses}L · {entry.goalsFor}:
                          {entry.goalsAgainst}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
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
            <ul className="flex flex-wrap gap-2">
              {memberships.map((membership) => {
                const status = TOURNAMENT_STATUS_META[membership.status];

                return (
                  <li key={membership.tournamentId}>
                    <Link
                      href={`/tournaments/${membership.slug}`}
                      aria-label={`Open ${membership.name}, ${getGame(membership.gameId).name}, ${status.label}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 text-xs font-semibold text-grey-100 transition-colors hover:border-electric-400/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                    >
                      <Trophy aria-hidden="true" className="h-3.5 w-3.5 text-electric-300" />
                      <span className="max-w-[14rem] truncate">{membership.name}</span>
                      <span className="text-[11px] font-medium text-grey-500">{status.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
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

      <section id="match-history" className="scroll-mt-24">
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
