// GCC - public archives.
//
// Completed, archived and cancelled competitions are preserved here. Cancelled
// records link to the read-only notification page and are never presented as
// completed events. The list is merged, sorted and paginated in the server data
// module because the three statuses are stored separately.
import { Archive, CalendarDays, Search, Trophy } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input, Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { GAMES, getGame, isGameId, type GameId } from "@/lib/config/games";
import { listArchive } from "@/lib/data/archives";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import { firstQueryValue } from "@/lib/super-admin/query";
import { formatDate } from "@/lib/utils/dates";

export const metadata = {
  title: "Archives",
  description:
    "Preserved GCC competitions: completed seasons, archived events and cancelled records with their real dates and status.",
};

interface ArchivesPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function archiveHref(input: {
  readonly gameId?: GameId | null;
  readonly season?: string;
  readonly search?: string;
  readonly page?: number;
}): string {
  const params = new URLSearchParams();

  if (input.gameId) params.set("game", input.gameId);
  if (input.season) params.set("season", input.season);
  if (input.search) params.set("search", input.search);
  if (input.page && input.page > 1) params.set("page", String(input.page));

  const query = params.toString();
  return query ? `/archives?${query}` : "/archives";
}

export default async function ArchivesPage({ searchParams }: ArchivesPageProps) {
  const params = await searchParams;
  const requestedGame = firstQueryValue(params.game);
  const gameId: GameId | null = requestedGame && isGameId(requestedGame) ? requestedGame : null;
  const season = firstQueryValue(params.season) ?? "";
  const search = firstQueryValue(params.search) ?? "";
  const page = Math.max(1, Number.parseInt(firstQueryValue(params.page) ?? "1", 10) || 1);
  const archive = await listArchive({ gameId, season, search, page });
  const hasFilters = Boolean(gameId || season || search);

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Records"
            title="Archives"
            description="A competition platform is only as good as its memory. Completed and archived GCC events stay here with their real dates and final status; cancelled events remain reachable as read-only notices."
            breadcrumbs={[{ label: "Home", href: "/" }, { label: "Archives" }]}
          />
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-8 sm:py-10">
          <form
            method="get"
            action="/archives"
            className="grid gap-3 rounded-xl border border-white/10 bg-navy-900/60 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]"
          >
            <div>
              <label
                htmlFor="archive-search"
                className="mb-1.5 block text-xs font-semibold text-grey-300"
              >
                Search by name
              </label>
              <Input
                id="archive-search"
                name="search"
                type="search"
                defaultValue={search}
                placeholder="Name contains"
              />
            </div>
            <div>
              <label
                htmlFor="archive-game"
                className="mb-1.5 block text-xs font-semibold text-grey-300"
              >
                Game
              </label>
              <Select id="archive-game" name="game" defaultValue={gameId ?? ""}>
                <option value="">All games</option>
                {GAMES.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                htmlFor="archive-season"
                className="mb-1.5 block text-xs font-semibold text-grey-300"
              >
                Season
              </label>
              <Select id="archive-season" name="season" defaultValue={season}>
                <option value="">All seasons</option>
                {archive.seasons.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className={buttonStyles({ size: "sm" })}>
                <Search aria-hidden="true" className="h-4 w-4" />
                Apply
              </button>
              {hasFilters ? (
                <Link href="/archives" className={buttonStyles({ variant: "ghost", size: "sm" })}>
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-14">
          {archive.rows.length === 0 ? (
            <EmptyState
              size="lg"
              icon={Archive}
              eyebrow={hasFilters ? "No matching events" : "No archived events"}
              title={
                hasFilters
                  ? "No archived event matches those filters"
                  : "There is no completed season to revisit yet"
              }
              description={
                hasFilters
                  ? "Try a different game, season or search term, or reset the filters."
                  : "Completed and archived competitions appear here automatically. Nothing is assembled by hand or filled with sample results."
              }
              action={
                hasFilters ? (
                  <Link href="/archives" className={buttonStyles({ size: "sm" })}>
                    Reset filters
                  </Link>
                ) : (
                  <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
                    Browse tournaments
                  </Link>
                )
              }
              secondaryAction={
                <Link
                  href="/hall-of-fame"
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  Hall of Fame
                </Link>
              }
            />
          ) : (
            <>
              <div className="space-y-3">
                {archive.rows.map((row) => {
                  const status = TOURNAMENT_STATUS_META[row.status];
                  const cancelled = row.status === "cancelled";

                  return (
                    <Card key={row.id}>
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="text-lg">
                              <Link
                                href={`/tournaments/${row.slug}`}
                                className="underline-offset-4 hover:underline"
                              >
                                {row.name}
                              </Link>
                            </CardTitle>
                            <p className="mt-1 text-xs text-grey-400">
                              {getGame(row.gameId).name}
                              {row.season ? ` · ${row.season}` : ""}
                            </p>
                          </div>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-end justify-between gap-4">
                        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                          <div>
                            <dt className="font-semibold uppercase tracking-eyebrow text-grey-500">
                              {row.completedAt ? "Completed" : "Started"}
                            </dt>
                            <dd className="mt-0.5 text-grey-300">
                              {row.completedAt
                                ? formatDate(row.completedAt)
                                : row.startsAt
                                  ? formatDate(row.startsAt)
                                  : "Not recorded"}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-semibold uppercase tracking-eyebrow text-grey-500">
                              Registrations
                            </dt>
                            <dd className="mt-0.5 tabular-nums text-grey-300">
                              {row.registrationCount}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-semibold uppercase tracking-eyebrow text-grey-500">
                              Access
                            </dt>
                            <dd className="mt-0.5 text-grey-300">
                              {cancelled ? "Read-only notice" : "Public record"}
                            </dd>
                          </div>
                        </dl>

                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/tournaments/${row.slug}`}
                            className={buttonStyles({ variant: "secondary", size: "sm" })}
                          >
                            {cancelled ? (
                              "Open notice"
                            ) : (
                              <>
                                <CalendarDays aria-hidden="true" className="h-4 w-4" />
                                Open record
                              </>
                            )}
                          </Link>
                          {!cancelled && row.hasHallOfFame ? (
                            <Link
                              href={`/hall-of-fame/${row.id}`}
                              className={buttonStyles({ variant: "gold", size: "sm" })}
                            >
                              <Trophy aria-hidden="true" className="h-4 w-4" />
                              Hall of Fame
                            </Link>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Pagination
                page={archive.page}
                pageCount={archive.pageCount}
                hrefForPage={(target) => archiveHref({ gameId, season, search, page: target })}
                ariaLabel="Archive pages"
                className="mt-6"
              />

              <p className="mt-3 text-xs leading-5 text-grey-500">
                {archive.total} {archive.total === 1 ? "event" : "events"} match the current view.
                Only completed, archived and cancelled competitions appear here; live events stay
                under Tournaments.
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
