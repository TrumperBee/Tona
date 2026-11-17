// GCC - public per-game Elo ladder.
//
// Ratings are written only when a tournament completes. The ladder is a
// bounded scan ordered by rating, filtered in memory for the five-match
// threshold, country and tag prefix, so a page never implies a rank it did not
// read. If Firestore is empty or unreachable, the page says so.
import { BarChart3, Search, ShieldCheck, TrendingUp } from "lucide-react";
import Link from "next/link";

import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/data-display";
import { Input, Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { countryFlag, countryName } from "@/lib/config/countries";
import { GAMES, getGame, isGameId, type GameId } from "@/lib/config/games";
import { getRankings, RATED_MATCH_THRESHOLD } from "@/lib/stats/server";
import { firstQueryValue } from "@/lib/super-admin/query";
import { cn } from "@/lib/utils/cn";

export const metadata = {
  title: "Rankings",
  description:
    "Per-game GCC Elo ladders built from completed tournament results. Ratings start at 1000 and enter the ladder after five rated matches.",
};

interface RankingsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function rankingsHref(input: {
  readonly gameId: GameId;
  readonly country?: string;
  readonly search?: string;
  readonly page?: number;
}): string {
  const params = new URLSearchParams();

  if (input.gameId !== GAMES[0].id) params.set("game", input.gameId);
  if (input.country) params.set("country", input.country);
  if (input.search) params.set("search", input.search);
  if (input.page && input.page > 1) params.set("page", String(input.page));

  const query = params.toString();
  return query ? `/rankings?${query}` : "/rankings";
}

export default async function RankingsPage({ searchParams }: RankingsPageProps) {
  const params = await searchParams;
  const requestedGame = firstQueryValue(params.game);
  const gameId: GameId = requestedGame && isGameId(requestedGame) ? requestedGame : GAMES[0].id;
  const country = (firstQueryValue(params.country) ?? "").toUpperCase();
  const search = firstQueryValue(params.search) ?? "";
  const page = Math.max(1, Number.parseInt(firstQueryValue(params.page) ?? "1", 10) || 1);
  const ladder = await getRankings({ gameId, country, search, page });
  const hasFilters = Boolean(country || search);

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Records"
            title="Rankings"
            description="One Elo ladder per game, built only from completed tournament results. No manual points, no hidden adjustments and no rank before the threshold is met."
            breadcrumbs={[{ label: "Home", href: "/" }, { label: "Rankings" }]}
          />
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-8 sm:py-10">
          <nav aria-label="Game ladders">
            <ul className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {GAMES.map((game) => {
                const active = game.id === gameId;

                return (
                  <li key={game.id} className="snap-start">
                    <Link
                      href={rankingsHref({ gameId: game.id, country, search })}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 text-xs font-semibold transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
                        active
                          ? "border-electric-400/60 bg-electric-500/15 text-electric-200"
                          : "border-white/15 bg-navy-900/60 text-grey-300 hover:border-white/30 hover:text-white",
                      )}
                    >
                      {game.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <form
            method="get"
            action="/rankings"
            className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-navy-900/60 p-4 sm:grid-cols-[minmax(0,1fr)_14rem_auto]"
          >
            <input type="hidden" name="game" value={gameId} />
            <div>
              <label
                htmlFor="ranking-search"
                className="mb-1.5 block text-xs font-semibold text-grey-300"
              >
                Filter by tag
              </label>
              <Input
                id="ranking-search"
                name="search"
                type="search"
                defaultValue={search}
                placeholder="Gamer tag prefix"
              />
            </div>
            <div>
              <label
                htmlFor="ranking-country"
                className="mb-1.5 block text-xs font-semibold text-grey-300"
              >
                Country
              </label>
              <Select id="ranking-country" name="country" defaultValue={country}>
                <option value="">All countries</option>
                {ladder.countries.map((code) => (
                  <option key={code} value={code}>
                    {countryName(code)}
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
                <Link
                  href={rankingsHref({ gameId })}
                  className={buttonStyles({ variant: "ghost", size: "sm" })}
                >
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
        </div>
      </section>

      <section>
        <div className="container py-10 sm:py-14">
          <SectionHeading
            eyebrow={getGame(gameId).name}
            title="The ladder"
            description="Ordered by rating. A player needs five rated matches to appear; until then their profile says Unranked."
          />

          <div className="mt-5">
            {ladder.total === 0 ? (
              <EmptyState
                size="lg"
                icon={BarChart3}
                eyebrow={hasFilters ? "No matching players" : "No ranked players yet"}
                title={
                  hasFilters
                    ? "No player on this ladder matches those filters"
                    : "The ladder starts with completed tournaments"
                }
                description={
                  hasFilters
                    ? "Try a shorter tag prefix, a different country, or reset the filters."
                    : `Ratings are applied when a tournament completes. A player enters this ladder after ${RATED_MATCH_THRESHOLD} rated matches on ${getGame(gameId).name}.`
                }
                action={
                  hasFilters ? (
                    <Link href={rankingsHref({ gameId })} className={buttonStyles({ size: "sm" })}>
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
                <div className="hidden grid-cols-[3rem_minmax(0,1fr)_7rem_5rem_8rem] gap-3 px-4 pb-2 text-xs font-semibold uppercase tracking-eyebrow text-grey-500 sm:grid">
                  <span>Rank</span>
                  <span>Player</span>
                  <span>Country</span>
                  <span className="text-right">Rating</span>
                  <span className="text-right">Record</span>
                </div>
                <ol className="overflow-hidden rounded-xl border border-white/10 bg-navy-900/50">
                  {ladder.rows.map((row) => (
                    <li key={row.uid} className="border-b border-white/10 last:border-0">
                      <Link
                        href={`/players/${encodeURIComponent(row.gamerTag)}`}
                        className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-electric-400 sm:grid-cols-[3rem_minmax(0,1fr)_7rem_5rem_8rem] sm:px-4"
                      >
                        <span
                          className={cn(
                            "font-display text-lg font-semibold tabular-nums",
                            row.rank === 1
                              ? "text-gold-200"
                              : row.rank <= 3
                                ? "text-grey-100"
                                : "text-grey-400",
                          )}
                        >
                          #{row.rank}
                        </span>
                        <span className="flex min-w-0 items-center gap-3">
                          <Avatar name={row.gamerTag} src={row.avatarUrl} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-grey-100">
                              @{row.gamerTag}
                            </span>
                            <span className="block text-xs text-grey-500 sm:hidden">
                              {row.country ? (
                                <>
                                  <span aria-hidden="true">{countryFlag(row.country)}</span>{" "}
                                  {countryName(row.country)} ·{" "}
                                </>
                              ) : null}
                              {row.wins}W {row.draws}D {row.losses}L
                            </span>
                          </span>
                        </span>
                        <span className="hidden text-xs text-grey-400 sm:block">
                          {row.country ? (
                            <>
                              <span aria-hidden="true">{countryFlag(row.country)}</span>{" "}
                              {countryName(row.country)}
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                        <span className="text-right font-display text-lg font-semibold tabular-nums text-white">
                          {Math.round(row.rating)}
                        </span>
                        <span className="hidden text-right text-xs tabular-nums text-grey-400 sm:block">
                          {row.wins}W {row.draws}D {row.losses}L
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>

                <Pagination
                  page={ladder.page}
                  pageCount={Math.max(1, Math.ceil(ladder.total / ladder.pageSize))}
                  hrefForPage={(target) => rankingsHref({ gameId, country, search, page: target })}
                  ariaLabel="Ranking pages"
                  className="mt-4"
                />

                <p className="mt-3 text-xs leading-5 text-grey-500">
                  {ladder.scanned >= ladder.scanLimit
                    ? `Showing from the top ${ladder.scanLimit} rated players on this game.`
                    : `${ladder.total} ranked ${ladder.total === 1 ? "player" : "players"} found.`}{" "}
                  A player qualifies after {RATED_MATCH_THRESHOLD} rated matches.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-navy-950/40">
        <div className="container py-10 sm:py-14">
          <SectionHeading eyebrow="How it works" title="How ratings work" />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp aria-hidden="true" className="h-4 w-4 text-electric-300" />
                  <CardTitle className="text-lg">Start and scale</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-grey-400">
                Every game has its own ladder. A player starts at 1000. Each completed match uses
                the standard Elo formula with K = 32, so an upset moves ratings more than a
                favourite&apos;s win.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4 text-electric-300" />
                  <CardTitle className="text-lg">Only finals count</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-grey-400">
                Ratings are applied once, when a tournament completes, by replaying its results in a
                fixed order. A win is worth 1, a draw 0.5 and a loss 0. Goal margin is ignored, so a
                3–0 walkover counts exactly like a 1–0 win.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 aria-hidden="true" className="h-4 w-4 text-electric-300" />
                  <CardTitle className="text-lg">Five matches to rank</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-grey-400">
                A rating exists after the first completed tournament, but a player stays Unranked
                until {RATED_MATCH_THRESHOLD} rated matches. This keeps a one-match ladder from
                looking like a settled ranking.
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge tone="neutral">K = 32</Badge>
            <Badge tone="neutral">Start 1000</Badge>
            <Badge tone="neutral">Draw = 0.5</Badge>
            <Badge tone="neutral">No margin bonus</Badge>
            <Badge tone="neutral">{RATED_MATCH_THRESHOLD} matches to rank</Badge>
          </div>
        </div>
      </section>
    </>
  );
}
