// GCC - Super Admin result-report oversight.
//
// One collection-group query spans every tournament. The same audited Resolve /
// Dismiss control used by organisers is rendered here; the tournament link opens
// the organiser workspace because Super Admin can act on any competition.
import { Flag, Swords } from "lucide-react";
import Link from "next/link";

import { ResultReportActions } from "@/components/organiser/result-report-actions";
import { PageHeader } from "@/components/shared/page-header";
import { CursorNav } from "@/components/super-admin/cursor-nav";
import { Badge, Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { listAllResultReports } from "@/lib/tournament/result-reports";
import { firstQueryValue } from "@/lib/super-admin/query";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata = { title: "Result reports" };

interface SuperAdminResultReportsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const FILTERS = [
  { value: null, label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
] as const;

function pageHref(
  status: string | null,
  cursor: { readonly after?: string | null; readonly before?: string | null } = {},
): string {
  const params = new URLSearchParams();

  if (status) params.set("status", status);
  if (cursor.after) params.set("after", cursor.after);
  if (cursor.before) params.set("before", cursor.before);

  const query = params.toString();
  return `/super-admin/result-reports${query ? `?${query}` : ""}`;
}

function toneFor(status: string): "warning" | "success" | "neutral" {
  if (status === "open") return "warning";
  if (status === "resolved") return "success";
  return "neutral";
}

export default async function SuperAdminResultReportsPage({
  searchParams,
}: SuperAdminResultReportsPageProps) {
  const query = await searchParams;
  const status = firstQueryValue(query.status);
  const after = firstQueryValue(query.after);
  const before = firstQueryValue(query.before);
  const view = await listAllResultReports({ status, after, before });
  const activeFilter =
    status === "open" || status === "resolved" || status === "dismissed" ? status : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Super Admin console"
        title="Result reports"
        description="Cross-tournament oversight of player result reports. Resolve or dismiss with a note; the reporter is notified and every decision is audited."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={pageHref(filter.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeFilter === filter.value
                ? "border-electric-400/40 bg-electric-500/10 text-electric-200"
                : "border-white/15 bg-white/[0.03] text-grey-300 hover:border-white/30 hover:text-white"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {view.rows.length === 0 ? (
        <EmptyState
          icon={Flag}
          eyebrow="Oversight"
          title={activeFilter ? `No ${activeFilter} reports` : "No result reports"}
          description="Reports appear only when a player asks an organiser to review a recorded result. Nothing is seeded for this list."
        />
      ) : (
        <>
          <ul className="space-y-4">
            {view.rows.map((report) => (
              <li key={`${report.tournamentId}-${report.id}`}>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/organiser/tournaments/${report.tournamentId}/results${
                            report.match ? `?match=${report.match.id}` : ""
                          }`}
                          className="text-sm font-semibold text-white underline-offset-4 hover:underline"
                        >
                          {report.tournamentName}
                        </Link>
                        <p className="mt-0.5 text-xs text-grey-500">
                          {report.reportedByTag} ·{" "}
                          {report.createdAt ? formatDateTime(report.createdAt) : "Just now"}
                        </p>
                      </div>
                      <Badge tone={toneFor(report.status)}>{report.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-white/10 bg-navy-950/50 p-3">
                      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                        <Swords aria-hidden="true" className="h-3.5 w-3.5" />
                        Matchday {report.match?.matchday ?? "—"}
                      </p>
                      <p className="mt-1 text-sm font-medium text-grey-100">
                        {report.match
                          ? `${report.match.homeTag} ${
                              report.match.homeGoals ?? "–"
                            } - ${report.match.awayGoals ?? "–"} ${report.match.awayTag}`
                          : "The match document is no longer available."}
                      </p>
                      {report.match ? (
                        <Link
                          href={`/tournaments/${report.tournamentSlug}/matches/${report.match.id}`}
                          className="mt-2 inline-flex text-xs font-semibold text-electric-300 underline-offset-4 hover:underline"
                        >
                          Open public match page
                        </Link>
                      ) : null}
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                        Player&apos;s reason
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-grey-300">
                        {report.reason}
                      </p>
                    </div>

                    {report.adminNote ? (
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                          Admin note
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-6 text-grey-300">
                          {report.adminNote}
                        </p>
                      </div>
                    ) : null}

                    <ResultReportActions
                      tournamentId={report.tournamentId}
                      reportId={report.id}
                      status={report.status}
                    />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          <CursorNav
            previousHref={
              (after || before) && view.firstCursor
                ? pageHref(activeFilter, { before: view.firstCursor })
                : null
            }
            nextHref={
              view.hasMore && view.lastCursor
                ? pageHref(activeFilter, { after: view.lastCursor })
                : null
            }
            summary={`Showing ${view.rows.length} of ${view.total} reports.`}
          />
        </>
      )}
    </div>
  );
}
