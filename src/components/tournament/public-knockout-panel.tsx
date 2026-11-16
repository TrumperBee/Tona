"use client";

// GCC - public knockout bracket tab.
//
// Client component so the bracket can switch between its visual tree and a
// grouped list, scroll to a round and open a tie sheet. Every value comes from
// the stored bracket documents: no placeholder is invented, and an empty
// knockout shows an honest "not generated yet" state instead of sample ties.
import { ShieldCheck, Swords, Trophy } from "lucide-react";
import { useState } from "react";

import {
  KnockoutBracket,
  toBracketRounds,
  type BracketTieView,
} from "@/components/tournament/knockout-bracket";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/data-display";
import { KNOCKOUT_ROUND_LABELS, KNOCKOUT_ROUNDS, type KnockoutRound } from "@/lib/engine/knockout";
import type { PublicKnockout, PublicKnockoutTie } from "@/lib/data/public-knockout";
import type { StandingBand } from "@/lib/engine/standings/types";

const BAND_LABELS: Record<StandingBand, string> = {
  direct: "Direct to Round of 16",
  playoff_seeded: "Play-off · seeded",
  playoff_unseeded: "Play-off · unseeded",
  eliminated: "Eliminated",
};

const BAND_RANGES: Record<StandingBand, string> = {
  direct: "1–8",
  playoff_seeded: "9–16",
  playoff_unseeded: "17–24",
  eliminated: "25–36",
};

const DECIDED_BY_LABELS: Record<string, string> = {
  aggregate: "Aggregate",
  extra_time: "Extra time",
  penalties: "Penalties",
};

const STATUS_LABELS: Record<BracketTieView["status"], string> = {
  pending: "Pending",
  in_progress: "In progress",
  needs_decider: "Needs decider",
  completed: "Completed",
};

function statusTone(status: BracketTieView["status"]) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "needs_decider":
      return "warning" as const;
    case "in_progress":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

function toBracketTie(tie: PublicKnockoutTie): BracketTieView {
  return {
    tieId: tie.tieId,
    round: tie.round,
    roundLabel: KNOCKOUT_ROUND_LABELS[tie.round],
    bracketSlot: tie.bracketSlot,
    legs: tie.legs,
    group: tie.group,
    higher: tie.higher,
    lower: tie.lower,
    status: tie.status,
    aggregate: tie.aggregate,
    legsPlayed: tie.legsPlayed,
    winnerUid: tie.winnerUid,
    winnerTag: tie.winnerUid === tie.higher.uid ? tie.higher.gamerTag : tie.lower.gamerTag,
    decidedBy: tie.decidedBy,
    deciderNote: tie.deciderNote,
    penalties: tie.penalties,
    matches: tie.matches.map((match) => ({
      id: match.id,
      leg: match.leg,
      homeTag: match.homeTag,
      awayTag: match.awayTag,
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
      status: match.status,
    })),
    complete: tie.complete,
  };
}

function TieSheet({
  tie,
  open,
  onOpenChange,
}: {
  readonly tie: BracketTieView | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  if (!tie) {
    return null;
  }

  const waiting = !tie.higher.uid || !tie.lower.uid;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${tie.group ? `Play-off ${tie.group}` : tie.roundLabel} · tie ${tie.bracketSlot}`}
      description={`${tie.higher.uid ? (tie.higher.gamerTag ?? "Player") : tie.higher.source} vs ${
        tie.lower.uid ? (tie.lower.gamerTag ?? "Player") : tie.lower.source
      }`}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(tie.status)}>{STATUS_LABELS[tie.status]}</Badge>
          <Badge tone="neutral">{tie.legs === 1 ? "Single match" : `${tie.legs} legs`}</Badge>
          {tie.complete ? <Badge tone="success">{tie.winnerTag} advances</Badge> : null}
        </div>

        <div className="space-y-2 rounded-lg border border-white/10 bg-navy-950/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm text-grey-100">
              {tie.higher.uid ? tie.higher.gamerTag : tie.higher.source}
            </span>
            <span className="font-display text-lg font-semibold tabular-nums text-white">
              {tie.legsPlayed > 0 ? tie.aggregate.higherGoals : "–"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm text-grey-100">
              {tie.lower.uid ? tie.lower.gamerTag : tie.lower.source}
            </span>
            <span className="font-display text-lg font-semibold tabular-nums text-white">
              {tie.legsPlayed > 0 ? tie.aggregate.lowerGoals : "–"}
            </span>
          </div>
          <p className="text-xs text-grey-500">
            {tie.legsPlayed > 0
              ? `Aggregate after ${tie.legsPlayed} ${tie.legsPlayed === 1 ? "leg" : "legs"}`
              : "No leg has been played yet."}
          </p>
        </div>

        {waiting ? (
          <p className="rounded-lg border border-white/10 bg-navy-950/40 p-3 text-xs leading-5 text-grey-400">
            Waiting for {!tie.higher.uid ? tie.higher.source : tie.lower.source}. This tie is
            created automatically when the feeding tie is decided.
          </p>
        ) : null}

        {tie.matches.length > 0 ? (
          <ul className="space-y-2">
            {tie.matches.map((match) => (
              <li
                key={match.id}
                className="rounded-lg border border-white/10 bg-navy-950/40 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                    Leg {match.leg} of {tie.legs}
                  </span>
                  <Badge tone={match.status === "completed" ? "success" : "neutral"}>
                    {match.status === "completed" ? "Result" : "Due"}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-grey-100">{match.homeTag}</span>
                  <span className="font-display text-base font-semibold tabular-nums text-white">
                    {match.status === "completed" && match.homeGoals !== null
                      ? `${match.homeGoals}–${match.awayGoals}`
                      : "–"}
                  </span>
                </div>
                <p className="mt-1 truncate text-right text-xs text-grey-500">{match.awayTag}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {tie.decidedBy ? (
          <p className="rounded-lg border border-white/10 bg-navy-950/40 p-3 text-xs leading-5 text-grey-400">
            Decided by {DECIDED_BY_LABELS[tie.decidedBy] ?? tie.decidedBy}
            {tie.penalties ? ` · shoot-out ${tie.penalties.higher}–${tie.penalties.lower}` : ""}
            {tie.deciderNote ? ` · ${tie.deciderNote}` : ""}
          </p>
        ) : null}

        {tie.status === "needs_decider" ? (
          <p className="rounded-lg border border-warning/25 bg-warning/[0.06] p-3 text-xs leading-5 text-warning-soft">
            Level after {tie.legsPlayed} {tie.legsPlayed === 1 ? "leg" : "legs"}. The organiser
            records the winner by extra time or penalties. There is no away-goals rule.
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}

export interface PublicKnockoutPanelProps {
  readonly knockout: PublicKnockout;
}

export function PublicKnockoutPanel({ knockout }: PublicKnockoutPanelProps) {
  const [selected, setSelected] = useState<BracketTieView | null>(null);
  const ties = knockout.ties.map(toBracketTie);
  const rounds = toBracketRounds(ties, KNOCKOUT_ROUNDS as readonly KnockoutRound[]);
  const qualification = (["direct", "playoff_seeded", "playoff_unseeded", "eliminated"] as const)
    .map((band) => ({
      band,
      players: knockout.qualifiers.filter((row) => row.band === band),
    }))
    .filter((entry) => entry.players.length > 0);

  return (
    <section className="border-b border-white/10">
      <div className="container space-y-8 py-10">
        {knockout.champion ? (
          <Card variant="gold" className="overflow-hidden">
            <CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:text-left">
              <Avatar
                name={knockout.champion.gamerTag}
                src={knockout.champion.avatarUrl}
                size="lg"
              />
              <div className="flex-1">
                <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-eyebrow text-gold-300 sm:justify-start">
                  <Trophy aria-hidden="true" className="h-4 w-4" />
                  {knockout.completed ? "Champion" : "Final winner"}
                </p>
                <p className="mt-1 font-display text-3xl font-semibold text-white">
                  {knockout.champion.gamerTag}
                </p>
                {knockout.runnerUp ? (
                  <p className="mt-1 text-sm text-grey-400">
                    Runner-up: <span className="text-grey-200">{knockout.runnerUp.gamerTag}</span>
                  </p>
                ) : null}
              </div>
              <div className="rounded-lg border border-white/15 bg-navy-950/40 px-4 py-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
                  Bracket
                </p>
                <p className="mt-1 text-sm font-medium text-grey-200">
                  {knockout.ties.length} ties · {knockout.legs === 1 ? "single match" : "two legs"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Swords aria-hidden="true" className="h-4 w-4 text-electric-300" />
              <h2 className="font-display text-xl font-semibold uppercase tracking-display text-white">
                Knockout bracket
              </h2>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-grey-400">
              Positions 1–8 went straight to the Round of 16. Positions 9–16 and 17–24 met in the
              play-offs. Every tie is decided on aggregate over its legs; there is no away-goals
              rule and a level tie is settled by extra time or penalties.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-grey-500">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
            Written by the server, one recorded result at a time
          </div>
        </div>

        {qualification.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {qualification.map((entry) => (
              <Card key={entry.band}>
                <CardHeader className="p-3.5">
                  <CardTitle className="text-xs tracking-eyebrow text-grey-300">
                    {BAND_LABELS[entry.band]}
                  </CardTitle>
                  <p className="mt-1 text-xs uppercase tracking-eyebrow text-grey-500">
                    Positions {BAND_RANGES[entry.band]}
                  </p>
                </CardHeader>
                <CardContent className="p-3.5">
                  <ul className="space-y-1 text-xs text-grey-300">
                    {entry.players.map((player) => (
                      <li key={player.uid} className="flex items-center gap-2">
                        <span className="w-5 shrink-0 text-right tabular-nums text-grey-500">
                          {player.position}
                        </span>
                        <span className="truncate">{player.gamerTag}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        <KnockoutBracket rounds={rounds} onSelectTie={(tie) => setSelected(tie)} />

        <TieSheet
          tie={selected}
          open={selected !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelected(null);
            }
          }}
        />
      </div>
    </section>
  );
}
