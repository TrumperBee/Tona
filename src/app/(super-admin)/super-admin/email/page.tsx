// GCC - Super Admin email operations.
//
// Daily and monthly counters, the suppression count, the last twenty failures
// and the two privileged email controls. No address or message body is shown.
import { AlertTriangle, Mail, MailX, ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { EmailTools } from "@/components/super-admin/email-tools";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/data-display";
import { Table, type TableColumn } from "@/components/ui/table";
import type { EmailFailureRow } from "@/lib/email/failures";
import { getEmailOperationsOverview } from "@/lib/email/operations";
import { getPlatformSettings } from "@/lib/platform/settings";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata = { title: "Email" };

const failureColumns: readonly TableColumn<EmailFailureRow>[] = [
  {
    key: "createdAt",
    header: "When",
    render: (row) => (row.createdAt ? formatDateTime(row.createdAt) : "—"),
  },
  {
    key: "kind",
    header: "Kind",
    render: (row) => <span className="font-mono text-xs">{row.kind}</span>,
  },
  { key: "reason", header: "Reason", render: (row) => row.reason },
  {
    key: "status",
    header: "HTTP",
    align: "right",
    render: (row) => (row.status === null ? "—" : row.status),
  },
];

export default async function EmailOperationsPage() {
  const [overview, settings] = await Promise.all([
    getEmailOperationsOverview(),
    getPlatformSettings(),
  ]);
  const { usage } = overview;
  const dailyWarning = usage.daily.sent >= usage.normalCap;
  const monthlyWarning = usage.monthly.sent >= usage.monthlyWarnAt;
  const remainingNormal = Math.max(0, usage.normalCap - usage.daily.sent);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Super Admin console"
        title="Email"
        description="Delivery health, quota and the two controls that affect real recipients. Addresses and message bodies are never stored here."
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Email" }]}
      />

      {dailyWarning || monthlyWarning ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-soft"
        >
          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1">
            {dailyWarning
              ? `Normal email has reached the 80% daily cap (${usage.daily.sent}/${usage.dailyLimit}). Only critical mail can use the remainder today.`
              : `Monthly email is at ${usage.monthly.sent}/${usage.monthlyLimit}, past the 80% warning point.`}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sent today (UTC)"
          value={`${usage.daily.sent} / ${usage.dailyLimit}`}
          hint={`${usage.daily.skipped} skipped, ${usage.daily.failed} failed.`}
          icon={Mail}
        />
        <StatCard
          label="Sent this month"
          value={`${usage.monthly.sent} / ${usage.monthlyLimit}`}
          hint={`Warning at ${usage.monthlyWarnAt}.`}
          icon={Mail}
        />
        <StatCard
          label="Suppressed addresses"
          value={overview.suppressions}
          hint="Hard bounces and complaints, stored as SHA-256 hashes."
          icon={MailX}
        />
        <StatCard
          label="Configuration"
          value={overview.apiConfigured ? "Ready" : "Incomplete"}
          hint={`API ${overview.apiConfigured ? "set" : "missing"} · webhook ${
            overview.webhookConfigured ? "set" : "missing"
          } · unsubscribe ${overview.unsubscribeConfigured ? "set" : "missing"}`}
          icon={ShieldAlert}
        />
      </div>

      <EmailTools
        initialEmailAnnouncements={settings.emailAnnouncements}
        announcementRecipients={overview.announcementRecipients}
        remainingNormal={remainingNormal}
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent failures</CardTitle>
          <CardDescription>
            The last {overview.failures.length} failed sends. Only the kind, reason and status are
            recorded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table
            columns={failureColumns}
            rows={overview.failures}
            getRowKey={(row) => row.id}
            caption="Recent email send failures"
            emptyState={
              <p className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-grey-400">
                No send failures recorded.
              </p>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
