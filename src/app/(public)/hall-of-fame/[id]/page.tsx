// GCC - one Hall of Fame record.
//
// Reads a single induction document. Every value was written when the
// tournament completed; the page does not recompute or pad the table.
import { ArrowLeft, Target, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { ExportButton } from "@/components/graphics/export-button";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { Avatar, EmptyState, StatCard } from "@/components/ui/data-display";
import { getGame } from "@/lib/config/games";
import { getHallOfFameEntry } from "@/lib/data/hall-of-fame";
import { getPublicKnockout } from "@/lib/data/public-knockout";
import { championGraphicDataFromRecord, graphicBranding } from "@/lib/graphics/data";
import { formatDate } from "@/lib/utils/dates";

interface HallOfFameDetailProps {
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: HallOfFameDetailProps) {
  const { id } = await params;
  const entry = await getHallOfFameEntry(id);

  if (!entry) {
    return { title: "Hall of Fame entry not found" };
  }

  return {
    title: `${entry.tournamentName} · Hall of Fame`,
    description: `${entry.championTag} won ${entry.tournamentName} (${entry.season}). Full finalists, top eight and tournament records.`,
  };
}

export default async function HallOfFameDetailPage({ params }: HallOfFameDetailProps) {
  const { id } = await params;
  const entry = await getHallOfFameEntry(id);

  if (!entry) {
    notFound();
  }

  const knockout = await getPublicKnockout(entry.tournamentId, "completed");
  const branding = graphicBranding({
    tournamentName: entry.tournamentName,
    tournamentSlug: entry.slug || entry.tournamentId,
    season: entry.season,
    gameName: getGame(entry.gameId).name,
  });
  const championGraphic = championGraphicDataFromRecord(entry, knockout);

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Hall of Fame"
            title={entry.tournamentName}
            description={`${getGame(entry.gameId).name}${entry.season ? ` · ${entry.season}` : ""}${
              entry.completedAt ? ` · completed ${formatDate(entry.completedAt)}` : ""
            }`}
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Hall of Fame", href: "/hall-of-fame" },
              { label: entry.tournamentName },
            ]}
            actions={
              <>
                <Link
                  href="/hall-of-fame"
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  All inductees
                </Link>
                {entry.slug ? (
                  <Link
                    href={`/tournaments/${entry.slug}`}
                    className={buttonStyles({ variant: "ghost", size: "sm" })}
                  >
                    Tournament page
                  </Link>
                ) : null}
                <ExportButton
                  payload={{ template: "champion", data: championGraphic }}
                  branding={branding}
                  label="Champion graphic"
                  variant="gold"
                />
              </>
            }
          />
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-14">
          <Card variant="gold">
            <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
              <span className="inline-flex rounded-full ring-2 ring-gold-400/50 ring-offset-4 ring-offset-navy-950">
                <Avatar
                  name={entry.championTag}
                  src={entry.championAvatarUrl}
                  size="hero"
                  crossOrigin="anonymous"
                />
              </span>
              <div className="min-w-0 flex-1">
                <Badge tone="gold">
                  <Trophy aria-hidden="true" className="h-3.5 w-3.5" />
                  Champion
                </Badge>
                <h2 className="mt-3 font-display text-4xl font-semibold uppercase tracking-display text-white">
                  <Link
                    href={`/players/${encodeURIComponent(entry.championTag)}`}
                    className="underline-offset-4 hover:underline"
                  >
                    @{entry.championTag}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-grey-400">
                  {entry.season ? `${entry.season} · ` : ""}
                  {getGame(entry.gameId).name}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="neutral">
                    {entry.stats.wins}W {entry.stats.draws}D {entry.stats.losses}L
                  </Badge>
                  <Badge tone="neutral">
                    {entry.stats.goalsFor} scored · {entry.stats.goalsAgainst} conceded
                  </Badge>
                  <Badge tone="neutral">{entry.stats.played} played</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-14">
          <SectionHeading
            eyebrow="Finalists"
            title="The last four"
            description="Runner-up and semi-finalists, taken from the recorded knockout ties."
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
                Champion
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Avatar
                  name={entry.championTag}
                  src={entry.championAvatarUrl}
                  size="md"
                  crossOrigin="anonymous"
                />
                <Link
                  href={`/players/${encodeURIComponent(entry.championTag)}`}
                  className="truncate font-display text-lg font-semibold uppercase tracking-display text-white underline-offset-4 hover:underline"
                >
                  @{entry.championTag}
                </Link>
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
                Runner-up
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Avatar
                  name={entry.finalistTag}
                  src={entry.finalistAvatarUrl}
                  size="md"
                  crossOrigin="anonymous"
                />
                <Link
                  href={`/players/${encodeURIComponent(entry.finalistTag)}`}
                  className="truncate font-display text-lg font-semibold uppercase tracking-display text-white underline-offset-4 hover:underline"
                >
                  @{entry.finalistTag}
                </Link>
              </div>
            </Card>

            {entry.semiFinalists.slice(0, 2).map((player, index) => (
              <Card key={player.uid} className="p-5">
                <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
                  Semi-finalist
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar name={player.tag} src={player.avatarUrl} size="md" />
                  <Link
                    href={`/players/${encodeURIComponent(player.tag)}`}
                    className="truncate font-display text-lg font-semibold uppercase tracking-display text-white underline-offset-4 hover:underline"
                  >
                    @{player.tag}
                  </Link>
                </div>
                {index === 1 && entry.semiFinalists.length > 2 ? (
                  <p className="mt-2 text-xs text-grey-500">
                    +{entry.semiFinalists.length - 2} more semi-finalist
                  </p>
                ) : null}
              </Card>
            ))}
          </div>

          {entry.semiFinalists.length > 2 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {entry.semiFinalists.slice(2).map((player) => (
                <Link
                  key={player.uid}
                  href={`/players/${encodeURIComponent(player.tag)}`}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 text-xs font-semibold text-grey-200 transition-colors hover:border-white/30 hover:text-white"
                >
                  <Avatar name={player.tag} src={player.avatarUrl} size="xs" />@{player.tag}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-14">
          <SectionHeading
            eyebrow="Tournament stats"
            title="The competition in numbers"
            description="Completed matches across the league and knockout phases, plus the league-phase scoring records."
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Completed matches" value={entry.tournamentStats.matches} />
            <StatCard label="Goals" value={entry.tournamentStats.goals} />
            <StatCard
              label="Goals per match"
              value={
                entry.tournamentStats.matches > 0
                  ? entry.tournamentStats.goalsPerMatch.toFixed(2)
                  : "—"
              }
            />
            <StatCard
              label="Top league scorer"
              value={
                entry.tournamentStats.topScorer ? `${entry.tournamentStats.topScorer.goals}` : "—"
              }
              hint={
                entry.tournamentStats.topScorer ? (
                  <Link
                    href={`/players/${encodeURIComponent(entry.tournamentStats.topScorer.tag)}`}
                    className="underline-offset-4 hover:underline"
                  >
                    @{entry.tournamentStats.topScorer.tag}
                  </Link>
                ) : (
                  "No league goals were scored."
                )
              }
            />
            <StatCard
              label="Best defence"
              value={
                entry.tournamentStats.bestDefence
                  ? `${entry.tournamentStats.bestDefence.goalsAgainst}`
                  : "—"
              }
              hint={
                entry.tournamentStats.bestDefence ? (
                  <Link
                    href={`/players/${encodeURIComponent(entry.tournamentStats.bestDefence.tag)}`}
                    className="underline-offset-4 hover:underline"
                  >
                    @{entry.tournamentStats.bestDefence.tag} conceded
                  </Link>
                ) : (
                  "No league table was stored."
                )
              }
            />
          </div>
        </div>
      </section>

      <section>
        <div className="container py-10 sm:py-14">
          <SectionHeading
            eyebrow="League phase"
            title="Top eight"
            description="The final league table as stored when the tournament completed."
          />
          <div className="mt-5">
            {entry.standings.length === 0 ? (
              <EmptyState
                icon={Users}
                eyebrow="League table"
                title="No league table was stored"
                description="This tournament completed without a stored league table, so no positions are shown."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-navy-900/50">
                <table className="w-full min-w-[34rem] text-sm">
                  <caption className="sr-only">Top eight of the final league table</caption>
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                      <th scope="col" className="px-3 py-2 text-right">
                        Pos
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Player
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        P
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        W
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        D
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        L
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        GF
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        GA
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.standings.map((row) => (
                      <tr key={row.uid} className="border-b border-white/10 last:border-0">
                        <td className="px-3 py-2 text-right font-display font-semibold tabular-nums text-grey-300">
                          {row.position}
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/players/${encodeURIComponent(row.tag)}`}
                            className="font-semibold text-grey-100 underline-offset-4 hover:underline"
                          >
                            @{row.tag}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-grey-300">
                          {row.played}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-grey-300">
                          {row.wins}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-grey-300">
                          {row.draws}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-grey-300">
                          {row.losses}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-grey-300">
                          {row.goalsFor}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-grey-300">
                          {row.goalsAgainst}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Card variant="outline" className="mt-6 p-5">
            <div className="flex items-start gap-3">
              <Target aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-electric-300" />
              <p className="text-xs leading-5 text-grey-400">
                The champion&apos;s record above counts every completed match in this tournament.
                Top scorer and best defence cover the league phase only, because those are the
                records stored with the final table.
              </p>
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
