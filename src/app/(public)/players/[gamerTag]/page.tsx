// GCC - public player profile.
//
// Uses ONLY publicProfiles data. The private user document is read server-side
// solely to detect suspended or banned accounts, which show an unavailable
// message rather than a profile. Statistics and history are the server-written
// documents; this page never derives a number of its own.
import { Gamepad2, Globe2, ShieldOff, Swords, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { ExportButton } from "@/components/graphics/export-button";
import { PlayerStatsPanel } from "@/components/stats/player-stats-panel";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/data-display";
import { SectionCard } from "@/components/ui/section-card";
import { countryFlag, countryName } from "@/lib/config/countries";
import { getGame, PLATFORMS } from "@/lib/config/games";
import { SITE_URL } from "@/lib/config/site";
import { graphicBranding, playerCardGraphicData } from "@/lib/graphics/data";
import { qrSvgDataUrl } from "@/lib/graphics/qr";
import { getPublicPlayerByGamerTag } from "@/lib/profile/server";
import { getPlayerHistory, getPlayerRatingCards } from "@/lib/stats/server";
import { buildGameStats, buildTournamentStats } from "@/lib/stats/view";
import { EMPTY_PROFILE_STATS, PLAYER_FINAL_STAGE_LABELS } from "@/types/domain";
import { formatDate } from "@/lib/utils/dates";

interface PlayerPageProps {
  readonly params: Promise<{ gamerTag: string }>;
}

export async function generateMetadata({ params }: PlayerPageProps) {
  const { gamerTag } = await params;
  const player = await getPublicPlayerByGamerTag(gamerTag);

  if (!player) {
    return { title: "Player not found" };
  }

  return {
    title: `@${player.profile.gamerTag}`,
    description: `Public GCC profile for @${player.profile.gamerTag}: country, game, platform and verified competitive record.`,
  };
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { gamerTag } = await params;
  const player = await getPublicPlayerByGamerTag(gamerTag);

  if (!player) {
    notFound();
  }

  if (player.status !== "active") {
    return (
      <section className="container py-12 sm:py-16">
        <EmptyState
          icon={ShieldOff}
          eyebrow="Profile unavailable"
          title="This profile is not available"
          description="The account is suspended or banned, so its public profile is hidden. Existing competition records remain preserved by GCC."
          action={
            <Link href="/players" className={buttonStyles({ size: "sm" })}>
              Search players
            </Link>
          }
        />
      </section>
    );
  }

  const profile = player.profile;
  const [ratingCards, careerHistory] = await Promise.all([
    getPlayerRatingCards(player.uid),
    getPlayerHistory(player.uid, { limit: 50 }),
  ]);
  const stats = profile.stats ?? EMPTY_PROFILE_STATS;
  const games = buildGameStats(stats, ratingCards);
  const tournaments = buildTournamentStats(careerHistory);
  const game = getGame(profile.preferredGame);
  const platform = PLATFORMS.find((candidate) => candidate.id === profile.platform);
  const preferredGameStats = games.find((entry) => entry.gameId === profile.preferredGame);
  const profileUrl = `${SITE_URL}/players/${encodeURIComponent(profile.gamerTag)}`;
  const profileQr = await qrSvgDataUrl(profileUrl);
  const profileGraphic = playerCardGraphicData({
    player: { uid: player.uid, gamerTag: profile.gamerTag, avatarUrl: profile.avatarUrl },
    country: profile.country,
    community: profile.community,
    favouriteClub: profile.favouriteClub,
    platform: platform?.name ?? profile.platform,
    game: game.name,
    played: stats.overall.played,
    wins: stats.overall.wins,
    draws: stats.overall.draws,
    losses: stats.overall.losses,
    goalsFor: stats.overall.goalsFor,
    goalsAgainst: stats.overall.goalsAgainst,
    tournaments: stats.overall.tournaments,
    titles: stats.overall.titles,
    winRate: stats.overall.winRate,
    rating: preferredGameStats?.rating ?? null,
    rank: preferredGameStats?.rank ?? null,
    eligible: preferredGameStats?.eligible ?? false,
    ratedMatches: preferredGameStats?.ratedMatches ?? 0,
    profileUrl,
    qrSvg: profileQr,
  });
  const profileBranding = graphicBranding({
    tournamentName: `@${profile.gamerTag}`,
    tournamentSlug: profile.gamerTag,
    gameName: game.name,
  });

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Public profile"
            title={`@${profile.gamerTag}`}
            description={
              profile.community
                ? `${profile.community} · ${game.name}`
                : `${game.name}${platform ? ` on ${platform.name}` : ""}`
            }
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Players", href: "/players" },
              { label: `@${profile.gamerTag}` },
            ]}
            actions={
              <>
                <Link
                  href={`/players/compare?a=${encodeURIComponent(profile.gamerTag)}`}
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  <Swords aria-hidden="true" className="h-4 w-4" />
                  Compare
                </Link>
                <Link href="/players" className={buttonStyles({ variant: "ghost", size: "sm" })}>
                  Search players
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
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-14">
          <Card variant="elevated">
            <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
              <span className="inline-flex rounded-full ring-2 ring-electric-400 ring-offset-4 ring-offset-navy-950">
                <Avatar
                  name={profile.gamerTag}
                  src={profile.avatarUrl}
                  size="hero"
                  crossOrigin="anonymous"
                />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-4xl font-semibold uppercase tracking-display text-white">
                  @{profile.gamerTag}
                </h2>
                <p className="mt-1 text-sm text-grey-400">
                  {profile.favouriteClub ? `Supports ${profile.favouriteClub}` : "GCC player"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="neutral">
                    <span aria-hidden="true">{countryFlag(profile.country)}</span>
                    {countryName(profile.country)}
                  </Badge>
                  <Badge tone="info">
                    <Gamepad2 aria-hidden="true" className="h-3.5 w-3.5" />
                    {game.name}
                  </Badge>
                  <Badge tone="neutral">{platform?.name ?? profile.platform}</Badge>
                  {stats.overall.titles > 0 ? (
                    <Badge tone="gold">
                      <Trophy aria-hidden="true" className="h-3.5 w-3.5" />
                      {stats.overall.titles} {stats.overall.titles === 1 ? "title" : "titles"}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-14">
          <SectionHeading
            eyebrow="Record"
            title="Verified competitive record"
            description="Exact totals from server-recorded results. Switch between all competitions, one game, or a completed tournament."
          />
          <div className="mt-5">
            <PlayerStatsPanel overall={stats.overall} games={games} tournaments={tournaments} />
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-14">
          <SectionHeading
            eyebrow="Career"
            title="Tournament history"
            description="Every completed competition, with the final position recorded when the tournament ended."
          />
          <div className="mt-5">
            {careerHistory.length === 0 ? (
              <EmptyState
                icon={Trophy}
                eyebrow="Tournament history"
                title="No completed tournaments yet"
                description="A final position appears here after this player's tournament reaches a recorded final result."
              />
            ) : (
              <SectionCard bodyClassName="p-0">
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
        </div>
      </section>

      <section>
        <div className="container py-10 sm:py-14">
          <div className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-grey-400">
            <Globe2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-electric-300" />
            <p>
              This page shows public data only. GCC never displays email addresses or WhatsApp
              numbers on a public profile. Ratings start at 1000 and only completed tournaments move
              them.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
