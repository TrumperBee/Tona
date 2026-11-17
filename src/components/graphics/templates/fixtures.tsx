"use client";

// GCC - one matchday of fixtures, with an optional scores variant.
import {
  GraphicAvatar,
  GraphicFrame,
  GraphicSectionTitle,
  GraphicTag,
} from "@/components/graphics/graphic-primitives";
import type { GraphicBranding, GraphicSizeId, FixturesGraphicData } from "@/lib/graphics/types";

export function FixturesTemplate({
  branding,
  size,
  data,
}: {
  readonly branding: GraphicBranding;
  readonly size: GraphicSizeId;
  readonly data: FixturesGraphicData;
}) {
  const story = size === "story";
  const rowHeight = story ? 64 : 50;
  const title = data.showScores ? `Matchday ${data.matchday} results` : `Matchday ${data.matchday}`;

  return (
    <GraphicFrame branding={branding} size={size}>
      <GraphicSectionTitle
        eyebrow={data.showScores ? "Results" : "League phase"}
        title={title}
        description={
          data.showScores
            ? "Every recorded score from this matchday."
            : "Home versus away, as published by the organiser."
        }
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {data.matches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 p-6 text-[18px] text-grey-400">
            No matches are listed for this matchday.
          </p>
        ) : (
          data.matches.map((match) => (
            <div
              key={match.id}
              className="grid items-center gap-3 border-b border-white/[0.07] last:border-b-0"
              style={{ gridTemplateColumns: "1fr 142px 1fr", height: rowHeight }}
            >
              <div className="flex min-w-0 items-center justify-end gap-2.5">
                <GraphicTag
                  tag={match.home.gamerTag}
                  className="text-right text-[19px] font-semibold text-grey-100"
                />
                <GraphicAvatar
                  name={match.home.gamerTag}
                  src={match.home.avatarUrl}
                  size={32}
                  ring="border-white/15"
                />
              </div>

              <div className="flex flex-col items-center justify-center">
                {data.showScores && match.completed ? (
                  <span className="rounded-md bg-white/[0.08] px-3 py-1 font-display text-[22px] font-semibold tabular-nums text-white">
                    {match.homeGoals}–{match.awayGoals}
                  </span>
                ) : (
                  <span className="text-[15px] font-semibold uppercase tracking-[0.18em] text-grey-500">
                    vs
                  </span>
                )}
              </div>

              <div className="flex min-w-0 items-center gap-2.5">
                <GraphicAvatar
                  name={match.away.gamerTag}
                  src={match.away.avatarUrl}
                  size={32}
                  ring="border-white/15"
                />
                <GraphicTag
                  tag={match.away.gamerTag}
                  className="text-[19px] font-semibold text-grey-100"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </GraphicFrame>
  );
}
