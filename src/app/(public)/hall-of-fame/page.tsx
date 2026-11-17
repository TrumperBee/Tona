// GCC - Hall of Fame.
//
// One permanent entry per completed tournament, written by the completion job.
// Seasons are grouped newest first. There are no honorary entries and no sample
// champions: an empty archive stays visibly empty.
import { ArrowRight, Award, History, Trophy } from "lucide-react";
import Link from "next/link";

import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/data-display";
import { Pagination } from "@/components/ui/pagination";
import { getGame } from "@/lib/config/games";
import { listHallOfFame } from "@/lib/data/hall-of-fame";
import { formatDate } from "@/lib/utils/dates";

export const metadata = {
  title: "Hall of Fame",
  description:
    "The permanent record of GCC champions, finalists and tournament records. An entry exists only after a verified final.",
};

interface HallOfFamePageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const criteria = [
  {
    title: "A completed final",
    description:
      "The final must be recorded in the platform. A screenshot or a rumour is not a title.",
    icon: Trophy,
  },
  {
    title: "A verified champion",
    description:
      "The winner comes from the knockout record, together with the tournament, game and season.",
    icon: Award,
  },
  {
    title: "A permanent entry",
    description:
      "Entries are never hard-deleted. A correction creates an audited state instead of erasing the record.",
    icon: History,
  },
] as const;

export default async function HallOfFamePage({ searchParams }: HallOfFamePageProps) {
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const hall = await listHallOfFame(page);
  const seasons = [...new Set(hall.entries.map((entry) => entry.season || "Unknown season"))].sort(
    (left, right) => right.localeCompare(left),
  );

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Records"
            title="Hall of Fame"
            description="The names that survive the season. Every entry is earned by a verified final, written once when the tournament completes and preserved permanently."
            breadcrumbs={[{ label: "Home", href: "/" }, { label: "Hall of Fame" }]}
          />
        </div>
      </section>

      {hall.total === 0 ? (
        <section className="border-b border-white/10">
          <div className="container py-10 sm:py-14">
            <EmptyState
              size="lg"
              icon={Trophy}
              eyebrow="No champions yet"
              title="The first final has not been played"
              description="No GCC competition has reached a verified final, so the Hall of Fame is empty. There are no honorary entries, sample champions or placeholders."
              action={
                <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
                  See the competitions
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              }
              secondaryAction={
                <Link
                  href="/archives"
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  Visit the archives
                </Link>
              }
            />
          </div>
        </section>
      ) : (
        <section className="border-b border-white/10">
          <div className="container space-y-10 py-10 sm:py-14">
            {seasons.map((season) => (
              <div key={season}>
                <SectionHeading
                  eyebrow="Season"
                  title={season === "Unknown season" ? "Season not recorded" : season}
                />
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {hall.entries
                    .filter((entry) => (entry.season || "Unknown season") === season)
                    .map((entry) => (
                      <Card
                        key={entry.tournamentId}
                        variant="gold"
                        className="flex h-full flex-col"
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <CardTitle className="truncate text-lg">
                                {entry.tournamentName}
                              </CardTitle>
                              <p className="mt-1 text-xs text-grey-400">
                                {getGame(entry.gameId).name}
                                {entry.season ? ` · ${entry.season}` : ""}
                              </p>
                            </div>
                            <Trophy aria-hidden="true" className="h-5 w-5 shrink-0 text-gold-300" />
                          </div>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col gap-4">
                          <div className="flex items-center gap-3">
                            <span className="rounded-full ring-1 ring-gold-400/40 ring-offset-2 ring-offset-navy-900">
                              <Avatar
                                name={entry.championTag}
                                src={entry.championAvatarUrl}
                                size="lg"
                                crossOrigin="anonymous"
                              />
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
                                Champion
                              </p>
                              <Link
                                href={`/players/${encodeURIComponent(entry.championTag)}`}
                                className="block truncate font-display text-xl font-semibold uppercase tracking-display text-white underline-offset-4 hover:underline"
                              >
                                @{entry.championTag}
                              </Link>
                            </div>
                          </div>

                          <p className="text-xs leading-5 text-grey-400">
                            Runner-up:{" "}
                            <Link
                              href={`/players/${encodeURIComponent(entry.finalistTag)}`}
                              className="font-semibold text-grey-200 underline-offset-4 hover:underline"
                            >
                              @{entry.finalistTag}
                            </Link>
                          </p>

                          <div className="flex flex-wrap gap-1.5">
                            <Badge tone="neutral">
                              {entry.stats.wins}W {entry.stats.draws}D {entry.stats.losses}L
                            </Badge>
                            <Badge tone="neutral">
                              {entry.stats.goalsFor}:{entry.stats.goalsAgainst}
                            </Badge>
                          </div>

                          <div className="mt-auto flex items-center justify-between gap-2 border-t border-gold-400/15 pt-3">
                            <span className="text-xs text-grey-500">
                              {entry.completedAt
                                ? formatDate(entry.completedAt)
                                : "Date not recorded"}
                            </span>
                            <Link
                              href={`/hall-of-fame/${entry.tournamentId}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-gold-200 underline-offset-4 hover:underline"
                            >
                              Full record
                              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            ))}

            <Pagination
              page={hall.page}
              pageCount={hall.pageCount}
              hrefForPage={(target) =>
                target > 1 ? `/hall-of-fame?page=${target}` : "/hall-of-fame"
              }
              ariaLabel="Hall of Fame pages"
            />
          </div>
        </section>
      )}

      <section>
        <div className="container py-10 sm:py-14">
          <h2 className="font-display text-3xl font-semibold uppercase tracking-display text-white">
            How induction works
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {criteria.map((criterion) => {
              const Icon = criterion.icon;

              return (
                <Card key={criterion.title} className="h-full p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-gold-400/25 bg-gold-400/10 text-gold-300">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-xl font-semibold uppercase tracking-display text-white">
                    {criterion.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-grey-400">{criterion.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
