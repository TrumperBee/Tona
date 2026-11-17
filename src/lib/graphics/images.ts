// GCC - collects every remote/data image a graphic payload can render.
//
// The export dialog preloads this list before capture so a slow or broken
// avatar is replaced by initials before html-to-image sees the DOM.
import type { GraphicBranding, GraphicPayload } from "@/lib/graphics/types";

export function collectGraphicImageUrls(
  payload: GraphicPayload,
  branding: GraphicBranding,
): string[] {
  const urls: (string | null | undefined)[] = [branding.logoSrc, branding.coverSrc];

  switch (payload.template) {
    case "league-table":
      urls.push(...payload.data.rows.map((row) => row.avatarUrl));
      break;
    case "pots":
      urls.push(
        ...payload.data.pots.flatMap((pot) => pot.players.map((player) => player.avatarUrl)),
      );
      break;
    case "fixtures":
    case "results":
      urls.push(
        ...payload.data.matches.flatMap((match) => [match.home.avatarUrl, match.away.avatarUrl]),
      );
      break;
    case "knockout":
      urls.push(
        ...payload.data.rounds.flatMap((round) =>
          round.ties.flatMap((tie) => [tie.higher.avatarUrl, tie.lower.avatarUrl]),
        ),
      );
      if (payload.data.champion) {
        urls.push(payload.data.champion.avatarUrl);
      }
      break;
    case "champion":
      urls.push(payload.data.champion.avatarUrl, payload.data.runnerUp?.avatarUrl);
      break;
    case "announcement":
      urls.push(payload.data.qrSvg);
      break;
    case "player-profile":
      urls.push(payload.data.player.avatarUrl, payload.data.qrSvg);
      break;
  }

  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}
