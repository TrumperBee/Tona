// GCC - rankings.
// Rankings are derived from verified results; no table exists until a season
// has verified matches, so the page shows an honest empty state.
import { ArrowRight, BarChart3, ListChecks, ShieldCheck, TrendingUp } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button-styles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";

export const metadata = {
  title: "Rankings",
  description:
    "How GCC rankings are earned from verified competition results, and what the ranking table will show.",
};

const columns = [
  { label: "Position", description: "Ordered by the published ranking rules" },
  { label: "Player", description: "Public gamer tag and country" },
  { label: "Tournaments", description: "Completed competitions entered" },
  { label: "Played", description: "Confirmed matches only" },
  { label: "Won / drawn / lost", description: "Verified outcomes, never self-reported" },
  { label: "Goals", description: "For, against and difference" },
  { label: "Points", description: "Calculated by the server from results" },
] as const;

export default function RankingsPage() {
  return (
    <>
      <section className="border-b border-white/10">
        <div className="container py-12 sm:py-16">
          <PageHeader
            eyebrow="Records"
            title="Rankings"
            description="A competitive record built only from verified results. No manual points, no hidden adjustments and no table until there are real matches to rank."
            breadcrumbs={[{ label: "Home", href: "/" }, { label: "Rankings" }]}
          />
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="container py-10 sm:py-14">
          <EmptyState
            size="lg"
            icon={BarChart3}
            eyebrow="No ranking table yet"
            title="Rankings begin with the first verified result"
            description="No completed matches have been recorded, so there is no ranking table to show. When a season is under way, this page will rank players from confirmed results stored by the platform."
            action={
              <Link href="/tournaments" className={buttonStyles({ size: "sm" })}>
                Browse tournaments
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            }
            secondaryAction={
              <Link
                href="/hall-of-fame"
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                Hall of Fame
              </Link>
            }
          />
        </div>
      </section>

      <section>
        <div className="container grid gap-6 py-10 sm:py-14 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-electric-400/20 bg-electric-500/10 text-electric-300">
                  <ShieldCheck aria-hidden="true" className="h-5 w-5" />
                </span>
                <CardTitle>How ranking points work</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-grey-400">
              <p>
                Only confirmed results count. A score submitted by a participant is reviewed against
                the result process before it affects a table.
              </p>
              <p>
                The exact points formula, season scope and tie-break order will be published before
                the first ranking table appears. GCC will not invent a formula after a season
                starts.
              </p>
              <p>
                Corrections are recorded as a new state with an audit entry, so a ranking change can
                always be explained.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-gold-400/25 bg-gold-400/10 text-gold-300">
                  <TrendingUp aria-hidden="true" className="h-5 w-5" />
                </span>
                <CardTitle>What the table will show</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5">
                {columns.map((column) => (
                  <div key={column.label} className="flex items-start justify-between gap-4">
                    <dt className="text-sm font-medium text-grey-200">{column.label}</dt>
                    <dd className="text-right text-xs leading-5 text-grey-500">
                      {column.description}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-grey-500">
                <ListChecks aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />A player
                appears only after a verified match, not because an account exists.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
