// GCC - read-only tournament list for the Super Admin console.
//
// Phase 5 shows the real records and filters only. Management actions arrive in
// Phase 8, so no decorative controls are rendered here.
import { Search, Trophy } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { TournamentStatusBadge } from "@/components/super-admin/badges";
import { CursorNav } from "@/components/super-admin/cursor-nav";
import { buttonStyles } from "@/components/ui/button-styles";
import { EmptyState } from "@/components/ui/data-display";
import { Input, Select } from "@/components/ui/input";
import { Table, type TableColumn } from "@/components/ui/table";
import { getGame } from "@/lib/config/games";
import { firstQueryValue } from "@/lib/super-admin/query";
import { listTournaments, type TournamentListRow } from "@/lib/super-admin/tournaments";
import { formatDate } from "@/lib/utils/dates";
import { isTournamentStatus, TOURNAMENT_STATUSES, type TournamentStatus } from "@/types/domain";

export const metadata = { title: "Tournaments" };

interface TournamentsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface Filters {
  readonly search: string;
  readonly status: string;
}

function tournamentHref(
  filters: Filters,
  cursor: { readonly after?: string | null; readonly before?: string | null } = {},
): string {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (cursor.after) params.set("after", cursor.after);
  if (cursor.before) params.set("before", cursor.before);

  const query = params.toString();
  return query ? `/super-admin/tournaments?${query}` : "/super-admin/tournaments";
}

export default async function TournamentsPage({ searchParams }: TournamentsPageProps) {
  const params = await searchParams;
  const filters: Filters = {
    search: firstQueryValue(params.search) ?? "",
    status: firstQueryValue(params.status) ?? "",
  };
  const after = firstQueryValue(params.after);
  const before = firstQueryValue(params.before);
  const status = isTournamentStatus(filters.status) ? filters.status : null;

  const result = await listTournaments({
    status: status as TournamentStatus | null,
    search: filters.search || null,
    after,
    before,
  });

  const columns: readonly TableColumn<TournamentListRow>[] = [
    {
      key: "name",
      header: "Tournament",
      render: (row) => (
        <div>
          <span className="block font-semibold text-white">{row.name}</span>
          <span className="block text-xs text-grey-500">{getGame(row.gameId).name}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <TournamentStatusBadge status={row.status} />,
    },
    {
      key: "registration",
      header: "Entrants",
      render: (row) => (
        <span className="text-sm tabular-nums text-grey-300">
          {row.registrationCount} / {row.maxParticipants}
        </span>
      ),
    },
    {
      key: "owner",
      header: "Owner UID",
      render: (row) => <span className="break-all text-xs text-grey-500">{row.ownerUid}</span>,
    },
    {
      key: "starts",
      header: "Starts",
      render: (row) => (
        <span className="text-sm text-grey-300">
          {row.startsAt ? formatDate(row.startsAt) : "—"}
        </span>
      ),
    },
  ];

  const hasFilters = Boolean(filters.search || filters.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Super Admin console"
        title="Tournaments"
        description="Every competition on the platform, read-only in this phase. Status, entrant numbers and dates come from the tournament documents."
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Tournaments" }]}
      />

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-white/10 bg-navy-900/60 p-4 md:grid-cols-3"
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

        <div className="flex items-end gap-2">
          <button type="submit" className={buttonStyles({ size: "sm" })}>
            <Search aria-hidden="true" className="h-4 w-4" />
            Apply
          </button>
          {hasFilters ? (
            <Link
              href="/super-admin/tournaments"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          eyebrow={hasFilters ? "No matching tournaments" : "No tournaments yet"}
          title={
            hasFilters ? "No tournaments match those filters" : "No tournaments have been created"
          }
          description={
            hasFilters
              ? "Try a different name prefix or status. Name search matches from the start of the tournament name."
              : "When organisers create competitions in Phase 8, every one will appear here with its real status, dates and entrant count."
          }
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={result.rows}
            getRowKey={(row) => row.id}
            caption={`Tournaments, page showing ${result.rows.length} of ${result.total}.`}
          />
          <CursorNav
            previousHref={
              (after || before) && result.firstId
                ? tournamentHref(filters, { before: result.firstId })
                : null
            }
            nextHref={
              result.hasMore && result.lastId
                ? tournamentHref(filters, { after: result.lastId })
                : null
            }
            summary={`Showing ${result.rows.length} of ${result.total} tournaments.`}
          />
        </>
      )}

      <p className="text-xs leading-5 text-grey-500">
        Read-only in Phase 5. Tournament creation, status transitions and result management are
        deliberately not available here yet.
      </p>
    </div>
  );
}
