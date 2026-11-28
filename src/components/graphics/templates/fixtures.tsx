"use client";

// GCC - one matchday of fixtures, with an optional scores variant.
import {
  GraphicAvatar,
  GraphicChip,
  GraphicFrame,
  GraphicPanel,
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
  const title = data.showScores ? `Matchday ${data.matchday} results` : `Matchday ${data.matchday}`;
  const completed = data.matches.filter((match) => match.completed).length;

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
        meta={
          <GraphicChip tone="electric">
            {data.showScores
              ? `${completed} of ${data.matches.length} played`
              : `${data.matches.length} matches`}
          </GraphicChip>
        }
      />

      <GraphicPanel padded={false} className="flex min-h-0 flex-1 flex-col">
        {data.matches.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="rounded-xl border border-dashed border-white/15 px-6 py-5 text-[17px] text-grey-400">
              No matches are listed for this matchday.
            </p>
          </div>
        ) : (
          <div
            className="grid min-h-0 flex-1 gap-2.5 p-4"
            style={{
              gridTemplateColumns: story ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
              gridTemplateRows: `repeat(${Math.ceil(data.matches.length / (story ? 1 : 2))}, minmax(0, 1fr))`,
            }}
          >
            {data.matches.map((match) => (
              <div
                key={match.id}
                className="flex min-h-0 items-center rounded-2xl border border-white/10 bg-navy-950/50 px-4"
              >
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
                  <GraphicTag
                    tag={match.home.gamerTag}
                    className="text-right text-[17px] font-semibold text-grey-100"
                  />
                  <GraphicAvatar
                    name={match.home.gamerTag}
                    src={match.home.avatarUrl}
                    size={32}
                    ring="border-white/15"
                  />
                </div>

                <div className="mx-3 flex w-[104px] shrink-0 flex-col items-center">
                  {data.showScores && match.completed ? (
                    <>
                      <span className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1 text-center font-display text-[21px] font-semibold tabular-nums text-white">
                        {match.homeGoals}–{match.awayGoals}
                      </span>
                      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-grey-500">
                        Full time
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[15px] font-semibold uppercase tracking-[0.18em] text-grey-500">
                        vs
                      </span>
                      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-grey-600">
                        {match.completed ? "Completed" : "Scheduled"}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <GraphicAvatar
                    name={match.away.gamerTag}
                    src={match.away.avatarUrl}
                    size={32}
                    ring="border-white/15"
                  />
                  <GraphicTag
                    tag={match.away.gamerTag}
                    className="text-[17px] font-semibold text-grey-100"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </GraphicPanel>
    </GraphicFrame>
  );
}
