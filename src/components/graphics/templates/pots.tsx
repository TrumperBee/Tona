"use client";

// GCC - confirmed draw graphic: four pots of nine.
import {
  GraphicAvatar,
  GraphicChip,
  GraphicFrame,
  GraphicPanel,
  GraphicSectionTitle,
  GraphicTag,
} from "@/components/graphics/graphic-primitives";
import type { GraphicBranding, GraphicSizeId, PotsGraphicData } from "@/lib/graphics/types";

export function PotsTemplate({
  branding,
  size,
  data,
}: {
  readonly branding: GraphicBranding;
  readonly size: GraphicSizeId;
  readonly data: PotsGraphicData;
}) {
  return (
    <GraphicFrame branding={branding} size={size}>
      <GraphicSectionTitle
        eyebrow="Confirmed draw"
        title="The Draw"
        description="Four pots. Every registered player appears in exactly one pot."
        meta={<GraphicChip tone="gold">{data.pots.length} pots</GraphicChip>}
      />

      <GraphicPanel padded={false} className="min-h-0 flex-1">
        <div className="grid h-full grid-cols-2 gap-4 p-4">
          {data.pots.map((pot) => (
            <section
              key={pot.pot}
              className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-navy-950/50"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold-400/30 bg-gold-400/[0.1] font-display text-[20px] font-semibold text-gold-300">
                    {pot.pot}
                  </span>
                  <h3 className="font-display text-[24px] font-semibold uppercase tracking-display text-white">
                    Pot {pot.pot}
                  </h3>
                </div>
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-grey-500">
                  {pot.players.length} {pot.players.length === 1 ? "player" : "players"}
                </span>
              </div>
              <ol className="flex min-h-0 flex-1 flex-col justify-evenly gap-1 px-5 py-3">
                {pot.players.map((player, index) => (
                  <li key={player.uid} className="flex min-h-0 items-center gap-3">
                    <span className="w-5 shrink-0 text-right text-[12px] font-semibold tabular-nums text-grey-600">
                      {index + 1}
                    </span>
                    <GraphicAvatar
                      name={player.gamerTag}
                      src={player.avatarUrl}
                      size={30}
                      ring="border-white/15"
                    />
                    <GraphicTag
                      tag={player.gamerTag}
                      className="text-[17px] font-semibold text-grey-100"
                    />
                  </li>
                ))}
                {pot.players.length === 0 ? (
                  <li className="text-[16px] text-grey-500">No player in this pot.</li>
                ) : null}
              </ol>
            </section>
          ))}
        </div>
      </GraphicPanel>
    </GraphicFrame>
  );
}
