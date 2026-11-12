"use client";

// GCC - tournament workspace tab navigation.
//
// Available tabs are links; locked tabs carry the exact condition that unlocks
// them, rendered as a compact notice list under the bar so nothing pretends to
// be usable before its stage. Icons come from the shared navigation model so
// server and client chrome never drift apart.
import { Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { organiserTournamentWorkspace } from "@/lib/config/navigation";
import { cn } from "@/lib/utils/cn";

export interface WorkspaceTabState {
  readonly segment: string;
  readonly available: boolean;
  readonly notice: string | null;
}

export interface WorkspaceTabsProps {
  readonly tournamentId: string;
  readonly tabs: readonly WorkspaceTabState[];
}

export function WorkspaceTabs({ tournamentId, tabs }: WorkspaceTabsProps) {
  const pathname = usePathname() ?? "";
  const locked = tabs.filter((tab) => !tab.available && tab.notice);
  const items = organiserTournamentWorkspace;

  return (
    <div className="space-y-3">
      <nav aria-label="Tournament tools" className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const item = items.find((entry) => entry.segment === tab.segment);
          const href = `/organiser/tournaments/${tournamentId}${tab.segment ? `/${tab.segment}` : ""}`;
          const active =
            pathname === href || (tab.segment !== "" && pathname.startsWith(`${href}/`));
          const Icon = item?.icon;

          const pill = cn(
            "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
            active
              ? "border-electric-400/60 bg-electric-500/15 text-electric-200"
              : tab.available
                ? "border-white/15 bg-navy-900/60 text-grey-200 hover:border-electric-400/40 hover:text-white"
                : "cursor-not-allowed border-white/10 bg-navy-900/30 text-grey-500",
          );

          const content = (
            <>
              {Icon ? <Icon aria-hidden="true" className="h-3.5 w-3.5" /> : null}
              {item?.label ?? tab.segment}
              {!tab.available ? <Lock aria-hidden="true" className="h-3 w-3 opacity-70" /> : null}
            </>
          );

          return tab.available ? (
            <Link
              key={tab.segment}
              href={href}
              aria-current={active ? "page" : undefined}
              className={pill}
            >
              {content}
            </Link>
          ) : (
            <span
              key={tab.segment}
              aria-disabled="true"
              title={tab.notice ?? undefined}
              className={pill}
            >
              {content}
            </span>
          );
        })}
      </nav>

      {locked.length > 0 ? (
        <ul className="grid gap-1 rounded-lg border border-white/10 bg-navy-900/40 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {locked.map((tab) => {
            const item = items.find((entry) => entry.segment === tab.segment);

            return (
              <li key={tab.segment} className="flex items-baseline gap-1.5 text-[11px] leading-4">
                <Lock aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-grey-600" />
                <span>
                  <span className="font-semibold text-grey-400">{item?.label ?? tab.segment}</span>
                  <span className="text-grey-400"> — {tab.notice}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
