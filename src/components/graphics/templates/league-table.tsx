"use client";

// GCC - 36-row league table graphic.
//
// Story size only: the full table is the point, so the layout uses every one of
// the 1920 pixels rather than splitting the field across two images.
import {
  GraphicAvatar,
  GraphicFrame,
  GraphicSectionTitle,
  GraphicTag,
} from "@/components/graphics/graphic-primitives";
import { formatGoalDifference } from "@/lib/graphics/data";
import type { GraphicBranding, GraphicSizeId, LeagueTableGraphicData } from "@/lib/graphics/types";
import type { StandingBand } from "@/lib/engine/standings/types";
import { cn } from "@/lib/utils/cn";

const BAND_COLORS: Readonly<Record<StandingBand, string>> = {
  direct: "#22C55E",
  playoff_seeded: "#56B8FF",
  playoff_unseeded: "#F5C443",
  eliminated: "#475569",
};

const BAND_LABELS: Readonly<Record<StandingBand, string>> = {
  direct: "Direct to Round of 16",
  playoff_seeded: "Play-off (seeded)",
  playoff_unseeded: "Play-off (unseeded)",
  eliminated: "Eliminated",
};

const BAND_ORDER: readonly StandingBand[] = [
  "direct",
  "playoff_seeded",
  "playoff_unseeded",
  "eliminated",
];

const COLUMNS = ["P", "W", "D", "L", "GF", "GA", "GD", "Pts"] as const;

export function LeagueTableTemplate({
  branding,
  size,
  data,
}: {
  readonly branding: GraphicBranding;
  readonly size: GraphicSizeId;
  readonly data: LeagueTableGraphicData;
}) {
  return (
    <GraphicFrame branding={branding} size={size}>
      <GraphicSectionTitle eyebrow="League phase" title={data.title} description={data.subtitle} />

      <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-navy-900/80 px-[10px] py-[7px] text-[13px] font-semibold uppercase tracking-[0.12em] text-grey-500">
        <span className="w-[44px] text-center">#</span>
        <span className="w-[30px]" />
        <span className="flex-1">Player</span>
        {COLUMNS.map((column) => (
          <span key={column} className="w-[44px] text-center">
            {column}
          </span>
        ))}
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        {data.rows.map((row) => (
          <div
            key={row.uid}
            className="flex flex-1 items-center gap-3 border-b border-white/[0.07] px-[10px] text-[19px] last:border-b-0"
            style={{ borderLeft: `5px solid ${BAND_COLORS[row.band]}`, minHeight: 0 }}
          >
            <span className="w-[44px] text-center font-display text-[20px] font-semibold tabular-nums text-white">
              {row.position}
            </span>
            <GraphicAvatar
              name={row.gamerTag}
              src={row.avatarUrl}
              size={30}
              ring="border-white/15"
            />
            <GraphicTag
              tag={row.gamerTag}
              className="flex-1 text-[19px] font-semibold text-grey-100"
            />
            <span className="w-[44px] text-center tabular-nums text-grey-300">{row.played}</span>
            <span className="w-[44px] text-center tabular-nums text-grey-300">{row.won}</span>
            <span className="w-[44px] text-center tabular-nums text-grey-300">{row.drawn}</span>
            <span className="w-[44px] text-center tabular-nums text-grey-300">{row.lost}</span>
            <span className="w-[44px] text-center tabular-nums text-grey-300">{row.goalsFor}</span>
            <span className="w-[44px] text-center tabular-nums text-grey-300">
              {row.goalsAgainst}
            </span>
            <span className="w-[44px] text-center tabular-nums text-grey-300">
              {formatGoalDifference(row.goalDifference)}
            </span>
            <span className="w-[44px] text-center font-display text-[20px] font-semibold tabular-nums text-white">
              {row.points}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-[13px] font-medium text-grey-400">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {BAND_ORDER.map((band) => {
            const count = data.rows.filter((row) => row.band === band).length;

            return (
              <span key={band} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn("h-2.5 w-2.5 rounded-sm")}
                  style={{ backgroundColor: BAND_COLORS[band] }}
                />
                {BAND_LABELS[band]}
                <span className="text-grey-600">({count})</span>
              </span>
            );
          })}
        </div>
        {data.provisional ? (
          <span className="font-semibold uppercase tracking-[0.12em] text-warning">
            Provisional table
          </span>
        ) : (
          <span className="font-semibold uppercase tracking-[0.12em] text-success">
            Final table
          </span>
        )}
      </div>
    </GraphicFrame>
  );
}
