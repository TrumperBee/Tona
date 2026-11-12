"use client";

// GCC - public fixtures panel.
//
// Read-only. Every row is a real published match: no scores are shown until a
// result exists, and the "My matches" tab appears only when the signed-in
// viewer has a fixture in this competition.
import { CalendarDays, Swords } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Tabs } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils/dates";
import type { PublicFixtureRow, PublicMatchdayWindow } from "@/lib/data/public-fixtures";

export interface PublicFixturesPanelProps {
  readonly matches: readonly PublicFixtureRow[];
  readonly matchdays: readonly PublicMatchdayWindow[];
  readonly viewerUid: string | null;
  readonly timezone: string;
}

function opponentName(row: PublicFixtureRow, viewerUid: string | null): string {
  if (viewerUid === null) {
    return "";
  }

  return row.homeUid === viewerUid ? row.awayTag : row.homeTag;
}

function scoreLabel(row: PublicFixtureRow): string {
  return row.status === "completed" && row.homeGoals !== null && row.awayGoals !== null
    ? `${row.homeGoals}–${row.awayGoals}`
    : "vs";
}

function FixtureCard({
  row,
  viewerUid,
  timezone,
}: {
  readonly row: PublicFixtureRow;
  readonly viewerUid: string | null;
  readonly timezone: string;
}) {
  const viewerHome = viewerUid !== null && row.homeUid === viewerUid;
  const viewerAway = viewerUid !== null && row.awayUid === viewerUid;
  const mine = viewerHome || viewerAway;

  return (
    <li
      className={`rounded-lg border p-3 ${
        mine ? "border-electric-400/40 bg-electric-500/[0.06]" : "border-white/10 bg-navy-950/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-grey-100">{row.homeTag}</p>
        <span className="shrink-0 rounded bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-grey-200">
          {scoreLabel(row)}
        </span>
        <p className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-grey-100">
          {row.awayTag}
        </p>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-grey-500">
        <span className="flex items-center gap-1.5">
          <CalendarDays aria-hidden="true" className="h-3 w-3" />
          {row.scheduledAt
            ? formatDate(row.scheduledAt, { timeZone: timezone })
            : "Date to be confirmed"}
        </span>
        <span className="flex items-center gap-1.5">
          {mine ? <Badge tone="info">{viewerHome ? "Home" : "Away"}</Badge> : null}
          {row.status === "completed" ? (
            <Badge tone="success">Completed</Badge>
          ) : (
            <Badge tone="neutral">Scheduled</Badge>
          )}
        </span>
      </div>
    </li>
  );
}

export function PublicFixturesPanel({
  matches,
  matchdays,
  viewerUid,
  timezone,
}: PublicFixturesPanelProps) {
  const [selected, setSelected] = useState("1");
  const hasMine =
    viewerUid !== null &&
    matches.some((match) => match.homeUid === viewerUid || match.awayUid === viewerUid);
  const windowByNumber = new Map(matchdays.map((window) => [window.number, window]));

  const items = Array.from({ length: 8 }, (_, index) => {
    const day = index + 1;
    const window = windowByNumber.get(day);
    const dayMatches = matches.filter((match) => match.matchday === day);

    return {
      id: String(day),
      label: `MD ${day}`,
      content: (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-grey-400">
            <span className="font-semibold uppercase tracking-eyebrow text-grey-300">
              Matchday {day}
            </span>
            {window ? (
              <span>
                {formatDate(window.startsOn, { timeZone: timezone })} –{" "}
                {formatDate(window.endsOn, { timeZone: timezone })}
              </span>
            ) : null}
            <span>{dayMatches.length} matches</span>
          </div>
          {dayMatches.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-grey-400">
              No fixtures are listed for this matchday.
            </p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {dayMatches.map((match) => (
                <FixtureCard key={match.id} row={match} viewerUid={viewerUid} timezone={timezone} />
              ))}
            </ul>
          )}
        </div>
      ),
    };
  });

  if (hasMine && viewerUid !== null) {
    const mine = matches
      .filter((match) => match.homeUid === viewerUid || match.awayUid === viewerUid)
      .sort((a, b) => a.matchday - b.matchday);

    items.push({
      id: "mine",
      label: "My matches",
      content: (
        <div className="space-y-4">
          <p className="text-xs text-grey-400">
            Your eight league-phase matches, in matchday order. Opponents are shown from the
            published schedule.
          </p>
          <ul className="grid gap-2 md:grid-cols-2">
            {mine.map((match) => (
              <FixtureCard key={match.id} row={match} viewerUid={viewerUid} timezone={timezone} />
            ))}
          </ul>
          {mine.length > 0 ? (
            <p className="text-[11px] text-grey-500">
              Next opponent: {opponentName(mine[0] as PublicFixtureRow, viewerUid)} on matchday{" "}
              {(mine[0] as PublicFixtureRow).matchday}.
            </p>
          ) : null}
        </div>
      ),
    });
  }

  // Keep the initial matchday valid when the panel is re-rendered for a viewer
  // without the "My matches" tab; matchdays 1-8 always exist in `items`.
  return (
    <section className="border-b border-white/10">
      <div className="container py-10">
        <div className="mb-4 flex items-center gap-2">
          <Swords aria-hidden="true" className="h-4 w-4 text-electric-300" />
          <h2 className="font-display text-xl font-semibold uppercase tracking-display text-white">
            League phase fixtures
          </h2>
        </div>
        {matches.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="No fixtures"
            description="The organiser has not published a schedule for this competition yet."
          />
        ) : (
          <Tabs
            ariaLabel="Fixture matchdays"
            value={selected}
            onValueChange={setSelected}
            items={items}
            listClassName="container"
            panelClassName="pt-4"
          />
        )}
      </div>
    </section>
  );
}
