"use client";

// GCC - full knockout bracket graphic.
import {
  GraphicAvatar,
  GraphicChip,
  GraphicFrame,
  GraphicPanel,
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
        "flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1",
        won ? "bg-success/[0.12]" : "bg-white/[0.02]",
      )}
    >
      <span className="w-3 shrink-0 text-right text-[10px] font-semibold tabular-nums text-grey-600">
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
      <span className="w-[18px] shrink-0 text-right font-display text-[13px] font-semibold tabular-nums text-white">
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
        meta={<GraphicChip tone="electric">{data.rounds.length} rounds</GraphicChip>}
      />

      {data.champion ? (
        <GraphicPanel
          tone="gold"
          padded={false}
          className="mb-4 flex shrink-0 items-center gap-4 px-5 py-3"
        >
          <GraphicTrophy size={48} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-300">
              Champion
            </p>
            <GraphicTag
              tag={data.champion.gamerTag}
              className="text-[21px] font-semibold text-white"
            />
          </div>
          <GraphicChip tone="gold">Final winner</GraphicChip>
        </GraphicPanel>
      ) : null}

      <GraphicPanel padded={false} className="min-h-0 flex-1">
        <div className="grid h-full grid-cols-5 gap-3 p-4">
          {data.rounds.map((round, roundIndex) => (
            <section
              key={round.round}
              className={cn(
                "flex min-h-0 flex-col",
                roundIndex > 0 ? "border-l border-white/10 pl-3" : "",
              )}
            >
              <div className="mb-2 flex shrink-0 items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.06] text-[11px] font-semibold text-electric-300">
                  {roundIndex + 1}
                </span>
                <h3 className="truncate text-[12px] font-semibold uppercase tracking-[0.13em] text-electric-300">
                  {round.label}
                </h3>
              </div>
              <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-2">
                {round.ties.map((tie) => {
                  const higherWon = tie.winnerUid !== null && tie.winnerUid === tie.higher.uid;
                  const lowerWon = tie.winnerUid !== null && tie.winnerUid === tie.lower.uid;

                  return (
                    <div
                      key={tie.tieId}
                      className="rounded-xl border border-white/10 bg-navy-950/60 p-1.5"
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
                        <p className="px-1.5 pt-1 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-gold-300">
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
      </GraphicPanel>
    </GraphicFrame>
  );
}
