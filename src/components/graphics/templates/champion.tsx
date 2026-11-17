"use client";

// GCC - champion graphic with the original trophy motif.
import {
  GraphicAvatar,
  GraphicChip,
  GraphicFrame,
  GraphicTag,
  GraphicTrophy,
} from "@/components/graphics/graphic-primitives";
import type { ChampionGraphicData, GraphicBranding, GraphicSizeId } from "@/lib/graphics/types";

export function ChampionTemplate({
  branding,
  size,
  data,
}: {
  readonly branding: GraphicBranding;
  readonly size: GraphicSizeId;
  readonly data: ChampionGraphicData;
}) {
  const square = size === "square";
  const record = data.championRecord && data.championRecord.played > 0 ? data.championRecord : null;

  return (
    <GraphicFrame branding={branding} size={size} footerNote="Champions are recorded permanently">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <div className="flex items-center gap-3 text-[15px] font-semibold uppercase tracking-[0.24em] text-gold-300">
          <GraphicTrophy size={square ? 56 : 72} />
          Champion
        </div>

        <span className="mt-6 inline-flex rounded-full ring-[5px] ring-gold-400/60 ring-offset-[10px] ring-offset-navy-950">
          <GraphicAvatar
            name={data.champion.gamerTag}
            src={data.champion.avatarUrl}
            size={square ? 200 : 270}
            ring="border-gold-300/60"
          />
        </span>

        <GraphicTag
          tag={data.champion.gamerTag}
          className="mt-8 max-w-[880px] font-display text-[58px] font-semibold uppercase leading-none tracking-display text-white"
        />

        {data.finalScore ? (
          <div className="mt-6 flex items-center gap-4">
            <span className="font-display text-[56px] font-semibold tabular-nums text-white">
              {data.finalScore}
            </span>
            <div className="text-left">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-grey-500">
                Final
              </p>
              {data.scoreNote ? (
                <p className="text-[15px] font-medium text-gold-300">{data.scoreNote}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {data.runnerUp ? (
          <div className="mt-7 flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.05] py-2 pl-2 pr-5">
            <GraphicAvatar
              name={data.runnerUp.gamerTag}
              src={data.runnerUp.avatarUrl}
              size={36}
              ring="border-white/20"
            />
            <span className="text-[17px] text-grey-300">
              Runner-up{" "}
              <span className="font-semibold text-grey-100">@{data.runnerUp.gamerTag}</span>
            </span>
          </div>
        ) : null}

        {record ? (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            <GraphicChip tone="electric">
              {record.wins}W {record.draws}D {record.losses}L
            </GraphicChip>
            <GraphicChip>
              {record.goalsFor} scored · {record.goalsAgainst} conceded
            </GraphicChip>
            <GraphicChip>{record.played} played</GraphicChip>
          </div>
        ) : null}

        <p className="mt-10 max-w-[620px] text-[17px] leading-6 text-grey-400">
          {branding.tournamentName}
          {branding.season ? ` · ${branding.season}` : ""} · {branding.gameName}
        </p>
      </div>
    </GraphicFrame>
  );
}
