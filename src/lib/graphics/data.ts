// GCC - pure mappers from stored/public data to graphic template payloads.
//
// No Firestore, no React and no derived competition logic lives here. A mapper
// only reshapes values the server already trusts, so the same payload drives
// the in-app preview and the exported PNG.
import type { StandingBand } from "@/lib/engine/standings/types";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/config/site";
import { formatDate } from "@/lib/utils/dates";
import type {
  AnnouncementGraphicData,
  ChampionGraphicData,
  FixtureGraphicMatch,
  FixturesGraphicData,
  GraphicBranding,
  GraphicPlayer,
  KnockoutGraphicData,
  KnockoutGraphicSlot,
  KnockoutGraphicTie,
  LeagueTableGraphicData,
  LeagueTableGraphicRow,
  PlayerCardGraphicData,
  PotsGraphicData,
} from "@/lib/graphics/types";

/** Longest gamer tag the launch product allows. */
export const GAMER_TAG_MAX_LENGTH = 16;

/**
 * Keeps a tag inside its allowed 3-16 character range and adds an ellipsis if
 * imported data ever exceeds it. CSS truncation still applies as a second line
 * of defence inside narrow columns.
 */
export function truncateGamerTag(tag: string, maxLength = GAMER_TAG_MAX_LENGTH): string {
  const value = tag.trim();

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(1, maxLength - 1))}…`;
}

/** `+12`, `0` or `-4` for a goal-difference column. */
export function formatGoalDifference(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export interface BrandingInput {
  readonly tournamentName: string;
  readonly tournamentSlug: string;
  readonly season?: string | null;
  readonly gameName: string;
  readonly logoSrc?: string | null;
  readonly coverSrc?: string | null;
  readonly organiserName?: string | null;
}

/** Builds the shared header/footer identity every template uses. */
export function graphicBranding(input: BrandingInput): GraphicBranding {
  return {
    tournamentName: input.tournamentName.trim() || "Tournament",
    tournamentSlug: input.tournamentSlug.trim() || "tournament",
    season: input.season?.trim() ?? "",
    gameName: input.gameName.trim() || "Football",
    logoSrc: input.logoSrc ?? null,
    coverSrc: input.coverSrc ?? null,
    organiserName: input.organiserName?.trim() || null,
    siteName: SITE_NAME,
    siteUrl: SITE_URL.replace(/^https?:\/\//, "").replace(/\/+$/, ""),
    tagline: SITE_TAGLINE,
  };
}

export interface LeagueTableRowLike extends GraphicPlayer {
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

export function leagueTableGraphicData(
  rows: readonly LeagueTableRowLike[],
  options: {
    readonly provisional: boolean;
    readonly title: string;
    readonly subtitle?: string | null;
  },
): LeagueTableGraphicData {
  return {
    rows: rows.map((row): LeagueTableGraphicRow => ({ ...row })),
    provisional: options.provisional,
    title: options.title,
    subtitle: options.subtitle ?? null,
  };
}

export interface PotsDrawLike {
  readonly pots: readonly {
    readonly pot: "1" | "2" | "3" | "4";
    readonly players: readonly GraphicPlayer[];
  }[];
}

export function potsGraphicData(draw: PotsDrawLike): PotsGraphicData {
  return {
    pots: draw.pots.map((pot) => ({
      pot: pot.pot,
      players: pot.players.map((player) => ({
        uid: player.uid,
        gamerTag: player.gamerTag,
        avatarUrl: player.avatarUrl,
      })),
    })),
  };
}

export interface FixtureRowLike {
  readonly id: string;
  readonly matchday: number;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly scheduledAt: string | null;
  readonly status: "scheduled" | "completed";
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
}

export type AvatarLookup = Readonly<Record<string, string | null | undefined>>;

function fixturePlayer(uid: string, gamerTag: string, avatars: AvatarLookup): GraphicPlayer {
  return {
    uid,
    gamerTag: gamerTag.trim() || "Player",
    avatarUrl: avatars[uid] ?? null,
  };
}

/**
 * One matchday of fixtures. Fixture rows do not carry avatars, so the caller
 * joins them from the public participant/standing directory by uid.
 */
export function fixturesGraphicData(
  matches: readonly FixtureRowLike[],
  matchday: number,
  avatars: AvatarLookup,
  options: { readonly showScores: boolean },
): FixturesGraphicData {
  const rows = matches
    .filter((match) => match.matchday === matchday)
    .map((match): FixtureGraphicMatch => ({
      id: match.id,
      home: fixturePlayer(match.homeUid, match.homeTag, avatars),
      away: fixturePlayer(match.awayUid, match.awayTag, avatars),
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
      completed:
        match.status === "completed" && match.homeGoals !== null && match.awayGoals !== null,
      scheduledAt: match.scheduledAt,
    }));

  return {
    matchday,
    matches: rows,
    showScores: options.showScores,
  };
}

export interface KnockoutDataLike {
  readonly rounds: readonly {
    readonly round: KnockoutGraphicData["rounds"][number]["round"];
    readonly label: string;
    readonly ties: readonly {
      readonly tieId: string;
      readonly bracketSlot: number;
      readonly higher: KnockoutGraphicSlot;
      readonly lower: KnockoutGraphicSlot;
      readonly aggregate: { readonly higherGoals: number; readonly lowerGoals: number };
      readonly legsPlayed: number;
      readonly winnerUid: string | null;
      readonly decidedBy: "aggregate" | "extra_time" | "penalties" | null;
      readonly penalties: { readonly higher: number; readonly lower: number } | null;
      readonly complete: boolean;
    }[];
  }[];
  readonly champion: GraphicPlayer | null;
  readonly runnerUp: GraphicPlayer | null;
  readonly legs: 1 | 2 | null;
  readonly ties: readonly {
    readonly tieId: string;
    readonly round: KnockoutGraphicData["rounds"][number]["round"];
    readonly aggregate: { readonly higherGoals: number; readonly lowerGoals: number };
    readonly legsPlayed: number;
    readonly winnerUid: string | null;
    readonly decidedBy: "aggregate" | "extra_time" | "penalties" | null;
    readonly penalties: { readonly higher: number; readonly lower: number } | null;
    readonly higher: KnockoutGraphicSlot;
    readonly lower: KnockoutGraphicSlot;
  }[];
}

export function knockoutGraphicData(knockout: KnockoutDataLike): KnockoutGraphicData {
  return {
    rounds: knockout.rounds.map((round) => ({
      round: round.round,
      label: round.label,
      ties: round.ties.map((tie): KnockoutGraphicTie => ({
        tieId: tie.tieId,
        bracketSlot: tie.bracketSlot,
        higher: tie.higher,
        lower: tie.lower,
        higherGoals: tie.aggregate.higherGoals,
        lowerGoals: tie.aggregate.lowerGoals,
        legsPlayed: tie.legsPlayed,
        winnerUid: tie.winnerUid,
        decidedBy: tie.decidedBy,
        penalties: tie.penalties,
        complete: tie.complete,
      })),
    })),
    champion: knockout.champion,
    legs: knockout.legs,
  };
}

function finalScoreNote(tie: KnockoutDataLike["ties"][number]): string | null {
  if (tie.decidedBy === "penalties" && tie.penalties) {
    return `Penalties ${tie.penalties.higher}–${tie.penalties.lower}`;
  }

  if (tie.decidedBy === "extra_time") {
    return "After extra time";
  }

  return tie.legsPlayed > 1 ? "Aggregate" : null;
}

/**
 * Champion payload from the stored bracket. The final aggregate is shown with
 * the champion's goals first, so the score reads the way the card reads.
 */
export function championGraphicData(knockout: KnockoutDataLike): ChampionGraphicData | null {
  if (!knockout.champion) {
    return null;
  }

  const final = knockout.ties.find((tie) => tie.round === "final") ?? null;
  const championIsHigher = final?.higher.uid === knockout.champion.uid;
  const finalScore =
    final && final.legsPlayed > 0
      ? championIsHigher
        ? `${final.aggregate.higherGoals}–${final.aggregate.lowerGoals}`
        : `${final.aggregate.lowerGoals}–${final.aggregate.higherGoals}`
      : null;

  return {
    champion: knockout.champion,
    runnerUp: knockout.runnerUp,
    finalScore,
    scoreNote: final ? finalScoreNote(final) : null,
    championRecord: null,
  };
}

export interface HallOfFameChampionLike {
  readonly tournamentName: string;
  readonly season: string;
  readonly championUid: string;
  readonly championTag: string;
  readonly championAvatarUrl: string | null;
  readonly finalistUid: string;
  readonly finalistTag: string;
  readonly finalistAvatarUrl: string | null;
  readonly stats: {
    readonly played: number;
    readonly wins: number;
    readonly draws: number;
    readonly losses: number;
    readonly goalsFor: number;
    readonly goalsAgainst: number;
  };
}

/** Champion payload for a Hall of Fame induction, with its stored record. */
export function championGraphicDataFromRecord(
  entry: HallOfFameChampionLike,
  knockout: KnockoutDataLike | null,
): ChampionGraphicData {
  const fromBracket = knockout ? championGraphicData(knockout) : null;

  return {
    champion: {
      uid: entry.championUid,
      gamerTag: entry.championTag,
      avatarUrl: entry.championAvatarUrl,
    },
    runnerUp: fromBracket?.runnerUp ?? {
      uid: entry.finalistUid,
      gamerTag: entry.finalistTag,
      avatarUrl: entry.finalistAvatarUrl,
    },
    finalScore: fromBracket?.finalScore ?? null,
    scoreNote: fromBracket?.scoreNote ?? null,
    championRecord: {
      played: entry.stats.played,
      wins: entry.stats.wins,
      draws: entry.stats.draws,
      losses: entry.stats.losses,
      goalsFor: entry.stats.goalsFor,
      goalsAgainst: entry.stats.goalsAgainst,
    },
  };
}

export interface AnnouncementInput {
  readonly startsAt: string | null;
  readonly slots: number;
  readonly registered: number;
  readonly registrationUrl: string;
  readonly organiserName?: string | null;
  readonly qrSvg: string;
}

export function announcementGraphicData(input: AnnouncementInput): AnnouncementGraphicData {
  return {
    startsAt: input.startsAt,
    slots: input.slots,
    registered: input.registered,
    registrationUrl: input.registrationUrl,
    organiserName: input.organiserName?.trim() || null,
    qrSvg: input.qrSvg,
  };
}

/** `Friday 20 November 2026` or an honest "To be confirmed". */
export function announcementDateLabel(startsAt: string | null): string {
  return startsAt ? formatDate(startsAt) : "To be confirmed";
}

export interface PlayerCardInput {
  readonly player: GraphicPlayer;
  readonly country: string;
  readonly community?: string | null;
  readonly favouriteClub?: string | null;
  readonly platform?: string | null;
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

export function playerCardGraphicData(input: PlayerCardInput): PlayerCardGraphicData {
  return {
    player: input.player,
    country: input.country,
    community: input.community?.trim() || null,
    favouriteClub: input.favouriteClub?.trim() || null,
    platform: input.platform?.trim() || null,
    game: input.game,
    played: input.played,
    wins: input.wins,
    draws: input.draws,
    losses: input.losses,
    goalsFor: input.goalsFor,
    goalsAgainst: input.goalsAgainst,
    tournaments: input.tournaments,
    titles: input.titles,
    winRate: input.winRate,
    rating: input.rating,
    rank: input.rank,
    eligible: input.eligible,
    ratedMatches: input.ratedMatches,
    profileUrl: input.profileUrl,
    qrSvg: input.qrSvg,
  };
}

/** Joins avatar URLs from a participant or standing list for fixture graphics. */
export function avatarLookup(
  players: readonly { readonly uid: string; readonly avatarUrl: string | null }[],
): Record<string, string | null> {
  return Object.fromEntries(players.map((player) => [player.uid, player.avatarUrl]));
}
