// GCC - independent league-phase fixture validation.
//
// This module deliberately does not import the generator or its colouring
// internals. It receives pots and fixtures and re-derives every rule from
// scratch. A schedule is stored or published only after this function returns
// `valid: true`.
//
// It also returns statistics (per-player home/away totals, opponents faced from
// each pot, and matches per matchday) so the organiser and public views can show
// exactly what was checked.
import {
  LEAGUE_MATCHDAY_COUNT,
  LEAGUE_MATCH_COUNT,
  LEAGUE_MATCHES_PER_MATCHDAY,
  LEAGUE_POT_COUNT,
  LEAGUE_POT_SIZE,
} from "./types";

export type FixtureValidationCode =
  | "pot-count-invalid"
  | "pot-size-invalid"
  | "player-id-invalid"
  | "player-duplicate"
  | "player-count-invalid"
  | "fixture-invalid"
  | "match-count-invalid"
  | "matchday-invalid"
  | "matchday-match-count-invalid"
  | "self-match"
  | "pair-duplicate"
  | "player-unknown"
  | "matchday-player-duplicate"
  | "player-match-count-invalid"
  | "pot-opponent-count-invalid"
  | "pot-home-away-invalid";

export interface FixtureValidationIssue {
  readonly code: FixtureValidationCode;
  readonly message: string;
  readonly matchday?: number;
  readonly playerId?: string;
  /** One-based pot number when the issue concerns a pot. */
  readonly pot?: number;
  readonly detail?: string;
}

export interface LeagueFixtureInput {
  readonly matchday: number;
  readonly homeId: string;
  readonly awayId: string;
}

export interface PlayerFixtureStats {
  readonly playerId: string;
  /** One-based pot number. */
  readonly pot: number;
  readonly home: number;
  readonly away: number;
  /** Length 4; index 0 is pot 1. */
  readonly homeByPot: readonly number[];
  /** Length 4; index 0 is pot 1. */
  readonly awayByPot: readonly number[];
  /** Length 4; index 0 is pot 1. Counts every opponent faced from that pot. */
  readonly opponentsByPot: readonly number[];
}

export interface LeaguePhaseValidationStats {
  readonly matchCount: number;
  /** Length 8; index 0 is matchday 1. */
  readonly perMatchdayCounts: readonly number[];
  readonly perPlayer: readonly PlayerFixtureStats[];
}

export interface LeaguePhaseValidation {
  readonly valid: boolean;
  readonly errors: readonly FixtureValidationIssue[];
  readonly stats: LeaguePhaseValidationStats;
}

interface PlayerAccumulator {
  home: number;
  away: number;
  readonly homeByPot: number[];
  readonly awayByPot: number[];
}

function emptyStats(): LeaguePhaseValidationStats {
  return {
    matchCount: 0,
    perMatchdayCounts: new Array<number>(LEAGUE_MATCHDAY_COUNT).fill(0),
    perPlayer: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validates four pots of nine and a generated fixture list. The order of the
 * returned errors follows the input order, which keeps test failures and
 * organiser reports stable.
 */
export function validateLeaguePhase(
  pots: readonly (readonly string[])[],
  fixtures: readonly LeagueFixtureInput[],
): LeaguePhaseValidation {
  const errors: FixtureValidationIssue[] = [];
  const playerPot = new Map<string, number>();

  if (!Array.isArray(pots) || pots.length !== LEAGUE_POT_COUNT) {
    errors.push({
      code: "pot-count-invalid",
      message: `A league phase needs exactly ${LEAGUE_POT_COUNT} pots.`,
      detail: `Received ${Array.isArray(pots) ? pots.length : "a non-array value"}.`,
    });

    return { valid: false, errors, stats: emptyStats() };
  }

  for (let potIndex = 0; potIndex < LEAGUE_POT_COUNT; potIndex += 1) {
    const pot = pots[potIndex];

    if (!Array.isArray(pot) || pot.length !== LEAGUE_POT_SIZE) {
      errors.push({
        code: "pot-size-invalid",
        message: `Pot ${potIndex + 1} must contain exactly ${LEAGUE_POT_SIZE} players.`,
        pot: potIndex + 1,
        detail: `Received ${Array.isArray(pot) ? pot.length : "a non-array value"}.`,
      });

      continue;
    }

    for (const playerId of pot) {
      if (typeof playerId !== "string" || playerId.trim().length === 0) {
        errors.push({
          code: "player-id-invalid",
          message: `Pot ${potIndex + 1} contains an invalid player id.`,
          pot: potIndex + 1,
        });

        continue;
      }

      if (playerPot.has(playerId)) {
        errors.push({
          code: "player-duplicate",
          message: `Player ${playerId} appears more than once.`,
          playerId,
          pot: potIndex + 1,
        });

        continue;
      }

      playerPot.set(playerId, potIndex);
    }
  }

  if (playerPot.size !== LEAGUE_POT_COUNT * LEAGUE_POT_SIZE) {
    errors.push({
      code: "player-count-invalid",
      message: `A league phase needs exactly ${LEAGUE_POT_COUNT * LEAGUE_POT_SIZE} unique players.`,
      detail: `Received ${playerPot.size}.`,
    });

    return { valid: false, errors, stats: emptyStats() };
  }

  const accumulators = new Map<string, PlayerAccumulator>();

  for (const playerId of playerPot.keys()) {
    accumulators.set(playerId, {
      home: 0,
      away: 0,
      homeByPot: new Array<number>(LEAGUE_POT_COUNT).fill(0),
      awayByPot: new Array<number>(LEAGUE_POT_COUNT).fill(0),
    });
  }

  const perMatchdayCounts = new Array<number>(LEAGUE_MATCHDAY_COUNT).fill(0);
  const playersByMatchday = Array.from({ length: LEAGUE_MATCHDAY_COUNT }, () => new Set<string>());
  const seenPairs = new Set<string>();
  const matchCount = Array.isArray(fixtures) ? fixtures.length : 0;

  if (!Array.isArray(fixtures)) {
    errors.push({
      code: "match-count-invalid",
      message: `A league phase needs exactly ${LEAGUE_MATCH_COUNT} fixtures.`,
      detail: "Received a non-array value.",
    });
  } else {
    for (const rawFixture of fixtures as readonly unknown[]) {
      if (!isRecord(rawFixture)) {
        errors.push({
          code: "fixture-invalid",
          message: "A fixture is not an object.",
        });

        continue;
      }

      const { matchday, homeId, awayId } = rawFixture as Partial<LeagueFixtureInput>;

      if (
        typeof matchday !== "number" ||
        !Number.isInteger(matchday) ||
        matchday < 1 ||
        matchday > LEAGUE_MATCHDAY_COUNT
      ) {
        errors.push({
          code: "matchday-invalid",
          message: `Every fixture needs a matchday between 1 and ${LEAGUE_MATCHDAY_COUNT}.`,
          detail: `Received ${String(matchday)}.`,
        });

        continue;
      }

      if (typeof homeId !== "string" || typeof awayId !== "string") {
        errors.push({
          code: "player-unknown",
          message: "A fixture has a missing player id.",
          matchday,
        });

        continue;
      }

      if (homeId === awayId) {
        errors.push({
          code: "self-match",
          message: `Player ${homeId} cannot play themselves.`,
          matchday,
          playerId: homeId,
        });

        continue;
      }

      const homePot = playerPot.get(homeId);
      const awayPot = playerPot.get(awayId);

      if (homePot === undefined || awayPot === undefined) {
        const unknown = homePot === undefined ? homeId : awayId;
        errors.push({
          code: "player-unknown",
          message: `Player ${unknown} is not in the confirmed pots.`,
          matchday,
          playerId: unknown,
        });

        continue;
      }

      perMatchdayCounts[matchday - 1] += 1;

      const dayPlayers = playersByMatchday[matchday - 1] as Set<string>;

      for (const playerId of [homeId, awayId]) {
        if (dayPlayers.has(playerId)) {
          errors.push({
            code: "matchday-player-duplicate",
            message: `Player ${playerId} appears more than once on matchday ${matchday}.`,
            matchday,
            playerId,
          });
        }

        dayPlayers.add(playerId);
      }

      const pairKey = homeId < awayId ? `${homeId}\u0000${awayId}` : `${awayId}\u0000${homeId}`;

      if (seenPairs.has(pairKey)) {
        errors.push({
          code: "pair-duplicate",
          message: `The pairing ${homeId} vs ${awayId} appears more than once.`,
          matchday,
        });
      } else {
        seenPairs.add(pairKey);
      }

      const home = accumulators.get(homeId) as PlayerAccumulator;
      const away = accumulators.get(awayId) as PlayerAccumulator;

      home.home += 1;
      home.homeByPot[awayPot] += 1;
      away.away += 1;
      away.awayByPot[homePot] += 1;
    }
  }

  if (matchCount !== LEAGUE_MATCH_COUNT) {
    errors.push({
      code: "match-count-invalid",
      message: `A league phase needs exactly ${LEAGUE_MATCH_COUNT} fixtures.`,
      detail: `Received ${matchCount}.`,
    });
  }

  for (let day = 0; day < LEAGUE_MATCHDAY_COUNT; day += 1) {
    const count = perMatchdayCounts[day] as number;

    if (count !== LEAGUE_MATCHES_PER_MATCHDAY) {
      errors.push({
        code: "matchday-match-count-invalid",
        message: `Matchday ${day + 1} must contain exactly ${LEAGUE_MATCHES_PER_MATCHDAY} fixtures.`,
        matchday: day + 1,
        detail: `Received ${count}.`,
      });
    }
  }

  const perPlayer: PlayerFixtureStats[] = [];

  for (const [playerId, accumulator] of accumulators) {
    const total = accumulator.home + accumulator.away;

    if (total !== LEAGUE_MATCHDAY_COUNT) {
      errors.push({
        code: "player-match-count-invalid",
        message: `Player ${playerId} must play exactly ${LEAGUE_MATCHDAY_COUNT} matches.`,
        playerId,
        detail: `Received ${total}.`,
      });
    }

    const opponentsByPot = accumulator.homeByPot.map(
      (homeCount, potIndex) => homeCount + (accumulator.awayByPot[potIndex] as number),
    );

    for (let potIndex = 0; potIndex < LEAGUE_POT_COUNT; potIndex += 1) {
      const homeAgainstPot = accumulator.homeByPot[potIndex] as number;
      const awayAgainstPot = accumulator.awayByPot[potIndex] as number;

      if (homeAgainstPot !== 1 || awayAgainstPot !== 1) {
        errors.push({
          code: "pot-home-away-invalid",
          message: `Player ${playerId} must play one home and one away match against pot ${potIndex + 1}.`,
          playerId,
          pot: potIndex + 1,
          detail: `Home ${homeAgainstPot}, away ${awayAgainstPot}.`,
        });
      }

      if ((opponentsByPot[potIndex] as number) !== 2) {
        errors.push({
          code: "pot-opponent-count-invalid",
          message: `Player ${playerId} must face exactly two opponents from pot ${potIndex + 1}.`,
          playerId,
          pot: potIndex + 1,
          detail: `Received ${opponentsByPot[potIndex] as number}.`,
        });
      }
    }

    perPlayer.push({
      playerId,
      pot: (playerPot.get(playerId) as number) + 1,
      home: accumulator.home,
      away: accumulator.away,
      homeByPot: [...accumulator.homeByPot],
      awayByPot: [...accumulator.awayByPot],
      opponentsByPot,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      matchCount,
      perMatchdayCounts,
      perPlayer,
    },
  };
}
