"use client";

// GCC - player profile card with verified record, rating and QR link.
import {
  GraphicAvatar,
  GraphicChip,
  GraphicFrame,
  GraphicPanel,
  GraphicQr,
  GraphicSectionTitle,
  GraphicStat,
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
      <GraphicSectionTitle
        eyebrow="Player profile"
        title="Career record"
        description="Results recorded through GCC tournaments."
        meta={<GraphicChip tone="electric">{data.game}</GraphicChip>}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <GraphicPanel tone="raised" className="flex shrink-0 items-center gap-6">
          <span
            className="inline-flex shrink-0 rounded-full ring-[4px] ring-electric-400/60 ring-offset-[8px] ring-offset-navy-950"
            style={{ marginLeft: 8 }}
          >
            <GraphicAvatar
              name={data.player.gamerTag}
              src={data.player.avatarUrl}
              size={square ? 138 : 176}
              ring="border-electric-300/50"
            />
          </span>
          <div className="min-w-0 flex-1">
            <GraphicTag
              tag={data.player.gamerTag}
              className="font-display text-[44px] font-semibold uppercase leading-none tracking-display text-white"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {data.country ? (
                <GraphicChip>
                  <span aria-hidden="true">{countryFlag(data.country)}</span>
                  {country}
                </GraphicChip>
              ) : null}
              {data.platform ? <GraphicChip>{data.platform}</GraphicChip> : null}
              {data.favouriteClub ? <GraphicChip>Supports {data.favouriteClub}</GraphicChip> : null}
              {data.community ? <GraphicChip>{data.community}</GraphicChip> : null}
            </div>
          </div>
        </GraphicPanel>

        <div className="grid shrink-0 grid-cols-4 gap-2.5">
          {tiles.map((tile) => (
            <GraphicStat key={tile.label} label={tile.label} value={tile.value} />
          ))}
        </div>

        <div className="flex min-h-0 flex-1 items-stretch gap-4">
          <GraphicPanel className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-gold-300">
              {data.game} rating
            </p>
            {data.rating !== null ? (
              <>
                <p className="mt-1 font-display text-[44px] font-semibold tabular-nums leading-none text-white">
                  {data.rating}
                </p>
                <p className="mt-2 text-[15px] text-grey-400">
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
                <p className="mt-2 max-w-[480px] text-[14px] leading-5 text-grey-500">
                  A rating starts at 1000 and moves only when a tournament completes.
                </p>
              </>
            )}
            <p className="mt-3 truncate font-mono text-[13px] text-grey-500">
              {data.profileUrl.replace(/^https?:\/\//, "")}
            </p>
          </GraphicPanel>
          <GraphicPanel tone="electric" className="flex shrink-0 items-center justify-center px-5">
            <GraphicQr src={data.qrSvg} size={square ? 112 : 134} caption="Scan profile" />
          </GraphicPanel>
        </div>
      </div>
    </GraphicFrame>
  );
}
