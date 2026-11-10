// GCC - organiser application review queue.
//
// Pending applications are oldest first so nobody is starved; every other tab
// is newest first. Lists are cursor-paginated and counts come from Firestore
// count() aggregates.
import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { CursorNav } from "@/components/super-admin/cursor-nav";
import { Badge } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button-styles";
import { Avatar, EmptyState } from "@/components/ui/data-display";
import { Table, type TableColumn } from "@/components/ui/table";
import { applicationStatusCounts, listApplications, type ApplicationRow } from "@/lib/applications";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_TONES } from "@/lib/applications/labels";
import { formatDate } from "@/lib/utils/dates";
import { firstQueryValue } from "@/lib/super-admin/query";
import { APPLICATION_STATUSES, isApplicationStatus, type ApplicationStatus } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Applications" };

interface ApplicationsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const REVIEW_TABS: readonly ApplicationStatus[] = [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
  "revoked",
];

function tabHref(status: ApplicationStatus): string {
  return status === "pending"
    ? "/super-admin/applications"
    : `/super-admin/applications?status=${status}`;
}

function listHref(
  status: ApplicationStatus,
  cursor: { readonly after?: string | null; readonly before?: string | null },
): string {
  const params = new URLSearchParams();

  if (status !== "pending") params.set("status", status);
  if (cursor.after) params.set("after", cursor.after);
  if (cursor.before) params.set("before", cursor.before);

  const query = params.toString();
  return query ? `/super-admin/applications?${query}` : "/super-admin/applications";
}

export default async function ApplicationsPage({ searchParams }: ApplicationsPageProps) {
  const params = await searchParams;
  const requested = firstQueryValue(params.status);
  const status: ApplicationStatus = isApplicationStatus(requested) ? requested : "pending";
  const after = firstQueryValue(params.after);
  const before = firstQueryValue(params.before);

  const [result, counts] = await Promise.all([
    listApplications({ status, after, before }),
    applicationStatusCounts(),
  ]);

  const columns: readonly TableColumn<ApplicationRow>[] = [
    {
      key: "applicant",
      header: "Applicant",
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.gamerTag} src={row.avatarUrl} size="sm" />
          <div className="min-w-0">
            <Link
              href={`/super-admin/applications/${row.id}`}
              className="block truncate font-semibold text-white hover:text-electric-300"
            >
              @{row.gamerTag}
            </Link>
            <span className="block truncate text-xs text-grey-500">{row.communityName}</span>
          </div>
        </div>
      ),
    },
    {
      key: "community",
      header: "Community",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-grey-200">{row.communityName}</p>
          <p className="text-xs text-grey-500">{row.expectedPlayers} players</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge tone={APPLICATION_STATUS_TONES[row.status]}>
          {APPLICATION_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: "submitted",
      header: "Submitted",
      render: (row) => (
        <span className="text-sm text-grey-300">
          {row.createdAt ? formatDate(row.createdAt) : "-"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Super Admin console"
        title="Applications"
        description="Review players who want to organise competitions. Pending applications are worked oldest first; every decision is audited and notifies the applicant."
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Applications" }]}
      />

      <nav
        aria-label="Application status"
        className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/10"
      >
        {REVIEW_TABS.map((tab) => {
          const active = tab === status;

          return (
            <Link
              key={tab}
              href={tabHref(tab)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative shrink-0 rounded-t-md px-4 py-2.5 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950",
                active
                  ? "text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-electric-400"
                  : "text-grey-400 hover:bg-white/[0.04] hover:text-grey-200",
              )}
            >
              {APPLICATION_STATUS_LABELS[tab]}
              <span className="ml-2 rounded-full bg-white/[0.08] px-2 py-0.5 text-xs tabular-nums text-grey-300">
                {counts[tab]}
              </span>
            </Link>
          );
        })}
      </nav>

      {result.rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          eyebrow={`No ${APPLICATION_STATUS_LABELS[status].toLowerCase()} applications`}
          title={`Nothing in ${APPLICATION_STATUS_LABELS[status].toLowerCase()}`}
          description="Real applications appear here only when a player submits one. This queue never shows sample or seeded records."
          action={
            status !== "pending" ? (
              <Link href="/super-admin/applications" className={buttonStyles({ size: "sm" })}>
                View pending
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={result.rows}
            getRowKey={(row) => row.id}
            caption={`${APPLICATION_STATUS_LABELS[status]} applications, page showing ${result.rows.length} of ${result.total}.`}
          />
          <CursorNav
            previousHref={
              (after || before) && result.firstId
                ? listHref(status, { before: result.firstId })
                : null
            }
            nextHref={
              result.hasMore && result.lastId ? listHref(status, { after: result.lastId }) : null
            }
            summary={`Showing ${result.rows.length} of ${result.total} ${APPLICATION_STATUS_LABELS[
              status
            ].toLowerCase()} applications.`}
          />
        </>
      )}

      <p className="text-xs text-grey-500">
        Statuses available: {APPLICATION_STATUSES.join(", ")}. A revoked approval is shown
        separately so the history stays readable.
      </p>
    </div>
  );
}
