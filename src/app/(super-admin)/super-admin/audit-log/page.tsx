// GCC - Super Admin audit log viewer.
//
// Read-only. Filters are action, actor (tag prefix or UID), target type and a
// date range. Expanded rows show redacted before/after JSON and the reason.
import { Filter, ScrollText } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { CursorNav } from "@/components/super-admin/cursor-nav";
import { buttonStyles } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input, Select } from "@/components/ui/input";
import { auditValueToJson } from "@/lib/audit/redact";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import {
  auditFiltersFromSearchParams,
  listAuditLogs,
  type AuditListRow,
} from "@/lib/super-admin/audit";
import { firstQueryValue } from "@/lib/super-admin/query";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata = { title: "Audit log" };

const TARGET_TYPES = ["user", "announcement", "platformSettings", "tournament"] as const;

interface AuditPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface FilterValues {
  readonly action: string;
  readonly actor: string;
  readonly targetType: string;
  readonly from: string;
  readonly to: string;
}

function readFilterValues(params: Record<string, string | string[] | undefined>): FilterValues {
  return {
    action: firstQueryValue(params.action) ?? "",
    actor: firstQueryValue(params.actor) ?? "",
    targetType: firstQueryValue(params.targetType) ?? "",
    from: firstQueryValue(params.from) ?? "",
    to: firstQueryValue(params.to) ?? "",
  };
}

function auditHref(
  filters: FilterValues,
  cursor: { readonly after?: string | null; readonly before?: string | null } = {},
): string {
  const params = new URLSearchParams();

  if (filters.action) params.set("action", filters.action);
  if (filters.actor) params.set("actor", filters.actor);
  if (filters.targetType) params.set("targetType", filters.targetType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (cursor.after) params.set("after", cursor.after);
  if (cursor.before) params.set("before", cursor.before);

  const query = params.toString();
  return query ? `/super-admin/audit-log?${query}` : "/super-admin/audit-log";
}

function JsonBlock({ label, value }: { readonly label: string; readonly value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">{label}</p>
        <p className="mt-1 text-xs text-grey-500">No value recorded.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">{label}</p>
      <pre className="mt-1 max-h-72 overflow-auto rounded-lg border border-white/10 bg-navy-950/70 p-3 text-xs leading-5 text-grey-300">
        {auditValueToJson(value)}
      </pre>
    </div>
  );
}

function AuditRow({ row }: { readonly row: AuditListRow }) {
  return (
    <li>
      <Card className="overflow-hidden">
        <details>
          <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 p-4 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{row.label}</p>
              <p className="mt-0.5 text-xs text-grey-500">
                <code>{row.action}</code> · {row.targetType} · {row.targetId}
              </p>
              {row.reason ? (
                <p className="mt-1 max-w-2xl text-xs leading-5 text-grey-400">{row.reason}</p>
              ) : null}
            </div>
            <div className="text-right text-xs text-grey-500">
              <p>{row.createdAt ? formatDateTime(row.createdAt) : "—"}</p>
              <p className="mt-0.5">Actor {row.actorUid}</p>
            </div>
          </summary>
          <div className="grid gap-4 border-t border-white/10 p-4 lg:grid-cols-2">
            <JsonBlock label="Before" value={row.before} />
            <JsonBlock label="After" value={row.after} />
            <div className="lg:col-span-2">
              <p className="text-xs text-grey-500">
                Entry {row.id} · actor UID {row.actorUid} · role {row.actorRole}
              </p>
            </div>
          </div>
        </details>
      </Card>
    </li>
  );
}

export default async function AuditLogPage({ searchParams }: AuditPageProps) {
  const params = await searchParams;
  const values = readFilterValues(params);
  const filters = auditFiltersFromSearchParams(params);
  const after = firstQueryValue(params.after);
  const before = firstQueryValue(params.before);

  const result = await listAuditLogs({
    action: filters.action,
    actor: filters.actor,
    targetType: filters.targetType,
    from: filters.from,
    to: filters.to,
    after,
    before,
  });

  const hasFilters = Boolean(
    values.action || values.actor || values.targetType || values.from || values.to,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Super Admin console"
        title="Audit log"
        description="Every privileged action, newest first. This viewer is read-only; entries can never be edited or deleted from the console."
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Audit log" }]}
      />

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-white/10 bg-navy-900/60 p-4 md:grid-cols-2 xl:grid-cols-6"
      >
        <div>
          <label
            htmlFor="audit-action"
            className="mb-1.5 block text-xs font-semibold text-grey-300"
          >
            Action
          </label>
          <Select id="audit-action" name="action" defaultValue={values.action}>
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((item) => (
              <option key={item.action} value={item.action}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="audit-actor" className="mb-1.5 block text-xs font-semibold text-grey-300">
            Actor
          </label>
          <Input
            id="audit-actor"
            name="actor"
            defaultValue={values.actor}
            placeholder="Tag prefix or UID"
          />
        </div>

        <div>
          <label
            htmlFor="audit-target"
            className="mb-1.5 block text-xs font-semibold text-grey-300"
          >
            Target type
          </label>
          <Select id="audit-target" name="targetType" defaultValue={values.targetType}>
            <option value="">All targets</option>
            {TARGET_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="audit-from" className="mb-1.5 block text-xs font-semibold text-grey-300">
            From
          </label>
          <Input id="audit-from" name="from" type="date" defaultValue={values.from} />
        </div>

        <div>
          <label htmlFor="audit-to" className="mb-1.5 block text-xs font-semibold text-grey-300">
            To
          </label>
          <Input id="audit-to" name="to" type="date" defaultValue={values.to} />
        </div>

        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
          <button type="submit" className={buttonStyles({ size: "sm" })}>
            <Filter aria-hidden="true" className="h-4 w-4" />
            Filter
          </button>
        </div>

        {hasFilters ? (
          <div className="md:col-span-2 xl:col-span-6">
            <Link
              href="/super-admin/audit-log"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              Clear filters
            </Link>
          </div>
        ) : null}
      </form>

      {result.rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          eyebrow={hasFilters ? "No matching entries" : "No privileged actions yet"}
          title={hasFilters ? "No audit entries match those filters" : "The audit log is empty"}
          description={
            hasFilters
              ? "Try a different action, actor, target type or date range. Actor search matches a gamer-tag prefix or an exact UID."
              : "Account status changes, role changes, settings updates and announcement writes are recorded here with before/after values."
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {result.rows.map((row) => (
              <AuditRow key={row.id} row={row} />
            ))}
          </ul>
          <CursorNav
            previousHref={
              (after || before) && result.firstId
                ? auditHref(values, { before: result.firstId })
                : null
            }
            nextHref={
              result.hasMore && result.lastId ? auditHref(values, { after: result.lastId }) : null
            }
            summary={`Showing ${result.rows.length} of ${result.total} matching entries.`}
          />
        </>
      )}

      <p className="text-xs leading-5 text-grey-500">
        Sensitive keys such as phone numbers, tokens and secrets are redacted before display. The
        action filter lists only known actions; unknown codes still appear in the log.
      </p>
    </div>
  );
}
