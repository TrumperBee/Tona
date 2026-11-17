"use client";

// GCC - typed template registry renderer.
//
// One switch narrows the payload union and renders the matching fixed-size
// template. Adding a template means adding a payload variant in types.ts, a
// component here and a mapper in lib/graphics/data.ts.
import type { ReactNode } from "react";

import { GraphicImageProvider } from "@/components/graphics/graphic-primitives";
import { AnnouncementTemplate } from "@/components/graphics/templates/announcement";
import { ChampionTemplate } from "@/components/graphics/templates/champion";
import { FixturesTemplate } from "@/components/graphics/templates/fixtures";
import { KnockoutTemplate } from "@/components/graphics/templates/knockout";
import { LeagueTableTemplate } from "@/components/graphics/templates/league-table";
import { PlayerProfileTemplate } from "@/components/graphics/templates/player-profile";
import { PotsTemplate } from "@/components/graphics/templates/pots";
import type { GraphicBranding, GraphicPayload, GraphicSizeId } from "@/lib/graphics/types";

export interface GraphicRendererProps {
  readonly payload: GraphicPayload;
  readonly branding: GraphicBranding;
  readonly size: GraphicSizeId;
  readonly blockedImages?: ReadonlySet<string>;
}

export function GraphicRenderer({
  payload,
  branding,
  size,
  blockedImages = new Set(),
}: GraphicRendererProps) {
  let template: ReactNode;

  switch (payload.template) {
    case "league-table":
      template = <LeagueTableTemplate branding={branding} size={size} data={payload.data} />;
      break;
    case "pots":
      template = <PotsTemplate branding={branding} size={size} data={payload.data} />;
      break;
    case "fixtures":
    case "results":
      template = <FixturesTemplate branding={branding} size={size} data={payload.data} />;
      break;
    case "knockout":
      template = <KnockoutTemplate branding={branding} size={size} data={payload.data} />;
      break;
    case "champion":
      template = <ChampionTemplate branding={branding} size={size} data={payload.data} />;
      break;
    case "announcement":
      template = <AnnouncementTemplate branding={branding} size={size} data={payload.data} />;
      break;
    case "player-profile":
      template = <PlayerProfileTemplate branding={branding} size={size} data={payload.data} />;
      break;
  }

  return (
    <GraphicImageProvider blocked={blockedImages}>
      <div data-graphic-root={payload.template}>{template}</div>
    </GraphicImageProvider>
  );
}
