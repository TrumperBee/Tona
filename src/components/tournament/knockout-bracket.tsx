"use client";

// GCC - shared visual knockout bracket.
//
// One component renders the whole 23-tie tree for both the public page and the
// organiser workspace: fixed-height columns with CSS connector lines, round
// chips that scroll the bracket horizontally (never the page), a list view for
// narrow screens and honest placeholders such as "Winner of P4". Every value is
// a projection of a stored document; nothing is generated in the browser.
import { ArrowUpRight, LayoutGrid, List, Swords } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Badge, Card } from "@/components/ui/card";
import type { KnockoutRound } from "@/lib/engine/knockout";
import { cn } from "@/lib/utils/cn";

export interface BracketSlotView {
  readonly uid: string | null;
  readonly gamerTag: string | null;
  readonly position: number | null;
  readonly source: string;
}

export interface BracketMatchView {
  readonly id: string;
  readonly leg: number;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
  readonly status: "scheduled" | "completed";
}

export interface BracketTieView {
  readonly tieId: string;
  readonly round: KnockoutRound;
  readonly roundLabel: string;
  readonly bracketSlot: number;
  readonly legs: 1 | 2;
  readonly group: string | null;
  readonly higher: BracketSlotView;
  readonly lower: BracketSlotView;
  readonly status: "pending" | "in_progress" | "needs_decider" | "completed";
  readonly aggregate: { readonly higherGoals: number; readonly lowerGoals: number };
  readonly legsPlayed: number;
  readonly winnerUid: string | null;
  readonly winnerTag: string | null;
  readonly decidedBy: "aggregate" | "extra_time" | "penalties" | null;
  readonly deciderNote: string | null;
  readonly penalties: { readonly higher: number; readonly lower: number } | null;
  readonly matches: readonly BracketMatchView[];
  readonly complete: boolean;
}

export interface BracketRoundView {
  readonly round: KnockoutRound;
  readonly label: string;
  readonly ties: readonly BracketTieView[];
}

const CARD_HEIGHT = 92;
const COLUMN_HEIGHT = CARD_HEIGHT * 8 + 8 * 20;

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

function statusLabel(status: BracketTieView["status"]): string {
  switch (status) {
    case "completed":
      return "Decided";
    case "needs_decider":
      return "Needs decider";
    case "in_progress":
      return "In progress";
    default:
      return "Pending";
  }
}

function slotLabel(slot: BracketSlotView): string {
  return slot.uid ? (slot.gamerTag ?? slot.source) : slot.source;
}

function decidedLabel(tie: BracketTieView): string {
  if (tie.decidedBy === "extra_time") {
    return "Extra time";
  }

  if (tie.decidedBy === "penalties") {
    return tie.penalties ? `Penalties ${tie.penalties.higher}–${tie.penalties.lower}` : "Penalties";
  }

  return tie.legsPlayed > 1 ? "Aggregate" : "Match";
}

interface TieCardProps {
  readonly tie: BracketTieView;
  readonly onSelectTie?: (tie: BracketTieView) => void;
}

function SlotRow({
  slot,
  goals,
  played,
  won,
}: {
  readonly slot: BracketSlotView;
  readonly goals: number;
  readonly played: number;
  readonly won: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5",
        won ? "bg-success/[0.10]" : "bg-white/[0.02]",
      )}
    >
      <span className="w-5 shrink-0 text-right text-[11px] font-semibold tabular-nums text-grey-500">
        {slot.position ?? "–"}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          slot.uid
            ? won
              ? "font-semibold text-white"
              : "font-medium text-grey-100"
            : "italic text-grey-500",
        )}
        title={slotLabel(slot)}
      >
        {slotLabel(slot)}
      </span>
      <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-white">
        {played > 0 ? goals : "–"}
      </span>
    </div>
  );
}

function TieCard({ tie, onSelectTie }: TieCardProps) {
  const higherWon = tie.winnerUid !== null && tie.winnerUid === tie.higher.uid;
  const lowerWon = tie.winnerUid !== null && tie.winnerUid === tie.lower.uid;
  const interactive = Boolean(onSelectTie);

  const content = (
    <div
      className={cn(
        "flex h-full w-full flex-col justify-center gap-1.5 rounded-lg border bg-navy-900/80 p-2 transition-colors",
        tie.complete ? "border-white/20" : "border-white/10",
        interactive && "hover:border-electric-400/40",
      )}
      style={{ height: CARD_HEIGHT }}
    >
      <SlotRow
        slot={tie.higher}
        goals={tie.aggregate.higherGoals}
        played={tie.legsPlayed}
        won={higherWon}
      />
      <SlotRow
        slot={tie.lower}
        goals={tie.aggregate.lowerGoals}
        played={tie.legsPlayed}
        won={lowerWon}
      />
    </div>
  );

  if (!onSelectTie) {
    return content;
  }

  return (
    <button
      type="button"
      onClick={() => onSelectTie(tie)}
      className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
    >
      {content}
      <span className="sr-only">, {statusLabel(tie.status)}</span>
    </button>
  );
}

function connectorCells(currentCount: number, nextCount: number) {
  const merging = nextCount * 2 === currentCount;
  const cells = merging ? nextCount : currentCount;

  return Array.from({ length: Math.max(cells, 0) }, (_, index) => ({
    key: index,
    merging,
  }));
}

function ConnectorColumn({
  currentCount,
  nextCount,
}: {
  readonly currentCount: number;
  readonly nextCount: number;
}) {
  const cells = connectorCells(currentCount, nextCount);

  return (
    <div
      aria-hidden="true"
      className="flex w-7 shrink-0 flex-col justify-around"
      style={{ height: COLUMN_HEIGHT }}
    >
      {cells.map((cell) => (
        <div key={cell.key} className="relative flex-1">
          {cell.merging ? (
            <>
              <span className="absolute left-0 top-1/4 h-1/2 w-px bg-white/15" />
              <span className="absolute left-0 top-1/4 h-px w-1/2 bg-white/15" />
              <span className="absolute bottom-1/4 left-0 h-px w-1/2 bg-white/15" />
              <span className="absolute left-1/2 top-1/2 h-px w-1/2 bg-white/15" />
            </>
          ) : (
            <span className="absolute left-0 top-1/2 h-px w-full bg-white/15" />
          )}
        </div>
      ))}
    </div>
  );
}

interface RoundColumnProps {
  readonly round: BracketRoundView;
  readonly onSelectTie?: (tie: BracketTieView) => void;
  readonly register: (round: KnockoutRound, element: HTMLDivElement | null) => void;
}

function RoundColumn({ round, onSelectTie, register }: RoundColumnProps) {
  return (
    <div
      ref={(element) => register(round.round, element)}
      className="flex w-56 shrink-0 snap-start flex-col justify-around"
      style={{ height: COLUMN_HEIGHT }}
    >
      {round.ties.map((tie) => (
        <TieCard key={tie.tieId} tie={tie} onSelectTie={onSelectTie} />
      ))}
    </div>
  );
}

interface TieListRowProps {
  readonly tie: BracketTieView;
  readonly onSelectTie?: (tie: BracketTieView) => void;
}

function TieListRow({ tie, onSelectTie }: TieListRowProps) {
  const winnerTag = tie.winnerTag;
  const waiting = !tie.higher.uid || !tie.lower.uid;

  const body = (
    <div className="flex w-full flex-col gap-2 p-3.5 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-grey-500">
          {tie.group ? `Play-off ${tie.group}` : tie.roundLabel} · tie {tie.bracketSlot}
        </span>
        <div className="flex items-center gap-2">
          {tie.legs > 1 ? <Badge tone="neutral">{tie.legs} legs</Badge> : null}
          <Badge tone={statusTone(tie.status)}>{statusLabel(tie.status)}</Badge>
        </div>
      </div>
      <div className="grid gap-1.5">
        <SlotRow
          slot={tie.higher}
          goals={tie.aggregate.higherGoals}
          played={tie.legsPlayed}
          won={tie.winnerUid !== null && tie.winnerUid === tie.higher.uid}
        />
        <SlotRow
          slot={tie.lower}
          goals={tie.aggregate.lowerGoals}
          played={tie.legsPlayed}
          won={tie.winnerUid !== null && tie.winnerUid === tie.lower.uid}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-grey-500">
        <span>
          {waiting
            ? `Waiting for ${!tie.higher.uid ? tie.higher.source : tie.lower.source}`
            : tie.complete
              ? `${winnerTag ?? "Winner"} advances · ${decidedLabel(tie)}`
              : tie.legsPlayed > 0
                ? `Aggregate ${tie.aggregate.higherGoals}–${tie.aggregate.lowerGoals}`
                : "Not played yet"}
        </span>
        {onSelectTie ? (
          <span className="inline-flex items-center gap-1 font-semibold text-electric-300">
            Open <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
    </div>
  );

  if (!onSelectTie) {
    return <Card>{body}</Card>;
  }

  return (
    <button
      type="button"
      onClick={() => onSelectTie(tie)}
      className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
    >
      <Card className="transition-colors hover:border-electric-400/40">{body}</Card>
    </button>
  );
}

export interface KnockoutBracketProps {
  readonly rounds: readonly BracketRoundView[];
  readonly onSelectTie?: (tie: BracketTieView) => void;
  readonly header?: ReactNode;
  readonly className?: string;
}

export function KnockoutBracket({ rounds, onSelectTie, header, className }: KnockoutBracketProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<Partial<Record<KnockoutRound, HTMLDivElement | null>>>({});
  const [view, setView] = useState<"bracket" | "list">("bracket");
  const [activeRound, setActiveRound] = useState<KnockoutRound | null>(rounds[0]?.round ?? null);

  function register(round: KnockoutRound, element: HTMLDivElement | null): void {
    columnsRef.current[round] = element;
  }

  function scrollToRound(round: KnockoutRound): void {
    setActiveRound(round);
    const scroller = scrollerRef.current;
    const column = columnsRef.current[round];

    if (!scroller || !column) {
      return;
    }

    const delta = column.getBoundingClientRect().left - scroller.getBoundingClientRect().left;

    scroller.scrollTo({ left: scroller.scrollLeft + delta - 8, behavior: "smooth" });
  }

  if (rounds.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-navy-950/40 p-6 text-center">
        <Swords aria-hidden="true" className="mx-auto h-6 w-6 text-grey-500" />
        <p className="mt-2 text-sm font-semibold text-grey-200">No bracket yet</p>
        <p className="mt-1 text-xs leading-5 text-grey-500">
          The organiser generates the knockout stage once every league result is recorded. The
          bracket appears here immediately afterwards.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Knockout rounds"
        >
          {rounds.map((round) => (
            <button
              key={round.round}
              type="button"
              role="tab"
              aria-selected={activeRound === round.round}
              onClick={() => scrollToRound(round.round)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                activeRound === round.round
                  ? "border-electric-400/50 bg-electric-500/[0.12] text-white"
                  : "border-white/10 bg-white/[0.02] text-grey-400 hover:text-grey-200",
              )}
            >
              {round.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-navy-950/60 p-1">
          <button
            type="button"
            aria-pressed={view === "bracket"}
            onClick={() => setView("bracket")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold",
              view === "bracket" ? "bg-white/[0.10] text-white" : "text-grey-400",
            )}
          >
            <LayoutGrid aria-hidden="true" className="h-3.5 w-3.5" />
            Bracket
          </button>
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold",
              view === "list" ? "bg-white/[0.10] text-white" : "text-grey-400",
            )}
          >
            <List aria-hidden="true" className="h-3.5 w-3.5" />
            List
          </button>
        </div>
      </div>

      {header}

      {view === "bracket" ? (
        <div
          ref={scrollerRef}
          role="region"
          aria-label="Knockout bracket, scroll horizontally for later rounds"
          tabIndex={0}
          className="-mx-4 snap-x snap-mandatory overflow-x-auto px-4 pb-3 [scrollbar-width:thin] sm:-mx-6 sm:px-6"
        >
          <div className="flex min-w-max items-stretch">
            {rounds.map((round, index) => (
              <div key={round.round} className="flex items-stretch">
                <RoundColumn round={round} onSelectTie={onSelectTie} register={register} />
                {index < rounds.length - 1 ? (
                  <ConnectorColumn
                    currentCount={round.ties.length}
                    nextCount={rounds[index + 1]?.ties.length ?? 0}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {rounds.map((round) => (
            <section key={round.round} className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-sm font-semibold uppercase tracking-display text-white">
                  {round.label}
                </h3>
                <span className="text-xs uppercase tracking-eyebrow text-grey-500">
                  {round.ties.length} {round.ties.length === 1 ? "tie" : "ties"}
                </span>
              </div>
              <div className="space-y-2">
                {round.ties.map((tie) => (
                  <TieListRow key={tie.tieId} tie={tie} onSelectTie={onSelectTie} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** Groups a flat tie list into the five bracket rounds in order. */
export function toBracketRounds(
  ties: readonly BracketTieView[],
  order: readonly KnockoutRound[],
): BracketRoundView[] {
  return order
    .map((round) => {
      const roundTies = ties
        .filter((tie) => tie.round === round)
        .sort((a, b) => a.bracketSlot - b.bracketSlot);

      return {
        round,
        label: roundTies[0]?.roundLabel ?? round,
        ties: roundTies,
      };
    })
    .filter((round) => round.ties.length > 0);
}
