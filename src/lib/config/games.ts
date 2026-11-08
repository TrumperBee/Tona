// GCC — supported football games and platforms.
// Add new titles here; tournament formats and registrations reference these ids.

export type PlatformId = "android" | "ios" | "pc" | "playstation" | "xbox";

export interface PlatformDefinition {
  readonly id: PlatformId;
  readonly name: string;
  readonly shortName: string;
}

export const PLATFORMS = [
  { id: "android", name: "Android", shortName: "Android" },
  { id: "ios", name: "iOS", shortName: "iOS" },
  { id: "pc", name: "PC", shortName: "PC" },
  { id: "playstation", name: "PlayStation", shortName: "PS" },
  { id: "xbox", name: "Xbox", shortName: "Xbox" },
] as const satisfies readonly PlatformDefinition[];

export type GameId = "efootball" | "ea-sports-fc" | "dream-league-soccer";

export interface GameDefinition {
  readonly id: GameId;
  readonly name: string;
  readonly slug: string;
  readonly platforms: readonly PlatformId[];
}

export const GAMES = [
  {
    id: "efootball",
    name: "eFootball",
    slug: "efootball",
    platforms: ["android", "ios", "pc", "playstation", "xbox"],
  },
  {
    id: "ea-sports-fc",
    name: "EA SPORTS FC",
    slug: "ea-sports-fc",
    platforms: ["pc", "playstation", "xbox"],
  },
  {
    id: "dream-league-soccer",
    name: "Dream League Soccer",
    slug: "dream-league-soccer",
    platforms: ["android", "ios"],
  },
] as const satisfies readonly GameDefinition[];

export type SupportedGame = (typeof GAMES)[number];

const gameIds = new Set<string>(GAMES.map((game) => game.id));

export function isGameId(value: string): value is GameId {
  return gameIds.has(value);
}

export function getGame(id: GameId): SupportedGame {
  const game = GAMES.find((candidate) => candidate.id === id);

  if (!game) {
    // Defensive: GameId is a closed union, so this can only happen at runtime
    // if data bypassed the type system.
    throw new Error(`Unknown game id: ${id}`);
  }

  return game;
}

/** Platforms supported by a game, typed as a plain list for comparisons. */
export function getGamePlatforms(id: GameId): readonly PlatformId[] {
  return getGame(id).platforms;
}
