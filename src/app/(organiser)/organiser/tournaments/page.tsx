// GCC - My tournaments.
//
// The server scopes every query to the signed-in organiser; the client can
// never widen it. Super Admin sees an honest "All tournaments" toggle that
// reuses the platform-wide query.
import { CalendarDays, CalendarClock, Search, Trophy, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, StatusPill } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input, Select } from "@/components/ui/input";
import { requirePageRole } from "@/lib/auth/page-access";
import { getGame, type GameId } from "@/lib/config/games";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import { listOrganiserTournaments } from "@/lib/organiser/tournaments";
import { CursorNav } from "@/components/super-admin/cursor-nav";
import { listTournaments } from "@/lib/super-admin/tournaments";
import { formatDate } from "@/lib/utils/dates";
import { isTournamentStatus, TOURNAMENT_STATUSES, type TournamentStatus } from "@/types/domain";

export const metadata = { title: "My tournaments" };

interface TournamentsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface ListRow {
  readonly id: string;
  readonly name: string;
  readonly gameId: GameId;
  readonly status: TournamentStatus;
  readonly season: string;
  readonly coverImageUrl: string | null;
  readonly registrationCount: number;
  readonly maxParticipants: number;
  readonly startsAt: Date | null;
  readonly updatedAt: Date | null;
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function listHref(
  filters: { readonly search: string; readonly status: string; readonly scope: string },
  cursor: { readonly after?: string | null; readonly before?: string | null } = {},
): string {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.scope !== "own") params.set("scope", filters.scope);
  if (cursor.after) params.set("after", cursor.after);
  if (cursor.before) params.set("before", cursor.before);

  const query = params.toString();
  return query ? `/organiser/tournaments?${query}` : "/organiser/tournaments";
}

function primaryAction(row: ListRow): { readonly label: string; readonly href: string } {
  if (row.status === "draft") {
    return { label: "Continue setup", href: `/organiser/tournaments/${row.id}/settings` };
  }

  if (row.status === "registration_open") {
    return {
      label: "Manage registrations",
      href: `/organiser/tournaments/${row.id}/registrations`,
    };
  }

  return { label: "Open workspace", href: `/organiser/tournaments/${row.id}` };
}

export default async function TournamentsPage({ searchParams }: TournamentsPageProps) {
  const user = await requirePageRole("organiser", "/organiser/tournaments");
  const params = await searchParams;
  const filters = {
    search: firstQueryValue(params.search) ?? "",
    status: firstQueryValue(params.status) ?? "",
    scope: firstQueryValue(params.scope) === "all" ? "all" : "own",
  };
  const after = firstQueryValue(params.after);
  const before = firstQueryValue(params.before);
  const status = isTournamentStatus(filters.status) ? filters.status : null;

  // The "all" scope exists only for Super Admin; for organisers the scope
  // parameter is ignored and the query stays owner-scoped on the server.
  const useAllScope = filters.scope === "all" && user.isSuperAdmin;

  let rows: readonly ListRow[] = [];
  let total = 0;
  let hasMore = false;
  let firstId: string | null = null;
  let lastId: string | null = null;

  if (useAllScope) {
    const result = await listTournaments({
      status,
      search: filters.search || null,
      after,
      before,
    });

    rows = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      gameId: row.gameId,
      status: row.status,
      season: "",
      coverImageUrl: null,
      registrationCount: row.registrationCount,
      maxParticipants: row.maxParticipants,
      startsAt: row.startsAt,
      updatedAt: null,
    }));
    total = result.total;
    hasMore = result.hasMore;
    firstId = result.firstId;
    lastId = result.lastId;
  } else {
    const result = await listOrganiserTournaments(user.userId, {
      status,
      search: filters.search || null,
      after,
      before,
    });

    rows = result.rows;
    total = result.total;
    hasMore = result.hasMore;
    firstId = result.firstId;
    lastId = result.lastId;
  }

  const hasFilters = Boolean(filters.search || filters.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organiser workspace"
        title="My tournaments"
        description={
          useAllScope
            ? "Every competition on the platform (Super Admin view). Ownership is read from the server documents."
            : "Every competition you own, with its current stage and the next operational step."
        }
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Organiser", href: "/organiser" },
          { label: "Tournaments" },
        ]}
        actions={
          <Link href="/organiser/tournaments/new" className={buttonStyles({ size: "sm" })}>
            Create a tournament
          </Link>
        }
      />

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-white/10 bg-navy-900/60 p-4 md:grid-cols-4"
      >
        <div>
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
            htmlFor="tournament-status"
            className="mb-1.5 block text-xs font-semibold text-grey-300"
          >
            Status
          </label>
          <Select id="tournament-status" name="status" defaultValue={filters.status}>
            <option value="">All statuses</option>
            {TOURNAMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </div>

        {user.isSuperAdmin ? (
          <div>
            <label
              htmlFor="tournament-scope"
              className="mb-1.5 block text-xs font-semibold text-grey-300"
            >
              Scope
            </label>
            <Select id="tournament-scope" name="scope" defaultValue={filters.scope}>
              <option value="own">My tournaments</option>
              <option value="all">All tournaments</option>
            </Select>
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <button type="submit" className={buttonStyles({ size: "sm" })}>
            <Search aria-hidden="true" className="h-4 w-4" />
            Apply
          </button>
          {hasFilters || filters.scope !== "own" ? (
            <Link
              href="/organiser/tournaments"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          eyebrow={hasFilters ? "No matching tournaments" : "No tournaments yet"}
          title={
            hasFilters ? "No tournaments match those filters" : "You do not own any tournaments yet"
          }
          description={
            hasFilters
              ? "Try a different name prefix or status. Name search matches from the start of the tournament name."
              : "When tournament creation opens, every competition you own appears here with its real status, dates and entrant count."
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {rows.map((row) => {
            const meta = TOURNAMENT_STATUS_META[row.status];
            const game = getGame(row.gameId);
            const action = primaryAction(row);

            return (
              <Card
                key={row.id}
                variant="elevated"
                className="group relative flex h-full flex-col overflow-hidden"
              >
                {row.coverImageUrl ? (
                  <div className="h-32 w-full overflow-hidden border-b border-white/10 bg-navy-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={row.coverImageUrl}
                      alt=""
                      className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                    />
                  </div>
                ) : null}

                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{game.name}</Badge>
                      <StatusPill tone={meta.tone} pulse={meta.live}>
                        {meta.label}
                      </StatusPill>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-display text-2xl font-semibold uppercase leading-tight tracking-display text-white">
                      {row.name}
                    </h3>
                    {row.season ? (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                        {row.season}
                      </p>
                    ) : null}
                  </div>

                  <dl className="space-y-2 text-sm text-grey-400">
                    <div className="flex items-center gap-2">
                      <Users aria-hidden="true" className="h-4 w-4 text-grey-500" />
                      <dt className="sr-only">Registration</dt>
                      <dd>
                        {row.registrationCount} / {row.maxParticipants} registered
                      </dd>
                    </div>
                    {row.startsAt ? (
                      <div className="flex items-center gap-2">
                        <CalendarDays aria-hidden="true" className="h-4 w-4 text-grey-500" />
                        <dt className="sr-only">Starts</dt>
                        <dd>Starts {formatDate(row.startsAt)}</dd>
                      </div>
                    ) : null}
                    {row.updatedAt ? (
                      <div className="flex items-center gap-2">
                        <CalendarClock aria-hidden="true" className="h-4 w-4 text-grey-500" />
                        <dt className="sr-only">Last updated</dt>
                        <dd>Last updated {formatDate(row.updatedAt)}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      href={action.href}
                      className={buttonStyles({ size: "sm" })}
                      aria-label={`${action.label} for ${row.name}`}
                    >
                      {action.label}
                    </Link>
                    <Link
                      href={`/organiser/tournaments/${row.id}`}
                      className="text-xs font-semibold uppercase tracking-eyebrow text-electric-300 underline-offset-4 transition-colors hover:text-electric-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                    >
                      Workspace
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {rows.length > 0 ? (
        <CursorNav
          previousHref={
            (after || before) && firstId ? listHref(filters, { before: firstId }) : null
          }
          nextHref={hasMore && lastId ? listHref(filters, { after: lastId }) : null}
          summary={`Showing ${rows.length} of ${total} tournaments${
            useAllScope ? " on the platform" : " you own"
          }.`}
          label="Tournament list pagination"
        />
      ) : null}

      <p className="text-xs leading-5 text-grey-500">
        Tournament creation, status transitions and result management arrive with the organiser
        tools. Nothing on this page is editable yet.
      </p>
    </div>
  );
}
