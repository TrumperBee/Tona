// GCC - Registrations.
//
// The workspace layout above renders the guard, header, lifecycle stepper and
// tabs. This page renders the real field: a gamer-tag search, a status filter
// with exact counts, the 36-slot progress bar, per-row contact and remove
// actions, the direct-add panel (the window is ignored but capacity,
// restrictions and the pre-pots stage still apply) and the owner-only CSV
// export. Phone numbers never reach the browser — the contact link is built
// on the server and every issuance is audited.
import { Download, Search, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AddPlayerPanel,
  RegistrationRowActions,
} from "@/components/organiser/registrations-manager";
import { CursorNav } from "@/components/super-admin/cursor-nav";
import { buttonStyles } from "@/components/ui/button-styles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/data-display";
import { Input, Select } from "@/components/ui/input";
import { AuthorizationError, NotFoundError } from "@/lib/auth/guards";
import { countryFlag, countryName } from "@/lib/config/countries";
import { PLATFORMS } from "@/lib/config/games";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import { listTournamentRegistrations } from "@/lib/organiser/registrations";
import { getTournamentWorkspace } from "@/lib/organiser/workspace-access";
import { formatDateTime } from "@/lib/utils/dates";
import {
  REGISTRATION_STATUSES,
  type RegistrationStatus,
  type TournamentStatus,
} from "@/types/domain";

export const metadata = { title: "Registrations" };

interface RegistrationsPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 20;

const STATUS_LABELS: Readonly<Record<RegistrationStatus, string>> = {
  registered: "Registered",
  withdrawn: "Withdrawn",
  removed: "Removed",
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function isRegistrationStatus(value: string): value is RegistrationStatus {
  return (REGISTRATION_STATUSES as readonly string[]).includes(value);
}

function platformName(id: string): string {
  return PLATFORMS.find((platform) => platform.id === id)?.name ?? id;
}

function pageHref(
  id: string,
  filters: { readonly search: string; readonly status: string },
  after?: string | null,
): string {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (after) params.set("after", after);

  const query = params.toString();
  return query
    ? `/organiser/tournaments/${id}/registrations?${query}`
    : `/organiser/tournaments/${id}/registrations`;
}

/** Honest reason the direct-add panel is unavailable at this status. */
function addPanelReason(status: TournamentStatus): string | null {
  switch (status) {
    case "registration_open":
    case "registration_closed":
      return null;
    case "draft":
      return "Publish the competition first — registration has not opened.";
    case "cancelled":
      return "This competition was cancelled.";
    case "suspended":
      return "This competition is suspended.";
    case "completed":
    case "archived":
      return "The competition has finished.";
    default:
      return "The field is locked once the pots are confirmed.";
  }
}

export default async function RegistrationsPage({ params, searchParams }: RegistrationsPageProps) {
  const { id } = await params;

  let workspace: Awaited<ReturnType<typeof getTournamentWorkspace>>;

  try {
    workspace = await getTournamentWorkspace(id);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const { user, tournament } = workspace;
  const query = await searchParams;
  const filters = {
    search: firstQueryValue(query.search) ?? "",
    status: firstQueryValue(query.status) ?? "",
  };
  const status = isRegistrationStatus(filters.status) ? filters.status : null;
  const after = firstQueryValue(query.after);

  const result = await listTournamentRegistrations(id, {
    status,
    search: filters.search || null,
    after,
    pageSize: PAGE_SIZE,
  });

  const total = result.counts.registered + result.counts.withdrawn + result.counts.removed;
  const hasFilters = Boolean(filters.search || filters.status);
  const isOwner = user.userId === tournament.ownerUid;

  // Add/remove work only while registration is open or closed before the pots.
  const fieldEditable =
    tournament.status === "registration_open" || tournament.status === "registration_closed";
  const addReason = addPanelReason(tournament.status);
  const registered = result.counts.registered;
  const fillPercent = Math.min(100, (registered / tournament.maxParticipants) * 100);
  const statusMeta = TOURNAMENT_STATUS_META[tournament.status];

  return (
    <div className="space-y-6">
      {/* Field progress */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>The field</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-grey-400">
              <span className="font-display text-lg font-semibold tabular-nums text-white">
                {registered}
              </span>{" "}
              of{" "}
              <span className="font-display text-lg font-semibold tabular-nums text-white">
                {tournament.maxParticipants}
              </span>{" "}
              places taken ({statusMeta.label.toLowerCase()})
            </p>
            {registered >= tournament.maxParticipants ? (
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-success-soft">
                Full field — pots can be confirmed
              </p>
            ) : null}
          </div>

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={tournament.maxParticipants}
            aria-valuenow={registered}
            aria-label="Registered players"
            className="h-2.5 w-full overflow-hidden rounded-full bg-navy-950"
          >
            <div
              className="h-full rounded-full bg-electric-400 transition-all"
              style={{ width: `${fillPercent}%` }}
            />
          </div>

          <ul className="flex flex-wrap gap-2" aria-label="Registration counts by status">
            <li>
              <Link
                href={pageHref(id, { ...filters, status: "" })}
                aria-current={status === null ? "true" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  status === null
                    ? "border-electric-400/60 bg-electric-500/15 text-white"
                    : "border-white/10 bg-navy-900/60 text-grey-300 hover:border-electric-400/30"
                }`}
              >
                <Users aria-hidden="true" className="h-3.5 w-3.5" />
                All {total}
              </Link>
            </li>
            {REGISTRATION_STATUSES.map((value) => (
              <li key={value}>
                <Link
                  href={pageHref(id, { ...filters, status: value })}
                  aria-current={status === value ? "true" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                    status === value
                      ? "border-electric-400/60 bg-electric-500/15 text-white"
                      : "border-white/10 bg-navy-900/60 text-grey-300 hover:border-electric-400/30"
                  }`}
                >
                  {STATUS_LABELS[value]} {result.counts[value]}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Filters */}
      <form
        method="get"
        className="grid gap-3 rounded-xl border border-white/10 bg-navy-900/60 p-4 md:grid-cols-3"
      >
        <div>
          <label
            htmlFor="registration-search"
            className="mb-1.5 block text-xs font-semibold text-grey-300"
          >
            Search by gamer tag
          </label>
          <Input
            id="registration-search"
            name="search"
            type="search"
            defaultValue={filters.search}
            placeholder="Tag prefix"
            autoComplete="off"
          />
        </div>

        <div>
          <label
            htmlFor="registration-status"
            className="mb-1.5 block text-xs font-semibold text-grey-300"
          >
            Status
          </label>
          <Select id="registration-status" name="status" defaultValue={filters.status}>
            <option value="">All statuses</option>
            {REGISTRATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
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
              href={pageHref(id, { search: "", status: "" })}
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {/* Direct add + owner-only export */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="elevated">
          <CardContent className="pt-6">
            <AddPlayerPanel
              tournamentId={id}
              disabled={Boolean(addReason)}
              disabledReason={addReason}
            />
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardContent className="flex h-full flex-col justify-between gap-4 pt-6">
            <div className="space-y-2">
              <h3 className="font-display text-sm font-semibold uppercase tracking-display text-white">
                Export the field
              </h3>
              <p className="text-sm leading-6 text-grey-400">
                A CSV of the current registered field: gamer tag, full name, country, platform and
                entry time. No phone numbers or email addresses are ever included.
              </p>
            </div>
            {isOwner ? (
              <Link
                href={`/api/organiser/tournaments/${id}/registrations/export`}
                prefetch={false}
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                Download CSV
              </Link>
            ) : (
              <p className="text-xs leading-5 text-grey-500">
                Only the competition owner can export the player list. You are managing this
                competition as a Super Admin.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Entries */}
      {result.rows.length === 0 ? (
        <EmptyState
          icon={Users}
          eyebrow={hasFilters ? "No matching entries" : "No entries yet"}
          title={
            hasFilters
              ? "No entries match those filters"
              : "Nobody has entered this competition yet"
          }
          description={
            hasFilters
              ? "Try a different gamer tag or status. Tag search matches from the start of the tag."
              : "Share the public tournament page — every entry appears here the moment it happens."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-navy-900/60">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <caption className="sr-only">
              Registrations for {tournament.name}, paginated newest first
              {filters.search ? " (matching the searched tag)" : ""}.
            </caption>
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-eyebrow text-grey-500">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Player
                </th>
                <th scope="col" className="hidden px-4 py-3 font-semibold md:table-cell">
                  Country
                </th>
                <th scope="col" className="hidden px-4 py-3 font-semibold md:table-cell">
                  Platform
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">
                  Entered
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr
                  key={row.uid}
                  className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={row.gamerTag || "Player"} src={row.avatarUrl} size="sm" />
                      <Link
                        href={`/players/${row.uid}`}
                        className="font-display text-sm font-semibold uppercase tracking-display text-white underline-offset-4 transition-colors hover:text-electric-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                      >
                        @{row.gamerTag || "player"}
                      </Link>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-grey-300 md:table-cell">
                    {row.country ? (
                      <>
                        <span aria-hidden="true">{countryFlag(row.country)}</span>{" "}
                        {countryName(row.country) ?? row.country}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-grey-300 md:table-cell">
                    {row.platform ? platformName(row.platform) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.status === "registered"
                          ? "font-medium text-success-soft"
                          : "text-grey-400"
                      }
                    >
                      {STATUS_LABELS[row.status]}
                    </span>
                    {row.status === "withdrawn" && row.withdrawnAt ? (
                      <span className="block text-xs text-grey-500">
                        {formatDateTime(row.withdrawnAt)}
                      </span>
                    ) : null}
                    {row.status === "removed" && row.removedAt ? (
                      <span className="block text-xs text-grey-500">
                        {formatDateTime(row.removedAt)}
                      </span>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-grey-400 sm:table-cell">
                    {row.registeredAt ? formatDateTime(row.registeredAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <RegistrationRowActions
                        tournamentId={id}
                        uid={row.uid}
                        gamerTag={row.gamerTag || "player"}
                        canRemove={fieldEditable && row.status === "registered"}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.rows.length > 0 ? (
        <CursorNav
          previousHref={after ? pageHref(id, filters) : null}
          nextHref={result.hasMore && result.lastId ? pageHref(id, filters, result.lastId) : null}
          summary={`Showing ${result.rows.length} of ${total} entries in this competition.`}
          label="Registrations pagination"
        />
      ) : null}

      <p className="text-xs leading-5 text-grey-500">
        Removed players cannot re-enter on their own — only you can add them back while the field is
        still open. Every contact link, removal and addition is recorded in the audit log.
      </p>
    </div>
  );
}
