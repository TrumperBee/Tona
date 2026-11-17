"use client";

// GCC - tournament announcement poster for organisers.
import { GraphicChip, GraphicFrame, GraphicQr } from "@/components/graphics/graphic-primitives";
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
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <p className="text-[17px] font-semibold uppercase tracking-[0.24em] text-gold-300">
          Registration open
        </p>
        <h2 className="mt-3 max-w-[860px] font-display text-[54px] font-semibold uppercase leading-[1.02] tracking-display text-white">
          Claim your place
        </h2>
        <p className="mt-4 max-w-[760px] text-[19px] leading-7 text-grey-300">
          {branding.gameName}
          {branding.season ? ` · ${branding.season}` : ""}. Enter through GCC and every result is
          recorded, verified and kept in your permanent player record.
        </p>

        <div className="mt-7 flex flex-wrap gap-2.5">
          <GraphicChip tone="electric">{data.slots} player field</GraphicChip>
          <GraphicChip>{placesLeft} places remaining</GraphicChip>
          <GraphicChip tone="gold">Registration open</GraphicChip>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3">
          <div className="border-white/12 rounded-xl border bg-navy-900/70 p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-grey-500">
              Starts
            </p>
            <p className="mt-1 text-[20px] font-semibold text-white">
              {announcementDateLabel(data.startsAt)}
            </p>
          </div>
          <div className="border-white/12 rounded-xl border bg-navy-900/70 p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-grey-500">
              Field
            </p>
            <p className="mt-1 text-[20px] font-semibold text-white">
              {data.registered} / {data.slots} registered
            </p>
          </div>
          <div className="border-white/12 rounded-xl border bg-navy-900/70 p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-grey-500">
              Organiser
            </p>
            <p className="mt-1 truncate text-[20px] font-semibold text-white">
              {data.organiserName ?? branding.organiserName ?? "GCC"}
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-6 rounded-2xl border border-electric-400/25 bg-electric-500/[0.06] p-5">
          <GraphicQr src={data.qrSvg} size={portrait ? 136 : 156} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-electric-300">
              Enter from your phone
            </p>
            <p className="mt-1 text-[18px] font-semibold text-white">Scan the code or open</p>
            <p className="mt-2 break-all font-mono text-[15px] leading-5 text-grey-300">
              {data.registrationUrl.replace(/^https?:\/\//, "")}
            </p>
            <p className="mt-3 text-[14px] leading-5 text-grey-500">
              Registration closes when the field is full or when the organiser closes entries.
            </p>
          </div>
        </div>
      </div>
    </GraphicFrame>
  );
}
