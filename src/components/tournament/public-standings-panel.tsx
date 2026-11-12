// GCC - public league table tab.
//
// Read-only projection of the server-written standings. The panel is rendered
// on the server and the page carries a 30-second revalidation window, so a
// spectator sees a recent table without any client-side computation.
import { ListOrdered } from "lucide-react";

import { StandingsTable, type StandingsTableRow } from "@/components/tournament/standings-table";
import { EmptyState } from "@/components/ui/data-display";
import { TIEBREAKER_PROFILE_LABELS } from "@/lib/engine/standings/types";
import type { TiebreakerProfile } from "@/lib/engine/standings/types";

export interface PublicStandingsPanelProps {
  readonly rows: readonly StandingsTableRow[];
  readonly profile: TiebreakerProfile;
  readonly provisional: boolean;
  readonly updatedAt: string | null;
}

export function PublicStandingsPanel({
  rows,
  profile,
  provisional,
  updatedAt,
}: PublicStandingsPanelProps) {
  return (
    <section className="border-b border-white/10">
      <div className="container py-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListOrdered aria-hidden="true" className="h-4 w-4 text-electric-300" />
            <h2 className="font-display text-xl font-semibold uppercase tracking-display text-white">
              League table
            </h2>
          </div>
          <p className="text-[11px] uppercase tracking-eyebrow text-grey-500">
            Tie-break: {TIEBREAKER_PROFILE_LABELS[profile]}
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={ListOrdered}
            title="No table yet"
            description="The table appears after fixtures are published. It is built only from recorded results, never from sample scores."
          />
        ) : (
          <StandingsTable
            rows={rows}
            profile={profile}
            provisional={provisional}
            updatedAt={updatedAt}
          />
        )}
      </div>
    </section>
  );
}
