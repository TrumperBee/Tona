"use client";

// GCC - full 23-tie knockout bracket graphic.
import {
  GraphicAvatar,
  GraphicFrame,
  GraphicChip,
  GraphicSectionTitle,
  GraphicTag,
  GraphicTrophy,
} from "@/components/graphics/graphic-primitives";
import type {
  GraphicBranding,
  GraphicSizeId,
  KnockoutGraphicData,
  KnockoutGraphicSlot,
} from "@/lib/graphics/types";
import { cn } from "@/lib/utils/cn";

function slotLabel(slot: KnockoutGraphicSlot): string {
  return slot.uid ? (slot.gamerTag ?? "Player") : slot.source;
}

function SlotLine({
  slot,
  goals,
  played,
  won,
}: {
  readonly slot: KnockoutGraphicSlot;
  readonly goals: number;
  readonly played: number;
  readonly won: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded px-1 py-[3px]",
        won ? "bg-success/[0.14]" : "bg-white/[0.02]",
      )}
    >
      <span className="w-[13px] shrink-0 text-right text-[10px] font-semibold tabular-nums text-grey-500">
        {slot.position ?? "–"}
      </span>
      {slot.uid ? (
        <GraphicAvatar
          name={slot.gamerTag ?? "Player"}
          src={slot.avatarUrl}
          size={20}
          ring="border-white/15"
        />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full border border-dashed border-white/15" />
      )}
      <GraphicTag
        tag={slotLabel(slot)}
        className={cn(
          "min-w-0 flex-1 text-[12px]",
          slot.uid
            ? won
              ? "font-semibold text-white"
              : "font-medium text-grey-100"
            : "italic text-grey-500",
        )}
      />
      <span className="w-[20px] shrink-0 text-right font-display text-[13px] font-semibold tabular-nums text-white">
        {played > 0 ? goals : "–"}
      </span>
    </div>
  );
}

export function KnockoutTemplate({
  branding,
  size,
  data,
}: {
  readonly branding: GraphicBranding;
  readonly size: GraphicSizeId;
  readonly data: KnockoutGraphicData;
}) {
  const tieCount = data.rounds.reduce((total, round) => total + round.ties.length, 0);

  return (
    <GraphicFrame branding={branding} size={size}>
      <GraphicSectionTitle
        eyebrow="Knockout stage"
        title="The bracket"
        description={`${tieCount} ties · ${data.legs === 1 ? "single match" : "two-legged ties"}`}
      />

      {data.champion ? (
        <div className="mb-4 flex items-center gap-4 rounded-xl border border-gold-400/40 bg-gold-400/[0.08] px-4 py-3">
          <GraphicTrophy size={46} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-gold-300">
              Champion
            </p>
            <GraphicTag
              tag={data.champion.gamerTag}
              className="text-[22px] font-semibold text-white"
            />
          </div>
          <GraphicChip tone="gold">Final winner</GraphicChip>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-5 gap-2">
        {data.rounds.map((round) => (
          <section key={round.round} className="flex min-h-0 flex-col">
            <h3 className="mb-2 truncate text-center text-[11px] font-semibold uppercase tracking-[0.13em] text-electric-300">
              {round.label}
            </h3>
            <div className="flex min-h-0 flex-1 flex-col justify-around gap-1.5">
              {round.ties.map((tie) => {
                const higherWon = tie.winnerUid !== null && tie.winnerUid === tie.higher.uid;
                const lowerWon = tie.winnerUid !== null && tie.winnerUid === tie.lower.uid;

                return (
                  <div
                    key={tie.tieId}
                    className="border-white/12 rounded-lg border bg-navy-900/80 p-1"
                  >
                    <SlotLine
                      slot={tie.higher}
                      goals={tie.higherGoals}
                      played={tie.legsPlayed}
                      won={higherWon}
                    />
                    <SlotLine
                      slot={tie.lower}
                      goals={tie.lowerGoals}
                      played={tie.legsPlayed}
                      won={lowerWon}
                    />
                    {tie.penalties ? (
                      <p className="px-1 pt-0.5 text-right text-[9px] font-semibold uppercase tracking-[0.1em] text-gold-300">
                        Pens {tie.penalties.higher}–{tie.penalties.lower}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </GraphicFrame>
  );
}
