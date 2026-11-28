"use client";

// GCC - tournament announcement poster for organisers.
import {
  GraphicChip,
  GraphicFrame,
  GraphicPanel,
  GraphicQr,
  GraphicSectionTitle,
  GraphicStat,
} from "@/components/graphics/graphic-primitives";
import { announcementDateLabel } from "@/lib/graphics/data";
import type { AnnouncementGraphicData, GraphicBranding, GraphicSizeId } from "@/lib/graphics/types";

export function AnnouncementTemplate({
  branding,
  size,
  data,
}: {
  readonly branding: GraphicBranding;
  readonly size: GraphicSizeId;
  readonly data: AnnouncementGraphicData;
}) {
  const portrait = size === "portrait";
  const placesLeft = Math.max(0, data.slots - data.registered);

  return (
    <GraphicFrame branding={branding} size={size} footerNote="Register through GCC">
      <GraphicSectionTitle
        eyebrow="Registration open"
        title="Claim your place"
        description={`${branding.gameName}${branding.season ? ` · ${branding.season}` : ""}. Every result is recorded, verified and kept in your permanent player record.`}
        meta={<GraphicChip tone="gold">{data.slots} player field</GraphicChip>}
      />

      <GraphicPanel className="flex min-h-0 flex-1 flex-col gap-5">
        <div className="grid shrink-0 grid-cols-3 gap-3">
          <GraphicStat label="Starts" value={announcementDateLabel(data.startsAt)} />
          <GraphicStat label="Registered" value={`${data.registered} / ${data.slots}`} />
          <GraphicStat
            label="Organiser"
            value={data.organiserName ?? branding.organiserName ?? "GCC"}
          />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_260px] gap-5">
          <div className="flex min-w-0 flex-col justify-center">
            <div className="flex flex-wrap gap-2">
              <GraphicChip tone="electric" dot="#2E9BFF">
                {placesLeft} places remaining
              </GraphicChip>
              <GraphicChip tone="gold" dot="#F5C443">
                Entries open
              </GraphicChip>
            </div>
            <h3 className="mt-5 font-display text-[38px] font-semibold uppercase leading-[1.05] tracking-display text-white">
              Enter from your phone
            </h3>
            <p className="mt-3 max-w-[640px] text-[17px] leading-7 text-grey-300">
              Scan the code or open the link. Registration closes when the field is full or when the
              organiser closes entries.
            </p>
            <div className="mt-6 rounded-2xl border border-electric-400/25 bg-electric-500/[0.07] px-5 py-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-electric-300">
                Registration link
              </p>
              <p className="mt-2 truncate font-mono text-[15px] text-grey-200">
                {data.registrationUrl.replace(/^https?:\/\//, "")}
              </p>
            </div>
          </div>

          <GraphicPanel tone="electric" className="flex flex-col items-center justify-center gap-4">
            <GraphicQr src={data.qrSvg} size={portrait ? 156 : 176} caption="Scan to register" />
            <p className="text-center text-[13px] font-semibold uppercase tracking-[0.14em] text-grey-400">
              GCC tournament entry
            </p>
          </GraphicPanel>
        </div>
      </GraphicPanel>
    </GraphicFrame>
  );
}
