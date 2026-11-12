// GCC - public league results.
//
// Read-only. Only completed matches appear, grouped by matchday with the newest
// matchday first, and every row links to its shareable public match page. No
// sample score is ever rendered for an unplayed fixture.
import { Swords, Trophy } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import type { PublicFixtureRow } from "@/lib/data/public-fixtures";

export interface PublicResultsPanelProps {
  readonly matches: readonly PublicFixtureRow[];
  readonly tournamentSlug: string;
}

export function PublicResultsPanel({ matches, tournamentSlug }: PublicResultsPanelProps) {
  const completed = matches.filter(
    (match) => match.status === "completed" && match.homeGoals !== null && match.awayGoals !== null,
  );
  const matchdays = [...new Set(completed.map((match) => match.matchday))].sort((a, b) => b - a);

  return (
    <section className="border-b border-white/10">
      <div className="container py-10">
        <div className="mb-4 flex items-center gap-2">
          <Trophy aria-hidden="true" className="h-4 w-4 text-gold-300" />
          <h2 className="font-display text-xl font-semibold uppercase tracking-display text-white">
            League results
          </h2>
        </div>

        {completed.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="No results yet"
            description="Scores appear here after the tournament owner records a real result. Nothing is filled in ahead of time."
          />
        ) : (
          <div className="space-y-8">
            {matchdays.map((day) => {
              const rows = completed
                .filter((match) => match.matchday === day)
                .sort((a, b) => (a.id < b.id ? 1 : -1));

              return (
                <section key={day}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-eyebrow text-grey-300">
                      Matchday {day}
                    </h3>
                    <span className="text-[11px] text-grey-500">
                      {rows.length} result{rows.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="grid gap-2 md:grid-cols-2">
                    {rows.map((row) => (
                      <li key={row.id}>
                        <Link
                          href={`/tournaments/${tournamentSlug}/matches/${row.id}`}
                          className="flex items-center gap-2 rounded-lg border border-white/10 bg-navy-950/50 p-3 transition-colors hover:border-electric-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-grey-100">
                            {row.homeTag}
                          </span>
                          <span className="shrink-0 rounded bg-white/[0.06] px-2 py-0.5 font-display text-sm font-semibold tabular-nums text-white">
                            {row.homeGoals}–{row.awayGoals}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-grey-100">
                            {row.awayTag}
                          </span>
                          <Badge tone="success">FT</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
