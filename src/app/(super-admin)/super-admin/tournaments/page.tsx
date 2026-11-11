// GCC - tournament management list for the Super Admin console.
//
// Phase 8 adds the operator actions: suspend (hides the competition from
// every public surface, remembering the exact stage), unsuspend, cancel and
// transfer ownership. Every action requires a reason that is audited and
// shown to the affected organiser.
import { Search, Trophy } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { TournamentStatusBadge } from "@/components/super-admin/badges";
import { CursorNav } from "@/components/super-admin/cursor-nav";
import { TournamentRowActions } from "@/components/super-admin/tournament-row-actions";
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
      header: "Owner",
      render: (row) => (
        <div>
          {row.ownerTag ? (
            <Link
              href={`/organisers/${row.ownerUid}`}
              className="text-sm font-medium text-electric-300 underline-offset-4 transition-colors hover:text-electric-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
            >
              {row.organisationName || `@${row.ownerTag}`}
            </Link>
          ) : (
            <span className="text-sm text-grey-300">{row.organisationName || "—"}</span>
          )}
          <span className="block break-all text-xs text-grey-500">{row.ownerUid}</span>
        </div>
      ),
    },
    {
      key: "starts",
      header: "Starts",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-grey-300">
          {row.startsAt ? formatDate(row.startsAt) : "—"}
        </span>
      ),
    },
    {
      key: "workspace",
      header: "Workspace",
      hideOnMobile: true,
      render: (row) => (
        <Link
          href={`/organiser/tournaments/${row.id}`}
          className="inline-flex items-center gap-1.5 rounded text-xs font-semibold uppercase tracking-eyebrow text-electric-300 underline-offset-4 transition-colors hover:text-electric-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
        >
          Open in organiser workspace
          <span className="sr-only">for {row.name}</span>
        </Link>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <TournamentRowActions tournamentId={row.id} name={row.name} status={row.status} />
      ),
    },
  ];

  const hasFilters = Boolean(filters.search || filters.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Super Admin console"
        title="Tournaments"
        description="Every competition on the platform with its real status, entrant numbers and dates. Management actions suspend, restore, cancel or transfer a competition — each one requires a reason that is audited and shown to the organiser."
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
              : "Every competition any organiser creates appears here with its real status, dates and entrant count."
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
        Suspended competitions keep all of their data and return to the exact stage they left.
        Statuses only change through these explicit actions — nothing changes on a schedule.
      </p>
    </div>
  );
}
