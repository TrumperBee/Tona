// GCC - public player profile.
//
// Uses ONLY publicProfiles data. The private user document is read server-side
// solely to detect suspended or banned accounts, which show an unavailable
// message rather than a profile.
import { Gamepad2, Globe2, ShieldOff, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { Avatar, EmptyState, StatCard } from "@/components/ui/data-display";
import { countryFlag, countryName } from "@/lib/config/countries";
import { getGame, PLATFORMS } from "@/lib/config/games";
import { getPublicPlayerByGamerTag } from "@/lib/profile/server";

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
  const stats = profile.stats.overall;
  const game = getGame(profile.preferredGame);
  const platform = PLATFORMS.find((candidate) => candidate.id === profile.platform);
  const played = stats.played;
  const winRate = played > 0 ? `${Math.round((stats.wins / played) * 100)}%` : "—";

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
              <Link href="/players" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                Search players
              </Link>
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
                  {stats.titles > 0 ? (
                    <Badge tone="gold">
                      <Trophy aria-hidden="true" className="h-3.5 w-3.5" />
                      {stats.titles} {stats.titles === 1 ? "title" : "titles"}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <div className="container py-10 sm:py-14">
          <SectionHeading
            eyebrow="Record"
            title="Verified competitive record"
            description="Values come from server-written match aggregates. A new player starts at zero."
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Wins" value={stats.wins} />
            <StatCard label="Draws" value={stats.draws} />
            <StatCard label="Losses" value={stats.losses} />
            <StatCard
              label="Win rate"
              value={winRate}
              hint={played > 0 ? "From recorded matches." : "No recorded matches yet."}
            />
            <StatCard label="Goals for" value={stats.goalsFor} />
            <StatCard label="Goals against" value={stats.goalsAgainst} />
            <StatCard label="Tournaments" value={stats.tournaments} />
            <StatCard
              label="Platform rank"
              value="Unranked"
              hint="Ranking opens in a later phase."
            />
          </div>

          <div className="mt-8 flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-grey-400">
            <Globe2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-electric-300" />
            <p>
              This page shows public data only. GCC never displays email addresses or WhatsApp
              numbers on a public profile.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
