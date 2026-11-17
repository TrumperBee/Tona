"use client";

// GCC - confirmed draw graphic: four pots of nine.
import {
  GraphicAvatar,
  GraphicFrame,
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
        description="Four pots of nine. Every registered player appears in exactly one pot."
      />

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-5">
        {data.pots.map((pot) => (
          <section
            key={pot.pot}
            className="border-white/12 flex min-h-0 flex-col rounded-2xl border bg-navy-900/70 p-5"
          >
            <div className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-3">
              <h3 className="font-display text-[27px] font-semibold uppercase tracking-display text-white">
                Pot {pot.pot}
              </h3>
              <span className="text-[14px] font-semibold uppercase tracking-[0.14em] text-gold-300">
                {pot.players.length} {pot.players.length === 1 ? "player" : "players"}
              </span>
            </div>
            <ul className="mt-2 flex min-h-0 flex-1 flex-col justify-around">
              {pot.players.map((player) => (
                <li key={player.uid} className="flex items-center gap-3">
                  <GraphicAvatar
                    name={player.gamerTag}
                    src={player.avatarUrl}
                    size={34}
                    ring="border-white/15"
                  />
                  <GraphicTag
                    tag={player.gamerTag}
                    className="min-w-0 text-[19px] font-semibold text-grey-100"
                  />
                </li>
              ))}
              {pot.players.length === 0 ? (
                <li className="text-[16px] text-grey-500">No player in this pot.</li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>
    </GraphicFrame>
  );
}
