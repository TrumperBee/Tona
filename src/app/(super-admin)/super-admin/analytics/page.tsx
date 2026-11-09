// GCC - platform analytics.
//
// Exact count() aggregates for every figure except the country breakdown, which
// reads at most USER_SAMPLE_CAP documents and says so. The summary is cached for
// five minutes and can be refreshed on demand.
import { BarChart3, Gamepad2, Globe2, Swords, Ticket, Users } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { AnalyticsRefreshButton } from "@/components/super-admin/analytics-refresh-button";
import { BarChart } from "@/components/super-admin/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/data-display";
import { countryFlag, countryName } from "@/lib/config/countries";
import { GAMES, PLATFORMS } from "@/lib/config/games";
import { getAnalyticsSummary } from "@/lib/super-admin/analytics";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const { summary, cached } = await getAnalyticsSummary();

  const signupData = summary.signupsByDay.map((day) => ({
    label: day.date.slice(5).replace("-", "/"),
    value: day.count,
  }));
  const countryData = summary.usersByCountry.map((item) => ({
    label: item.key,
    value: item.count,
  }));
  const gameData = summary.usersByGame
    .map((item) => ({
      label: GAMES.find((game) => game.id === item.key)?.name ?? item.key,
      value: item.count,
    }))
    .filter((item) => item.value > 0);
  const platformData = summary.usersByPlatform
    .map((item) => ({
      label: PLATFORMS.find((platform) => platform.id === item.key)?.shortName ?? item.key,
      value: item.count,
    }))
    .filter((item) => item.value > 0);
  const tournamentData = summary.tournamentsByStatus
    .filter((item) => item.count > 0)
    .map((item) => ({
      label: item.key.replaceAll("_", " "),
      value: item.count,
    }));
  const last30 = summary.signupsByDay.reduce((sum, day) => sum + day.count, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Super Admin console"
        title="Analytics"
        description="Verified platform metrics with the same numbers the console uses elsewhere. No tracking pixels, no estimates hidden behind a chart library."
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Analytics" }]}
        actions={<AnalyticsRefreshButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={summary.totalUsers} icon={Users} />
        <StatCard
          label="Signups in 30 days"
          value={last30}
          hint="Accounts created in the last 30 days."
          icon={BarChart3}
        />
        <StatCard label="Total tournaments" value={summary.totalTournaments} icon={Swords} />
        <StatCard
          label="Recorded matches"
          value={summary.totalMatches}
          hint={summary.totalMatches === 0 ? "No data yet — matches arrive in Phase 8." : undefined}
          icon={Ticket}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Cached summary</CardTitle>
            <p className="mt-1 text-sm text-grey-400">
              Generated {formatDateTime(summary.generatedAt)} and cached for five minutes.
              {cached ? " This view is using the cached copy." : " It has just been recomputed."}
            </p>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <BarChart
            title="Signups per day"
            description="Accounts created per UTC day over the last 30 days."
            data={signupData}
            valueSuffix=" signups"
            emptyMessage="No signups in the last 30 days."
          />
        </Card>

        <Card className="p-5">
          <BarChart
            title="Users by country"
            description={`Top 10 countries from a sample of ${summary.usersSampled} of up to ${summary.sampleCap} users. This is the only sampled chart.`}
            data={countryData}
            valueSuffix=" users"
            emptyMessage="No country data is available yet."
          />
        </Card>

        <Card className="p-5">
          <BarChart
            title="Users by preferred game"
            description="Exact count per supported title."
            data={gameData}
            valueSuffix=" users"
            emptyMessage="No users have selected a game yet."
          />
        </Card>

        <Card className="p-5">
          <BarChart
            title="Users by platform"
            description="Exact count per supported platform."
            data={platformData}
            valueSuffix=" users"
            emptyMessage="No users have selected a platform yet."
          />
        </Card>

        <Card className="p-5">
          <BarChart
            title="Tournaments by status"
            description="Every tournament, grouped by its current lifecycle status."
            data={tournamentData}
            valueSuffix=" tournaments"
            emptyMessage="No tournaments exist yet. Organisers create them in Phase 8."
          />
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-grey-400">
              <Gamepad2 aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold uppercase tracking-display text-white">
                Matches
              </h3>
              <p className="mt-1 text-sm leading-6 text-grey-400">
                {summary.totalMatches === 0
                  ? "No data yet. Fixtures and match results are created by the tournament flow in Phase 8."
                  : `${summary.totalMatches} matches recorded across all tournaments.`}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top countries</CardTitle>
          </CardHeader>
          <CardContent>
            {countryData.length === 0 ? (
              <p className="text-sm text-grey-400">No country data is available yet.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {summary.usersByCountry.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="flex items-center gap-2 text-grey-200">
                      <Globe2 aria-hidden="true" className="h-4 w-4 text-grey-500" />
                      {countryFlag(item.key)} {countryName(item.key)}
                    </span>
                    <span className="tabular-nums text-white">{item.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-4xl font-semibold tabular-nums text-white">
              {summary.totalRegistrations}
            </p>
            <p className="mt-2 text-sm leading-6 text-grey-400">
              Tournament registrations across the platform. This remains zero until tournament
              registration ships in Phase 8.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
