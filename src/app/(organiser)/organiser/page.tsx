// GCC - Organiser dashboard.
//
// Real Firestore data only: owned tournaments, registration totals, active
// slot usage against the platform limit, honest attention items and the audit
// trail for competitions the organiser owns.
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  Layers,
  Plus,
  ScrollText,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, StatCard } from "@/components/ui/data-display";
import { TOURNAMENT_STATUS_META } from "@/lib/config/tournament-status";
import { requirePageRole } from "@/lib/auth/page-access";
import { ensureOrganiserProfile } from "@/lib/organiser/profile";
import { getOrganiserOverview } from "@/lib/organiser/overview";
import { TOURNAMENT_STATUSES } from "@/types/domain";
import { formatDate } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Organiser dashboard" };

const attentionStyles: Record<string, string> = {
  "closing-soon": "border-warning/40 bg-warning/10 text-warning-soft",
  "full-open": "border-info/40 bg-electric-500/10 text-electric-200",
  "full-unconfirmed": "border-info/40 bg-electric-500/10 text-electric-200",
  suspended: "border-danger/40 bg-danger/10 text-danger-soft",
};

export default async function OrganiserPage() {
  const user = await requirePageRole("organiser", "/organiser");

  // The public profile is ensured on first entry to the organiser area. A
  // failure here never blocks the dashboard.
  const profile = await ensureOrganiserProfile(user.userId).catch(() => null);
  const overview = await getOrganiserOverview(user);

  const atLimit = !overview.exemptFromSlotLimit && overview.activeSlots >= overview.maxActiveSlots;
  const ownedStatuses = TOURNAMENT_STATUSES.filter((status) => overview.statusCounts[status] > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Organiser workspace"
        title="Organiser dashboard"
        description={
          profile
            ? `The operational home for ${profile.organisationName}: your competitions, their entrants and what needs attention next.`
            : "The operational home for the competitions you own: entries, draw, fixtures, results and records."
        }
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Organiser" }]}
        actions={
          <Link
            href="/organiser/tournaments/new"
            aria-disabled={atLimit}
            className={cn(
              buttonStyles({ size: "sm" }),
              atLimit && "pointer-events-none opacity-50",
            )}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Create tournament
          </Link>
        }
      />

      {!profile ? (
        <Card variant="outline" className="border-gold-400/40 bg-gold-400/5">
          <CardContent className="space-y-2">
            <p className="text-sm font-semibold text-gold-200">Publish your organiser profile</p>
            <p className="text-sm leading-6 text-grey-300">
              Your competitions cannot show an organiser yet. Save your organisation name once and
              every tournament you run will credit it, with a public page listing your competitions.
            </p>
            <Link
              href="/organiser/settings"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              Set up your organiser profile
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Tournaments owned"
          value={overview.totalTournaments}
          hint="Every competition recorded under your account, at any stage."
          icon={Trophy}
        />
        <StatCard
          label="Total registrations"
          value={overview.totalRegistrations}
          hint="Entrants summed across every competition you own."
          icon={Users}
        />
        <StatCard
          label="Active tournament slots"
          value={`${overview.activeSlots} of ${overview.maxActiveSlots}`}
          hint={
            overview.exemptFromSlotLimit
              ? "Super Admin is exempt from the active tournament limit."
              : "Registration-open through knockout. Drafts, suspended and finished competitions do not count."
          }
          icon={Layers}
        />
      </div>

      {atLimit ? (
        <p role="note" className="text-sm leading-6 text-grey-300">
          You are using {overview.activeSlots} of {overview.maxActiveSlots} active tournament slots.
          Creating a new tournament unlocks when a competition completes, is cancelled, or the
          platform limit is raised by a Super Admin.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Competition status</CardTitle>
        </CardHeader>
        <CardContent>
          {ownedStatuses.length === 0 ? (
            <p className="text-sm leading-6 text-grey-400">
              You do not own any tournaments yet. Once created, each competition appears here with
              its real lifecycle stage.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {ownedStatuses.map((status) => (
                <li key={status} className="flex items-center gap-2">
                  <Badge tone={TOURNAMENT_STATUS_META[status].tone}>
                    {TOURNAMENT_STATUS_META[status].label}
                  </Badge>
                  <span className="text-sm tabular-nums text-grey-300">
                    {overview.statusCounts[status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-warning-soft" />
            Needs attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overview.attention.length === 0 ? (
            <p className="text-sm leading-6 text-grey-400">
              Nothing needs your attention right now. When a registration window is about to close,
              a field fills up, or a competition is suspended, it is listed here.
            </p>
          ) : (
            <ul className="space-y-3">
              {overview.attention.map((item) => (
                <li key={`${item.tournamentId}-${item.kind}`}>
                  <Link
                    href={`/organiser/tournaments/${item.tournamentId}`}
                    className={cn(
                      "block rounded-lg border p-4 text-sm leading-6 transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
                      attentionStyles[item.kind] ?? "border-white/15 bg-navy-900/60 text-grey-200",
                    )}
                  >
                    <span className="font-semibold">{item.tournamentName}</span>
                    <span className="sr-only"> — </span>
                    {item.message}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText aria-hidden="true" className="h-4 w-4 text-electric-300" />
            Recent platform activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overview.recentAudit.length === 0 ? (
            <p className="text-sm leading-6 text-grey-400">
              No platform actions have been recorded against your competitions yet. Every privileged
              action is written to an append-only audit log.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {overview.recentAudit.map((row) => (
                <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
                  <span className="text-sm font-medium text-grey-100">{row.label}</span>
                  {row.tournamentName ? (
                    <Link
                      href={`/organiser/tournaments/${row.tournamentId}`}
                      className="text-xs text-electric-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                    >
                      {row.tournamentName}
                    </Link>
                  ) : null}
                  <span className="ml-auto text-xs text-grey-500">
                    {row.createdAt ? formatDate(row.createdAt) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {overview.totalTournaments === 0 ? (
        <EmptyState
          icon={ClipboardList}
          eyebrow="No tournaments yet"
          title="You do not own any competitions"
          description={
            <>
              When tournament creation opens, your drafts and competitions are managed from this
              workspace. Nothing here is ever filled with sample data.
            </>
          }
          action={
            <Link href="/organiser/tournaments" className={buttonStyles({ size: "sm" })}>
              Open your tournament list
            </Link>
          }
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <Link
            href="/organiser/tournaments"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            <CalendarClock aria-hidden="true" className="h-4 w-4" />
            Open your tournament list
          </Link>
        </div>
      )}
    </div>
  );
}
