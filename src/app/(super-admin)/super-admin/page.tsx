// GCC - Super Admin overview.
//
// Every figure is a Firestore count() aggregate; recent activity is the latest
// ten audit entries. Nothing on this page is simulated.
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Megaphone,
  ScrollText,
  Settings,
  ShieldCheck,
  Swords,
  Ticket,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import Link from "next/link";

import { PageHeader, SectionHeading } from "@/components/shared/page-header";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/data-display";
import { buttonStyles } from "@/components/ui/button-styles";
import { getOverview } from "@/lib/super-admin/overview";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata = { title: "Super Admin overview" };

const quickLinks = [
  {
    href: "/super-admin/users",
    label: "Manage users",
    description: "Search accounts, roles and status",
    icon: Users,
  },
  {
    href: "/super-admin/announcements",
    label: "Announcements",
    description: "Publish or edit platform notices",
    icon: Megaphone,
  },
  {
    href: "/super-admin/audit-log",
    label: "Audit log",
    description: "Review privileged actions",
    icon: ScrollText,
  },
  {
    href: "/super-admin/settings",
    label: "Settings",
    description: "Maintenance and registration controls",
    icon: Settings,
  },
] as const;

export default async function SuperAdminPage() {
  const overview = await getOverview();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Super Admin console"
        title="Platform overview"
        description="Live account, competition and review figures from Firestore. Counts are exact aggregates; the console never reads a whole collection to produce them."
      />

      <section aria-labelledby="accounts-heading">
        <SectionHeading
          eyebrow="Accounts"
          title="People on the platform"
          action={
            <Link
              href="/super-admin/users"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              Open user management
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          }
        />
        <h2 id="accounts-heading" className="sr-only">
          Account metrics
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total users" value={overview.users.total} icon={Users} />
          <StatCard label="Active" value={overview.users.active} icon={UserCheck} />
          <StatCard label="Suspended" value={overview.users.suspended} icon={UserX} />
          <StatCard label="Banned" value={overview.users.banned} icon={UserX} />
          <StatCard
            label="Tournament organisers"
            value={overview.users.organisers}
            icon={ShieldCheck}
          />
          <StatCard
            label="Recent signups"
            value={overview.users.recentSignups}
            hint="Accounts created in the last 7 days."
            icon={UserPlus}
          />
          <StatCard
            label="Pending applications"
            value={overview.pendingApplications}
            hint="Organiser applications waiting for review."
            icon={ClipboardList}
          />
          <StatCard
            label="Total registrations"
            value={overview.totalRegistrations}
            hint="Entrants across every tournament."
            icon={Ticket}
          />
        </div>
      </section>

      <section aria-labelledby="competitions-heading">
        <SectionHeading
          eyebrow="Competitions"
          title="Tournament activity"
          action={
            <Link
              href="/super-admin/tournaments"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              View tournaments
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          }
        />
        <h2 id="competitions-heading" className="sr-only">
          Competition metrics
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total tournaments" value={overview.tournaments.total} icon={Trophy} />
          <StatCard
            label="Active tournaments"
            value={overview.tournaments.active}
            hint="registration_open through knockout."
            icon={Swords}
          />
          <StatCard label="Completed" value={overview.tournaments.completed} icon={Trophy} />
          <StatCard
            label="Draft"
            value={overview.tournaments.draft}
            hint="Not published to players."
            icon={ClipboardList}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <p className="mt-1 text-sm text-grey-400">
                The latest ten privileged actions, newest first.
              </p>
            </div>
            <Link
              href="/super-admin/audit-log"
              className={buttonStyles({ variant: "ghost", size: "sm" })}
            >
              Full audit log
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {overview.activity.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 bg-navy-900/30 px-4 py-10 text-center">
                <Activity aria-hidden="true" className="mx-auto h-6 w-6 text-grey-500" />
                <p className="mt-3 text-sm font-semibold text-white">No privileged actions yet</p>
                <p className="mt-1 text-xs leading-5 text-grey-400">
                  Changes to users, settings and announcements will be recorded here.
                </p>
              </div>
            ) : (
              <ol className="divide-y divide-white/10">
                {overview.activity.map((entry) => (
                  <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{entry.label}</p>
                        <p className="mt-0.5 text-xs text-grey-400">
                          {entry.targetType} · {entry.targetId}
                        </p>
                        {entry.reason ? (
                          <p className="mt-1 text-xs leading-5 text-grey-500">{entry.reason}</p>
                        ) : null}
                      </div>
                      <div className="text-right text-xs text-grey-500">
                        <p>{entry.createdAt ? formatDateTime(entry.createdAt) : "—"}</p>
                        <p className="mt-0.5">
                          {entry.actorGamerTag ? `@${entry.actorGamerTag}` : entry.actorUid}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-grey-300">Maintenance mode</span>
                <Badge tone={overview.settings.maintenanceMode ? "danger" : "success"}>
                  {overview.settings.maintenanceMode ? "On" : "Off"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-grey-300">Registrations</span>
                <Badge tone={overview.settings.registrationsOpen ? "success" : "warning"}>
                  {overview.settings.registrationsOpen ? "Open" : "Closed"}
                </Badge>
              </div>
              {overview.settings.maintenanceMode ? (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs leading-5 text-danger-soft">
                  Non-Super-Admin writes are rejected with HTTP 503:{" "}
                  {overview.settings.maintenanceMessage}
                </p>
              ) : null}
              <Link
                href="/super-admin/settings"
                className={buttonStyles({ variant: "secondary", size: "sm", className: "w-full" })}
              >
                Open settings
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick links</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {quickLinks.map((item) => {
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                      >
                        <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 text-electric-300" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-white">
                            {item.label}
                          </span>
                          <span className="block text-xs text-grey-400">{item.description}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
