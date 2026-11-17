// GCC - typed contracts for the Phase 15 graphics generator.
//
// Every template is rendered at a fixed pixel size and exported at 2x. The
// contracts below are plain serialisable data so a server page can build a
// graphic payload and hand it to the client export dialog without passing
// Firestore documents or component references across the boundary.
import type { StandingBand } from "@/lib/engine/standings/types";
import type { KnockoutRound } from "@/lib/engine/knockout";

export const GRAPHIC_SIZE_IDS = ["story", "portrait", "square"] as const;
export type GraphicSizeId = (typeof GRAPHIC_SIZE_IDS)[number];

export interface GraphicSize {
  readonly id: GraphicSizeId;
  readonly label: string;
  readonly description: string;
  readonly width: number;
  readonly height: number;
}

export const GRAPHIC_SIZES: Readonly<Record<GraphicSizeId, GraphicSize>> = {
  story: {
    id: "story",
    label: "Story",
    description: "WhatsApp status and social stories",
    width: 1080,
    height: 1920,
  },
  portrait: {
    id: "portrait",
    label: "Portrait",
    description: "Feed posts",
    width: 1080,
    height: 1350,
  },
  square: {
    id: "square",
    label: "Square",
    description: "Square posts and profile shares",
    width: 1080,
    height: 1080,
  },
};

export const GRAPHIC_TEMPLATE_IDS = [
  "league-table",
  "pots",
  "fixtures",
  "results",
  "knockout",
  "champion",
  "announcement",
  "player-profile",
] as const;
export type GraphicTemplateId = (typeof GRAPHIC_TEMPLATE_IDS)[number];

/** Static branding shared by every template. */
export interface GraphicBranding {
  readonly tournamentName: string;
  readonly tournamentSlug: string;
  readonly season: string;
  readonly gameName: string;
  readonly logoSrc: string | null;
  readonly coverSrc: string | null;
  readonly organiserName: string | null;
  readonly siteName: string;
  readonly siteUrl: string;
  readonly tagline: string;
}

/** A player reference used by avatars and tag labels. */
export interface GraphicPlayer {
  readonly uid: string;
  readonly gamerTag: string;
  readonly avatarUrl: string | null;
}

export interface LeagueTableGraphicRow extends GraphicPlayer {
  readonly position: number;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
  readonly band: StandingBand;
}

export interface LeagueTableGraphicData {
  readonly rows: readonly LeagueTableGraphicRow[];
  readonly provisional: boolean;
  readonly title: string;
  readonly subtitle: string | null;
}

export interface PotsGraphicData {
  readonly pots: readonly {
    readonly pot: "1" | "2" | "3" | "4";
    readonly players: readonly GraphicPlayer[];
  }[];
}

export interface FixtureGraphicMatch {
  readonly id: string;
  readonly home: GraphicPlayer;
  readonly away: GraphicPlayer;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
  readonly completed: boolean;
  readonly scheduledAt: string | null;
}

export interface FixturesGraphicData {
  readonly matchday: number;
  readonly matches: readonly FixtureGraphicMatch[];
  readonly showScores: boolean;
}

export interface KnockoutGraphicSlot {
  readonly uid: string | null;
  readonly gamerTag: string | null;
  readonly avatarUrl: string | null;
  readonly position: number | null;
  readonly source: string;
}

export interface KnockoutGraphicTie {
  readonly tieId: string;
  readonly bracketSlot: number;
  readonly higher: KnockoutGraphicSlot;
  readonly lower: KnockoutGraphicSlot;
  readonly higherGoals: number;
  readonly lowerGoals: number;
  readonly legsPlayed: number;
  readonly winnerUid: string | null;
  readonly decidedBy: "aggregate" | "extra_time" | "penalties" | null;
  readonly penalties: { readonly higher: number; readonly lower: number } | null;
  readonly complete: boolean;
}

export interface KnockoutGraphicRound {
  readonly round: KnockoutRound;
  readonly label: string;
  readonly ties: readonly KnockoutGraphicTie[];
}

export interface KnockoutGraphicData {
  readonly rounds: readonly KnockoutGraphicRound[];
  readonly champion: GraphicPlayer | null;
  readonly legs: 1 | 2 | null;
}

export interface ChampionGraphicData {
  readonly champion: GraphicPlayer;
  readonly runnerUp: GraphicPlayer | null;
  readonly finalScore: string | null;
  readonly scoreNote: string | null;
  readonly championRecord: {
    readonly played: number;
    readonly wins: number;
    readonly draws: number;
    readonly losses: number;
    readonly goalsFor: number;
    readonly goalsAgainst: number;
  } | null;
}

export interface AnnouncementGraphicData {
  readonly startsAt: string | null;
  readonly slots: number;
  readonly registered: number;
  readonly registrationUrl: string;
  readonly organiserName: string | null;
  readonly qrSvg: string;
}

export interface PlayerCardGraphicData {
  readonly player: GraphicPlayer;
  readonly country: string;
  readonly community: string | null;
  readonly favouriteClub: string | null;
  readonly platform: string | null;
  readonly game: string;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly tournaments: number;
  readonly titles: number;
  readonly winRate: number;
  readonly rating: number | null;
  readonly rank: number | null;
  readonly eligible: boolean;
  readonly ratedMatches: number;
  readonly profileUrl: string;
  readonly qrSvg: string;
}

/** Discriminated payload passed to the renderer and export dialog. */
export type GraphicPayload =
  | { readonly template: "league-table"; readonly data: LeagueTableGraphicData }
  | { readonly template: "pots"; readonly data: PotsGraphicData }
  | { readonly template: "fixtures"; readonly data: FixturesGraphicData }
  | { readonly template: "results"; readonly data: FixturesGraphicData }
  | { readonly template: "knockout"; readonly data: KnockoutGraphicData }
  | { readonly template: "champion"; readonly data: ChampionGraphicData }
  | { readonly template: "announcement"; readonly data: AnnouncementGraphicData }
  | { readonly template: "player-profile"; readonly data: PlayerCardGraphicData };

export interface GraphicTemplateDefinition {
  readonly id: GraphicTemplateId;
  readonly label: string;
  readonly description: string;
  /** Sizes this template can lay out without cramping or empty space. */
  readonly sizes: readonly GraphicSizeId[];
  /** Default size used when the dialog opens. */
  readonly defaultSize: GraphicSizeId;
  /** Short token used in export file names. */
  readonly fileToken: string;
}

export const GRAPHIC_TEMPLATES: Readonly<Record<GraphicTemplateId, GraphicTemplateDefinition>> = {
  "league-table": {
    id: "league-table",
    label: "League table",
    description: "All 36 rows with the qualification bands and legend.",
    sizes: ["story"],
    defaultSize: "story",
    fileToken: "table",
  },
  pots: {
    id: "pots",
    label: "Pots",
    description: "The confirmed draw, four pots of nine.",
    sizes: ["story"],
    defaultSize: "story",
    fileToken: "pots",
  },
  fixtures: {
    id: "fixtures",
    label: "Fixtures",
    description: "One matchday, home versus away, with or without scores.",
    sizes: ["portrait", "story"],
    defaultSize: "portrait",
    fileToken: "fixtures",
  },
  results: {
    id: "results",
    label: "Results",
    description: "One completed matchday with the recorded scores.",
    sizes: ["portrait", "story"],
    defaultSize: "portrait",
    fileToken: "results",
  },
  knockout: {
    id: "knockout",
    label: "Knockout bracket",
    description: "All 23 ties from the play-offs to the final.",
    sizes: ["story"],
    defaultSize: "story",
    fileToken: "bracket",
  },
  champion: {
    id: "champion",
    label: "Champion",
    description: "The winner, the final score and the runner-up.",
    sizes: ["story", "square"],
    defaultSize: "story",
    fileToken: "champion",
  },
  announcement: {
    id: "announcement",
    label: "Announcement poster",
    description: "Registration open, with the entry link and a QR code.",
    sizes: ["story", "portrait"],
    defaultSize: "story",
    fileToken: "announcement",
  },
  "player-profile": {
    id: "player-profile",
    label: "Player profile card",
    description: "Verified record, rating and a QR link to the profile.",
    sizes: ["story", "square"],
    defaultSize: "story",
    fileToken: "profile",
  },
};

/** True when a template supports a size. */
export function templateSupportsSize(template: GraphicTemplateId, size: GraphicSizeId): boolean {
  return GRAPHIC_TEMPLATES[template].sizes.includes(size);
}
