"use client";

// GCC - organiser graphics gallery.
//
// Only payloads with real data are passed in; an unavailable graphic is absent
// rather than greyed out with a fake preview.
import { Images } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ExportButton } from "@/components/graphics/export-button";
import { GraphicRenderer } from "@/components/graphics/graphic-renderer";
import { Card } from "@/components/ui/card";
import {
  GRAPHIC_SIZES,
  GRAPHIC_TEMPLATES,
  type GraphicBranding,
  type GraphicPayload,
} from "@/lib/graphics/types";

export interface GraphicsGalleryItem {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly payload: GraphicPayload;
}

function GraphicThumbnail({
  payload,
  branding,
}: {
  readonly payload: GraphicPayload;
  readonly branding: GraphicBranding;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const dimensions = GRAPHIC_SIZES[GRAPHIC_TEMPLATES[payload.template].defaultSize];

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    setWidth(element.clientWidth);

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? 0);
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const scale = width > 0 ? width / dimensions.width : 0;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-navy-950"
      style={{ height: scale > 0 ? dimensions.height * scale : 120 }}
    >
      {scale > 0 ? (
        <div
          style={{
            width: dimensions.width,
            height: dimensions.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "absolute",
            inset: 0,
          }}
        >
          <GraphicRenderer payload={payload} branding={branding} size={dimensions.id} />
        </div>
      ) : null}
    </div>
  );
}

export function GraphicsGallery({
  branding,
  items,
}: {
  readonly branding: GraphicBranding;
  readonly items: readonly GraphicsGalleryItem[];
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-navy-900/30 p-8 text-center">
        <Images aria-hidden="true" className="mx-auto h-6 w-6 text-grey-500" />
        <p className="mt-3 text-sm font-semibold text-grey-200">No graphics available yet</p>
        <p className="mt-1 text-xs leading-5 text-grey-500">
          Graphics are generated from real standings, fixtures, pots and knockout data. Nothing is
          rendered until that data exists.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {items.map((item) => (
        <Card key={item.key} className="flex flex-col overflow-hidden">
          <div className="p-3">
            <GraphicThumbnail payload={item.payload} branding={branding} />
          </div>
          <div className="flex flex-1 flex-col gap-3 border-t border-white/10 p-4">
            <div>
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-grey-400">{item.description}</p>
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-grey-500">
                {GRAPHIC_TEMPLATES[item.payload.template].sizes
                  .map((size) => GRAPHIC_SIZES[size].label)
                  .join(" · ")}
              </span>
              <ExportButton
                payload={item.payload}
                branding={branding}
                label="Preview & download"
                icon="images"
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
