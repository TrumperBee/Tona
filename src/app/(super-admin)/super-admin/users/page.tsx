// GCC - Super Admin user list.
//
// Newest-first, cursor-paginated, exact-email or gamer-tag prefix search, and
// equality filters in the order declared by the composite indexes.
import { Search, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { CursorNav } from "@/components/super-admin/cursor-nav";
import { RoleBadge, StatusBadge } from "@/components/super-admin/badges";
import { buttonStyles } from "@/components/ui/button-styles";
import { Avatar, EmptyState } from "@/components/ui/data-display";
import { Input, Select } from "@/components/ui/input";
import { Table, type TableColumn } from "@/components/ui/table";
import { buildCountryOptions } from "@/lib/config/countries";
import { GAMES, isGameId } from "@/lib/config/games";
import { listUsers, type UserListRow } from "@/lib/super-admin/users";
import { firstQueryValue } from "@/lib/super-admin/query";
import { formatDate } from "@/lib/utils/dates";
import { ACCOUNT_STATUSES, isAccountStatus, isUserRole, USER_ROLES } from "@/types/domain";

export const metadata = { title: "Users" };

interface UsersPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface Filters {
  readonly search: string;
  readonly role: string;
  readonly status: string;
  readonly country: string;
  readonly game: string;
}

function readFilters(params: Record<string, string | string[] | undefined>): Filters {
  return {
    search: firstQueryValue(params.search) ?? "",
    role: firstQueryValue(params.role) ?? "",
    status: firstQueryValue(params.status) ?? "",
    country: firstQueryValue(params.country) ?? "",
    game: firstQueryValue(params.game) ?? "",
  };
}

function listHref(
  filters: Filters,
  cursor: { readonly after?: string | null; readonly before?: string | null } = {},
): string {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (filters.country) params.set("country", filters.country);
  if (filters.game) params.set("game", filters.game);
  if (cursor.after) params.set("after", cursor.after);
  if (cursor.before) params.set("before", cursor.before);

  const query = params.toString();
  return query ? `/super-admin/users?${query}` : "/super-admin/users";
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams;
  const filters = readFilters(params);
  const after = firstQueryValue(params.after);
  const before = firstQueryValue(params.before);
  const role = isUserRole(filters.role) ? filters.role : undefined;
  const status = isAccountStatus(filters.status) ? filters.status : undefined;
  const country = /^[A-Z]{2}$/.test(filters.country) ? filters.country : undefined;
  const game = isGameId(filters.game) ? filters.game : undefined;

  const result = await listUsers({
    role,
    status,
    country,
    game,
    search: filters.search || null,
    after,
    before,
  });

  const columns: readonly TableColumn<UserListRow>[] = [
    {
      key: "player",
      header: "Player",
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.gamerTag} src={row.avatarUrl} size="sm" />
          <div className="min-w-0">
            <Link
              href={`/super-admin/users/${row.uid}`}
              className="block truncate font-semibold text-white hover:text-electric-300"
            >
              @{row.gamerTag}
            </Link>
            <span className="block truncate text-xs text-grey-500">{row.fullName}</span>
          </div>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (row) => <span className="break-all text-sm text-grey-300">{row.email}</span>,
    },
    {
      key: "country",
      header: "Country",
      render: (row) => <span className="text-sm text-grey-300">{row.country || "—"}</span>,
    },
    {
      key: "role",
      header: "Role",
      render: (row) => <RoleBadge role={row.role} />,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "joined",
      header: "Joined",
      render: (row) => (
        <span className="text-sm text-grey-300">
          {row.createdAt ? formatDate(row.createdAt) : "—"}
        </span>
      ),
    },
  ];

  const countries = buildCountryOptions();
  const hasFilters = Boolean(
    filters.search || filters.role || filters.status || filters.country || filters.game,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Super Admin console"
        title="Users"
        description="Every account, newest first. Search an exact email address or a gamer-tag prefix, then narrow by role, status, country or game."
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Users" }]}
      />

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-white/10 bg-navy-900/60 p-4 md:grid-cols-2 xl:grid-cols-6"
      >
        <div className="xl:col-span-2">
          <label htmlFor="user-search" className="mb-1.5 block text-xs font-semibold text-grey-300">
            Search
          </label>
          <Input
            id="user-search"
            name="search"
            type="search"
            defaultValue={filters.search}
            placeholder="Exact email or tag prefix"
          />
        </div>

        <div>
          <label htmlFor="user-role" className="mb-1.5 block text-xs font-semibold text-grey-300">
            Role
          </label>
          <Select id="user-role" name="role" defaultValue={filters.role}>
            <option value="">All roles</option>
            {USER_ROLES.map((value) => (
              <option key={value} value={value}>
                {value.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="user-status" className="mb-1.5 block text-xs font-semibold text-grey-300">
            Status
          </label>
          <Select id="user-status" name="status" defaultValue={filters.status}>
            <option value="">All statuses</option>
            {ACCOUNT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label
            htmlFor="user-country"
            className="mb-1.5 block text-xs font-semibold text-grey-300"
          >
            Country
          </label>
          <Select id="user-country" name="country" defaultValue={filters.country}>
            <option value="">All countries</option>
            {countries.map((countryOption) => (
              <option key={countryOption.code} value={countryOption.code}>
                {countryOption.flag} {countryOption.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="user-game" className="mb-1.5 block text-xs font-semibold text-grey-300">
            Game
          </label>
          <Select id="user-game" name="game" defaultValue={filters.game}>
            <option value="">All games</option>
            {GAMES.map((gameOption) => (
              <option key={gameOption.id} value={gameOption.id}>
                {gameOption.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6">
          <button type="submit" className={buttonStyles({ size: "sm" })}>
            <Search aria-hidden="true" className="h-4 w-4" />
            Apply filters
          </button>
          {hasFilters ? (
            <Link
              href="/super-admin/users"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              Clear
            </Link>
          ) : null}
          <span className="ml-auto text-xs text-grey-500">
            {result.searchMode === "email"
              ? "Exact email match"
              : result.searchMode === "tag"
                ? "Gamer-tag prefix match"
                : "Newest first"}
          </span>
        </div>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState
          icon={Users}
          eyebrow={hasFilters ? "No matching accounts" : "No accounts yet"}
          title={hasFilters ? "No users match those filters" : "No users have registered yet"}
          description={
            hasFilters
              ? "Try a different role, status, country, game or search term. Email search requires the full address; tag search matches from the start of the tag."
              : "Real accounts appear here as soon as players register. This console never shows sample users."
          }
          action={
            hasFilters ? (
              <Link href="/super-admin/users" className={buttonStyles({ size: "sm" })}>
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={result.rows}
            getRowKey={(row) => row.uid}
            caption={`Users, page showing ${result.rows.length} of ${result.total}.`}
          />
          <CursorNav
            previousHref={
              (after || before) && result.firstId
                ? listHref(filters, { before: result.firstId })
                : null
            }
            nextHref={
              result.hasMore && result.lastId ? listHref(filters, { after: result.lastId }) : null
            }
            summary={`Showing ${result.rows.length} of ${result.total} matching accounts.`}
          />
        </>
      )}
    </div>
  );
}
