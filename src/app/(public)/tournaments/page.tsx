// GCC - public tournament discovery.
//
// Cursor-paginated list of published competitions with filters (game, entry
// state) and sorts. The "open" and "opens soon" states are effective states
// computed from dates and counts by the shared pure logic, not stored fields.
// If Firestore is unreachable or empty, the page shows an honest empty state.
import { ArrowLeft, Search, Trophy } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { TournamentCard } from "@/components/tournament/tournament-card";
import { buttonStyles } from "@/components/ui/button-styles";
import { EmptyState } from "@/components/ui/data-display";
import { Input, Select } from "@/components/ui/input";
import { GAMES, getGame, isGameId, type GameId } from "@/lib/config/games";
import {
  isTournamentListState,
  isTournamentSort,
  listPublicTournaments,
  TOURNAMENT_LIST_STATES,
} from "@/lib/data/public-tournaments";

export const metadata = {
  title: "Tournaments",
  description: "Published GCC competitions with their real dates, status and registration counts.",
};

interface TournamentsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

interface Filters {
  readonly game: string;
  readonly state: string;
  readonly sort: string;
  readonly search: string;
}

const STATE_LABELS: Readonly<Record<string, string>> = {
  all: "All competitions",
  open: "Open for registration",
  upcoming: "Opening soon",
  in_progress: "In progress",
  completed: "Completed",
};

function listHref(filters: Filters, cursor?: { readonly after: string }): string {
  const params = new URLSearchParams();

  if (filters.game) params.set("game", filters.game);
  if (filters.state && filters.state !== "all") params.set("state", filters.state);
  if (filters.sort && filters.sort !== "closing_soonest") params.set("sort", filters.sort);
  if (filters.search) params.set("search", filters.search);
  if (cursor) params.set("after", cursor.after);

  const query = params.toString();
  return query ? `/tournaments?${query}` : "/tournaments";
}

export default async function TournamentsPage({ searchParams }: TournamentsPageProps) {
  const params = await searchParams;
  const filters: Filters = {
    game: firstQueryValue(params.game) ?? "",
    state: firstQueryValue(params.state) ?? "all",
    sort: firstQueryValue(params.sort) ?? "closing_soonest",
    search: firstQueryValue(params.search) ?? "",
  };
  const after = firstQueryValue(params.after);

  const gameId: GameId | null =
    filters.game && isGameId(filters.game) ? (filters.game as GameId) : null;
  const state = isTournamentListState(filters.state) ? filters.state : "all";
  const sort = isTournamentSort(filters.sort) ? filters.sort : "closing_soonest";

  const page = await listPublicTournaments({
    gameId,
    state,
    sort,
    search: filters.search || null,
    after,
  });

  const hasFilters = Boolean(filters.game || filters.search || state !== "all");

  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Discover competitions"
            title="Tournaments"
            description="Every published GCC competition with its real entry window, field size and schedule. Registration happens in the platform, never through a third party."
            breadcrumbs={[{ label: "Home", href: "/" }, { label: "Tournaments" }]}
          />
        </div>
      </section>

      <section>
        <div className="container py-10 sm:py-14">
          <form
            method="get"
            className="grid gap-3 rounded-xl border border-white/10 bg-navy-900/60 p-4 sm:grid-cols-2 lg:grid-cols-5"
          >
            <div className="lg:col-span-2">
              <label
                htmlFor="tournament-search"
                className="mb-1.5 block text-xs font-semibold text-grey-300"
              >
                Search by name
              </label>
              <Input
                id="tournament-search"
                name="search"
                type="search"
                defaultValue={filters.search}
                placeholder="Name prefix"
              />
            </div>

            <div>
              <label
                htmlFor="tournament-game"
                className="mb-1.5 block text-xs font-semibold text-grey-300"
              >
                Game
              </label>
              <Select id="tournament-game" name="game" defaultValue={filters.game}>
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
                htmlFor="tournament-state"
                className="mb-1.5 block text-xs font-semibold text-grey-300"
              >
                Entry state
              </label>
              <Select id="tournament-state" name="state" defaultValue={filters.state}>
                {TOURNAMENT_LIST_STATES.map((value) => (
                  <option key={value} value={value}>
                    {STATE_LABELS[value] ?? value}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label
                htmlFor="tournament-sort"
                className="mb-1.5 block text-xs font-semibold text-grey-300"
              >
                Sort
              </label>
              <Select id="tournament-sort" name="sort" defaultValue={filters.sort}>
                <option value="closing_soonest">Closing soonest</option>
                <option value="newest">Newest</option>
              </Select>
            </div>

            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
              <button type="submit" className={buttonStyles({ size: "sm" })}>
                <Search aria-hidden="true" className="h-4 w-4" />
                Apply
              </button>
              {hasFilters ? (
                <Link
                  href="/tournaments"
                  className={buttonStyles({ variant: "ghost", size: "sm" })}
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>

          {page.rows.length === 0 ? (
            <div className="mt-8">
              <EmptyState
                icon={Trophy}
                eyebrow={hasFilters ? "No matching tournaments" : "No tournaments yet"}
                title={
                  hasFilters
                    ? "No tournaments match those filters"
                    : "No competitions are published yet"
                }
                description={
                  hasFilters
                    ? "Try a different name prefix, game or entry state. Name search matches from the start of the tournament name."
                    : "When organisers publish competitions, every one appears here with its real entry window and live registration count."
                }
                action={
                  hasFilters ? (
                    <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
                      Clear filters
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {page.rows.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </div>

              <div className="mt-8 flex items-center justify-between gap-3">
                {after ? (
                  <Link
                    href={listHref(filters)}
                    className={buttonStyles({ variant: "secondary", size: "sm" })}
                  >
                    <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                    First page
                  </Link>
                ) : (
                  <span className="text-xs text-grey-500">
                    Showing {page.rows.length} of{" "}
                    {page.rows.length < 9 && !page.hasMore ? page.rows.length : "9+"} competitions
                  </span>
                )}

                {page.hasMore && page.nextCursor ? (
                  <Link
                    href={listHref(filters, { after: page.nextCursor })}
                    className={buttonStyles({ size: "sm" })}
                  >
                    Next page
                    <ArrowLeft aria-hidden="true" className="h-4 w-4 rotate-180" />
                  </Link>
                ) : null}
              </div>
            </>
          )}

          {page.rows.length > 0 && gameId ? (
            <p className="mt-6 text-xs leading-5 text-grey-500">
              Showing {getGame(gameId).name} competitions. Every card shows the real entry count and
              the moment registration opens or closes.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
