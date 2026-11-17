"use client";

// GCC - player profile card with verified record, rating and QR link.
import {
  GraphicAvatar,
  GraphicChip,
  GraphicFrame,
  GraphicQr,
  GraphicTag,
} from "@/components/graphics/graphic-primitives";
import { countryFlag, countryName } from "@/lib/config/countries";
import type { GraphicBranding, GraphicSizeId, PlayerCardGraphicData } from "@/lib/graphics/types";

function percent(ratio: number, played: number): string {
  return played > 0 ? `${Math.round(ratio * 100)}%` : "—";
}

export function PlayerProfileTemplate({
  branding,
  size,
  data,
}: {
  readonly branding: GraphicBranding;
  readonly size: GraphicSizeId;
  readonly data: PlayerCardGraphicData;
}) {
  const square = size === "square";
  const tiles = [
    { label: "Tournaments", value: data.tournaments },
    { label: "Played", value: data.played },
    { label: "Wins", value: data.wins },
    { label: "Draws", value: data.draws },
    { label: "Losses", value: data.losses },
    { label: "Goals", value: data.goalsFor },
    { label: "Titles", value: data.titles },
    { label: "Win rate", value: percent(data.winRate, data.played) },
  ];
  const country = data.country ? countryName(data.country) : "";

  return (
    <GraphicFrame branding={branding} size={size} footerNote="Verified player record">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex rounded-full ring-[4px] ring-electric-400/60 ring-offset-[9px] ring-offset-navy-950">
            <GraphicAvatar
              name={data.player.gamerTag}
              src={data.player.avatarUrl}
              size={square ? 170 : 220}
              ring="border-electric-300/50"
            />
          </span>
          <GraphicTag
            tag={data.player.gamerTag}
            className="mt-7 max-w-[860px] font-display text-[50px] font-semibold uppercase leading-none tracking-display text-white"
          />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {data.country ? (
              <GraphicChip>
                <span aria-hidden="true">{countryFlag(data.country)}</span>
                {country}
              </GraphicChip>
            ) : null}
            <GraphicChip tone="electric">{data.game}</GraphicChip>
            {data.platform ? <GraphicChip>{data.platform}</GraphicChip> : null}
            {data.favouriteClub ? <GraphicChip>Supports {data.favouriteClub}</GraphicChip> : null}
            {data.community ? <GraphicChip>{data.community}</GraphicChip> : null}
          </div>
        </div>

        <div className="mt-7 grid grid-cols-4 gap-2.5">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="border-white/12 rounded-xl border bg-navy-900/70 px-3 py-3 text-center"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-grey-500">
                {tile.label}
              </p>
              <p className="mt-1 font-display text-[26px] font-semibold tabular-nums text-white">
                {tile.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-6 pt-6">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-gold-300">
              {data.game} rating
            </p>
            {data.rating !== null ? (
              <>
                <p className="mt-1 font-display text-[46px] font-semibold tabular-nums leading-none text-white">
                  {data.rating}
                </p>
                <p className="mt-2 text-[16px] text-grey-400">
                  {data.eligible && data.rank !== null
                    ? `Rank #${data.rank} on the ${data.game} ladder`
                    : `Unranked · ${Math.max(0, 5 - data.ratedMatches)} rated matches to qualify`}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 font-display text-[36px] font-semibold leading-none text-grey-300">
                  Unranked
                </p>
                <p className="mt-2 max-w-[420px] text-[15px] leading-5 text-grey-500">
                  A rating starts at 1000 and moves only when a tournament completes.
                </p>
              </>
            )}
            <p className="mt-4 break-all font-mono text-[14px] leading-5 text-grey-500">
              {data.profileUrl.replace(/^https?:\/\//, "")}
            </p>
          </div>
          <GraphicQr src={data.qrSvg} size={square ? 132 : 150} caption="Scan profile" />
        </div>
      </div>
    </GraphicFrame>
  );
}
