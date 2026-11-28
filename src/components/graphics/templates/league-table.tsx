"use client";

// GCC - full 36-row league table graphic.
//
// Story size only: the full table is the point, so every row stays on one
// image. Columns share one grid and one row rhythm to avoid a scattered feel.
import {
  GraphicAvatar,
  GraphicChip,
  GraphicFrame,
  GraphicPanel,
  GraphicSectionTitle,
  GraphicTag,
} from "@/components/graphics/graphic-primitives";
import { formatGoalDifference } from "@/lib/graphics/data";
import type { StandingBand } from "@/lib/engine/standings/types";
import type { GraphicBranding, GraphicSizeId, LeagueTableGraphicData } from "@/lib/graphics/types";

const BAND_COLORS: Readonly<Record<StandingBand, string>> = {
  direct: "#22C55E",
  playoff_seeded: "#56B8FF",
  playoff_unseeded: "#F5C443",
  eliminated: "#64748B",
};

const BAND_LABELS: Readonly<Record<StandingBand, string>> = {
  direct: "Round of 16",
  playoff_seeded: "Play-off · seeded",
  playoff_unseeded: "Play-off · unseeded",
  eliminated: "Eliminated",
};

const BAND_ORDER: readonly StandingBand[] = [
  "direct",
  "playoff_seeded",
  "playoff_unseeded",
  "eliminated",
];

const COLUMNS = ["P", "W", "D", "L", "GF", "GA", "GD"] as const;
const GRID_COLUMNS = "50px 34px minmax(0, 1fr) repeat(7, 56px) 64px";

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
      <GraphicSectionTitle
        eyebrow="League phase"
        title={data.title}
        description={data.subtitle}
        meta={
          <GraphicChip
            tone={data.provisional ? "gold" : "electric"}
            dot={data.provisional ? "#F5C443" : "#22C55E"}
          >
            {data.provisional ? "Provisional" : "Final standings"}
          </GraphicChip>
        }
      />

      <GraphicPanel className="flex min-h-0 flex-1 flex-col" padded={false}>
        <div
          className="grid shrink-0 items-center gap-2 border-b border-white/10 bg-white/[0.03] px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-grey-500"
          style={{ gridTemplateColumns: GRID_COLUMNS }}
        >
          <span className="text-center">#</span>
          <span />
          <span>Player</span>
          {COLUMNS.map((column) => (
            <span key={column} className="text-center">
              {column}
            </span>
          ))}
          <span className="text-center text-gold-300">Pts</span>
        </div>

        <div
          className="grid min-h-0 flex-1"
          style={{ gridTemplateRows: `repeat(${data.rows.length}, minmax(0, 1fr))` }}
        >
          {data.rows.map((row) => (
            <div
              key={row.uid}
              className="grid items-center gap-2 border-b border-white/[0.05] px-5 last:border-b-0"
              style={{ gridTemplateColumns: GRID_COLUMNS }}
            >
              <span className="flex items-center justify-center gap-1.5 tabular-nums">
                <span
                  aria-hidden="true"
                  className="h-3 w-[3px] shrink-0 rounded-full"
                  style={{ backgroundColor: BAND_COLORS[row.band] }}
                />
                <span
                  className={`font-display text-[16px] font-semibold ${
                    row.position <= 3 ? "text-gold-300" : "text-white"
                  }`}
                >
                  {row.position}
                </span>
              </span>
              <GraphicAvatar
                name={row.gamerTag}
                src={row.avatarUrl}
                size={28}
                ring="border-white/15"
              />
              <GraphicTag tag={row.gamerTag} className="text-[16px] font-semibold text-grey-100" />
              <span className="text-center text-[15px] tabular-nums text-grey-300">
                {row.played}
              </span>
              <span className="text-center text-[15px] tabular-nums text-grey-300">{row.won}</span>
              <span className="text-center text-[15px] tabular-nums text-grey-300">
                {row.drawn}
              </span>
              <span className="text-center text-[15px] tabular-nums text-grey-300">{row.lost}</span>
              <span className="text-center text-[15px] tabular-nums text-grey-300">
                {row.goalsFor}
              </span>
              <span className="text-center text-[15px] tabular-nums text-grey-300">
                {row.goalsAgainst}
              </span>
              <span className="text-center text-[15px] tabular-nums text-grey-300">
                {formatGoalDifference(row.goalDifference)}
              </span>
              <span className="text-center font-display text-[18px] font-semibold tabular-nums text-white">
                {row.points}
              </span>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-t border-white/10 px-5 py-3 text-[12px] font-medium text-grey-400">
          {BAND_ORDER.map((band) => {
            const count = data.rows.filter((row) => row.band === band).length;

            return (
              <span key={band} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: BAND_COLORS[band] }}
                />
                {BAND_LABELS[band]}
                <span className="text-grey-600">({count})</span>
              </span>
            );
          })}
        </div>
      </GraphicPanel>
    </GraphicFrame>
  );
}
