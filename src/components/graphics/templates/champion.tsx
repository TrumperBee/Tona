"use client";

// GCC - champion graphic with the original trophy motif.
import {
  GraphicAvatar,
  GraphicChip,
  GraphicFrame,
  GraphicPanel,
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
      <GraphicPanel
        tone="gold"
        className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"
      >
        <div className="flex items-center gap-3 text-[14px] font-semibold uppercase tracking-[0.24em] text-gold-300">
          <GraphicTrophy size={square ? 48 : 64} />
          Champion
        </div>

        <span
          className={`inline-flex rounded-full ring-[5px] ring-gold-400/60 ring-offset-[10px] ring-offset-navy-950 ${
            square ? "mt-[18px]" : "mt-[26px]"
          }`}
        >
          <GraphicAvatar
            name={data.champion.gamerTag}
            src={data.champion.avatarUrl}
            size={square ? 164 : 214}
            ring="border-gold-300/60"
          />
        </span>

        <GraphicTag
          tag={data.champion.gamerTag}
          className="mt-6 max-w-[860px] font-display text-[52px] font-semibold uppercase leading-none tracking-display text-white"
        />

        <div className="mt-4 flex items-center gap-3 text-[17px] font-medium text-grey-300">
          <span className="h-px w-12 bg-gold-400/40" />
          {branding.tournamentName}
          {branding.season ? ` · ${branding.season}` : ""}
          <span className="h-px w-12 bg-gold-400/40" />
        </div>
      </GraphicPanel>

      <GraphicPanel className="mt-4 shrink-0">
        {data.finalScore ? (
          <div className="flex items-center justify-center gap-5 border-b border-white/10 pb-4">
            <span className="font-display text-[44px] font-semibold tabular-nums leading-none text-white">
              {data.finalScore}
            </span>
            <div className="text-left">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-grey-500">
                Final
              </p>
              {data.scoreNote ? (
                <p className="mt-1 text-[14px] font-medium text-gold-300">{data.scoreNote}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          {data.runnerUp ? (
            <div className="flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.04] py-2 pl-2 pr-5">
              <GraphicAvatar
                name={data.runnerUp.gamerTag}
                src={data.runnerUp.avatarUrl}
                size={36}
                ring="border-white/20"
              />
              <span className="text-[16px] text-grey-300">
                Runner-up{" "}
                <span className="font-semibold text-grey-100">@{data.runnerUp.gamerTag}</span>
              </span>
            </div>
          ) : null}
          {record ? (
            <>
              <GraphicChip tone="electric">
                {record.wins}W {record.draws}D {record.losses}L
              </GraphicChip>
              <GraphicChip>
                {record.goalsFor} scored · {record.goalsAgainst} conceded
              </GraphicChip>
              <GraphicChip>{record.played} played</GraphicChip>
            </>
          ) : null}
        </div>
      </GraphicPanel>
    </GraphicFrame>
  );
}
