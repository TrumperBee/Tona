// GCC - public knockout bracket tab.
//
// Server component. Every card is a published tie; nothing is generated in the
// browser. The champion banner appears only when the final has a recorded
// winner and the competition is complete.
import { ShieldCheck, Swords, Trophy } from "lucide-react";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/data-display";
import type {
  PublicKnockout,
  PublicKnockoutRound,
  PublicKnockoutTie,
} from "@/lib/data/public-knockout";
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

const STATUS_LABELS: Record<PublicKnockoutTie["status"], string> = {
  pending: "Pending",
  in_progress: "In progress",
  needs_decider: "Needs decider",
  completed: "Completed",
};

function statusTone(status: PublicKnockoutTie["status"]) {
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

function TieCard({ tie }: { readonly tie: PublicKnockoutTie }) {
  const higherWon = tie.winnerUid !== null && tie.winnerUid === tie.higherSeedUid;
  const lowerWon = tie.winnerUid !== null && tie.winnerUid === tie.lowerSeedUid;
  const needsDecider = tie.status === "needs_decider";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
            Tie {tie.bracketSlot}
          </span>
          {tie.group ? <Badge tone="neutral">Play-off {tie.group}</Badge> : null}
        </div>
        <Badge tone={statusTone(tie.status)}>{STATUS_LABELS[tie.status]}</Badge>
      </CardHeader>
      <CardContent className="space-y-2 p-3.5">
        <div className="space-y-1.5">
          <div
            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${
              higherWon ? "bg-success/[0.08]" : "bg-white/[0.02]"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-5 shrink-0 text-right text-[10px] font-semibold tabular-nums text-grey-500">
                {tie.higherSeedPosition}
              </span>
              <span className="truncate text-sm font-medium text-grey-100">
                {tie.higherSeedTag}
              </span>
            </span>
            <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-white">
              {tie.aggregate.higherGoals}
            </span>
          </div>
          <div
            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${
              lowerWon ? "bg-success/[0.08]" : "bg-white/[0.02]"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-5 shrink-0 text-right text-[10px] font-semibold tabular-nums text-grey-500">
                {tie.lowerSeedPosition}
              </span>
              <span className="truncate text-sm font-medium text-grey-100">{tie.lowerSeedTag}</span>
            </span>
            <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-white">
              {tie.aggregate.lowerGoals}
            </span>
          </div>
        </div>

        {tie.matches.length > 0 ? (
          <ul className="space-y-1 border-t border-white/10 pt-2 text-[11px] leading-5 text-grey-500">
            {tie.matches.map((match) => (
              <li key={match.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  Leg {match.leg}: {match.homeTag} vs {match.awayTag}
                </span>
                <span className="shrink-0 font-medium tabular-nums text-grey-300">
                  {match.status === "completed" && match.homeGoals !== null
                    ? `${match.homeGoals}–${match.awayGoals}`
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {tie.decidedBy ? (
          <p className="border-t border-white/10 pt-2 text-[11px] text-grey-400">
            {DECIDED_BY_LABELS[tie.decidedBy] ?? tie.decidedBy}
            {tie.penalties ? ` · penalties ${tie.penalties.higher}–${tie.penalties.lower}` : ""}
            {tie.deciderNote ? ` · ${tie.deciderNote}` : ""}
          </p>
        ) : null}

        {needsDecider ? (
          <p className="rounded-md border border-warning/25 bg-warning/[0.06] px-2 py-1.5 text-[11px] text-warning-soft">
            Level after {tie.legsPlayed} {tie.legsPlayed === 1 ? "leg" : "legs"}. The organiser
            records the winner by extra time or penalties.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RoundColumn({ round }: { readonly round: PublicKnockoutRound }) {
  return (
    <div className="w-[17.5rem] shrink-0 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold uppercase tracking-display text-white">
          {round.label}
        </h3>
        <span className="text-[10px] uppercase tracking-eyebrow text-grey-500">
          {round.ties.length} {round.ties.length === 1 ? "tie" : "ties"}
        </span>
      </div>
      <div className="space-y-3">
        {round.ties.map((tie) => (
          <TieCard key={tie.tieId} tie={tie} />
        ))}
      </div>
    </div>
  );
}

export interface PublicKnockoutPanelProps {
  readonly knockout: PublicKnockout;
}

export function PublicKnockoutPanel({ knockout }: PublicKnockoutPanelProps) {
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
                <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-grey-500">
                  Bracket
                </p>
                <p className="mt-1 text-sm font-medium text-grey-200">
                  {knockout.rounds.length} round{knockout.rounds.length === 1 ? "" : "s"} published
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
              Positions 1–8 went straight to the Round of 16. Positions 9–16 and 17–24 meet in the
              play-offs, and every tie is decided on aggregate over its published legs. There is no
              away-goals rule; a level tie is settled by extra time or penalties.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-grey-500">
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
                  <p className="mt-1 text-[10px] uppercase tracking-eyebrow text-grey-500">
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

        {knockout.rounds.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="Bracket not published"
            description="The organiser draws each round from the recorded league table. Published ties appear here with their real seeds and results."
          />
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
              {knockout.rounds.map((round) => (
                <RoundColumn key={round.round} round={round} />
              ))}
            </div>
          </div>
        )}

        {!knockout.leagueClosed ? (
          <p className="rounded-lg border border-white/10 bg-navy-950/50 p-3.5 text-xs leading-5 text-grey-400">
            The league phase is not closed yet, so no bracket has been drawn. League results remain
            the only source of qualification.
          </p>
        ) : null}
      </div>
    </section>
  );
}
