// GCC - deterministic league-phase fixture generation.
//
// PURE TypeScript: no Firebase, no framework imports, no I/O and never
// `Math.random`. Given four pots of nine players and a seed, the generator
// returns the same 144 fixtures every time.
//
// Step A - constructive pairing
//   * Each pot becomes a random ring. `ring[k]` hosts `ring[k+1]`, so every
//     player faces two pot-mates: one at home and one away.
//   * For every pair of pots a seeded bijection tau joins the rings. For each
//     position a we take `i[a]` at home to `j[tau[a]]` and `j[tau[a+1]]` at
//     home to `i[a]`. Every player therefore meets exactly two opponents from
//     each other pot, once at home and once away.
//   * The resulting graph is 8-regular on 36 vertices: 36 within-pot edges and
//     108 cross-pot edges (six pot pairs x eighteen).
//
// Step B - proper 8-edge-colouring
//   An exact-cover search (see `colouring.ts`) assigns each edge to one of
//   eight matchdays. Each colour covers every player exactly once, so every
//   player plays eight matches and exactly one per matchday. If the bounded
//   search fails, the next attempt rebuilds Step A from
//   `deriveSeed(seed, "attempt-k")`; a schedule is never returned partially.
//
// Step C - best-effort streak reduction
//   A schedule can be changed without touching pairings by flipping the
//   orientation of a whole "block" (a pot ring or one pot-pair) and by
//   permuting matchday labels. Both preserve one home and one away against
//   every pot. A seeded random walk lowers the number of players with a run of
//   three or more consecutive home/away matches and reports the final result.
import { createSeededRandom, deriveSeed } from "../random";
import { findEdgeColouring, type ColouringEdge } from "./colouring";
import {
  FIXTURE_ALGORITHM_VERSION,
  FIXTURE_COLOURING_NODE_BUDGET,
  FIXTURE_MAX_ATTEMPTS,
  FixtureGenerationError,
  LEAGUE_MATCHDAY_COUNT,
  LEAGUE_POT_COUNT,
  LEAGUE_POT_SIZE,
  LEAGUE_MATCH_COUNT,
  type GenerateLeaguePhaseInput,
  type GenerateLeaguePhaseOptions,
  type GeneratedFixture,
  type LeaguePhaseGeneration,
} from "./types";

const POT_PAIRS = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
] as const;

const BLOCK_COUNT = LEAGUE_POT_COUNT + POT_PAIRS.length;
const STEP_C_ITERATIONS = 240;

interface EdgeSpec extends ColouringEdge {
  /** 0-3 = within-pot ring; 4-9 = one pot pair. */
  readonly block: number;
  /** Baseline orientation: true means `u` hosts. */
  readonly baselineUHome: boolean;
}

interface ScheduledEdge extends EdgeSpec {
  readonly colour: number;
}

interface StreakScore {
  readonly maxStreak: number;
  readonly streak3Plus: number;
}

interface OrientationState {
  readonly flips: readonly boolean[];
  readonly colourToDay: readonly number[];
}

function compareText(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function compareFixtures(a: GeneratedFixture, b: GeneratedFixture): number {
  if (a.matchday !== b.matchday) {
    return a.matchday - b.matchday;
  }

  const home = compareText(a.homeId, b.homeId);

  return home !== 0 ? home : compareText(a.awayId, b.awayId);
}

/**
 * Validates the pots and returns a flat player list indexed by vertex. Vertex
 * `pot * 9 + position` belongs to `pot` (zero-based) at `position`.
 */
function flattenPots(pots: GenerateLeaguePhaseInput["pots"]): string[] {
  if (!Array.isArray(pots) || pots.length !== LEAGUE_POT_COUNT) {
    throw new FixtureGenerationError(
      "invalid-pots",
      `A league phase needs exactly ${LEAGUE_POT_COUNT} pots.`,
    );
  }

  const players: string[] = [];
  const seen = new Set<string>();

  for (let potIndex = 0; potIndex < LEAGUE_POT_COUNT; potIndex += 1) {
    const pot = pots[potIndex];

    if (!Array.isArray(pot) || pot.length !== LEAGUE_POT_SIZE) {
      throw new FixtureGenerationError(
        "invalid-pots",
        `Pot ${potIndex + 1} must contain exactly ${LEAGUE_POT_SIZE} players.`,
      );
    }

    for (const playerId of pot) {
      if (typeof playerId !== "string" || playerId.trim().length === 0) {
        throw new FixtureGenerationError(
          "invalid-pots",
          `Pot ${potIndex + 1} contains an invalid player id.`,
        );
      }

      if (seen.has(playerId)) {
        throw new FixtureGenerationError(
          "invalid-pots",
          `Player ${playerId} appears in more than one pot slot.`,
        );
      }

      seen.add(playerId);
      players.push(playerId);
    }
  }

  if (players.length !== LEAGUE_POT_COUNT * LEAGUE_POT_SIZE) {
    throw new FixtureGenerationError(
      "invalid-pots",
      `A league phase needs exactly ${LEAGUE_POT_COUNT * LEAGUE_POT_SIZE} unique players.`,
    );
  }

  return players;
}

function buildEdges(attemptSeed: string): { edges: EdgeSpec[]; rings: number[][] } {
  const random = createSeededRandom(deriveSeed(attemptSeed, "step-a"));

  const rings = Array.from({ length: LEAGUE_POT_COUNT }, (_, potIndex) =>
    random.shuffle(
      Array.from({ length: LEAGUE_POT_SIZE }, (_, position) => potIndex * 9 + position),
    ),
  );

  const edges: EdgeSpec[] = [];

  // Within-pot rings: ring[k] hosts ring[k+1].
  for (let potIndex = 0; potIndex < LEAGUE_POT_COUNT; potIndex += 1) {
    const ring = rings[potIndex] as number[];

    for (let position = 0; position < LEAGUE_POT_SIZE; position += 1) {
      edges.push({
        u: ring[position] as number,
        v: ring[(position + 1) % LEAGUE_POT_SIZE] as number,
        block: potIndex,
        baselineUHome: true,
      });
    }
  }

  // Cross-pot bijections: two edges per position, one home each way.
  for (let pairIndex = 0; pairIndex < POT_PAIRS.length; pairIndex += 1) {
    const [firstPot, secondPot] = POT_PAIRS[pairIndex] as readonly [number, number];
    const firstRing = rings[firstPot] as number[];
    const secondRing = rings[secondPot] as number[];
    const tau = random.shuffle(Array.from({ length: LEAGUE_POT_SIZE }, (_, index) => index));

    for (let position = 0; position < LEAGUE_POT_SIZE; position += 1) {
      const firstPlayer = firstRing[position] as number;
      const secondPlayer = secondRing[tau[position] as number] as number;
      const nextSecondPlayer = secondRing[
        tau[(position + 1) % LEAGUE_POT_SIZE] as number
      ] as number;

      // firstPot player hosts its first opponent.
      edges.push({
        u: firstPlayer,
        v: secondPlayer,
        block: LEAGUE_POT_COUNT + pairIndex,
        baselineUHome: true,
      });

      // secondPot player hosts its first opponent.
      edges.push({
        u: nextSecondPlayer,
        v: firstPlayer,
        block: LEAGUE_POT_COUNT + pairIndex,
        baselineUHome: true,
      });
    }
  }

  return { edges, rings };
}

function isHome(edge: EdgeSpec, flips: readonly boolean[]): boolean {
  const flipped = flips[edge.block] === true;
  return edge.baselineUHome !== flipped;
}

function evaluateStreaks(
  scheduled: readonly ScheduledEdge[],
  flips: readonly boolean[],
  colourToDay: readonly number[],
  playerCount: number,
): StreakScore {
  // 1 = home, 0 = away. Every player has exactly one fixture per day.
  const homeByDay = Array.from(
    { length: playerCount },
    () => new Uint8Array(LEAGUE_MATCHDAY_COUNT),
  );

  for (const edge of scheduled) {
    const day = colourToDay[edge.colour] as number;
    const home = isHome(edge, flips);

    (homeByDay[edge.u] as Uint8Array)[day] = home ? 1 : 0;
    (homeByDay[edge.v] as Uint8Array)[day] = home ? 0 : 1;
  }

  let maxStreak = 0;
  let streak3Plus = 0;

  for (const row of homeByDay) {
    let currentRun = 1;
    let longestRun = 1;

    for (let day = 1; day < LEAGUE_MATCHDAY_COUNT; day += 1) {
      if (row[day] === row[day - 1]) {
        currentRun += 1;

        if (currentRun > longestRun) {
          longestRun = currentRun;
        }
      } else {
        currentRun = 1;
      }
    }

    if (longestRun > maxStreak) {
      maxStreak = longestRun;
    }

    if (longestRun >= 3) {
      streak3Plus += 1;
    }
  }

  return { maxStreak, streak3Plus };
}

function isBetter(candidate: StreakScore, current: StreakScore): boolean {
  if (candidate.streak3Plus !== current.streak3Plus) {
    return candidate.streak3Plus < current.streak3Plus;
  }

  return candidate.maxStreak < current.maxStreak;
}

function equalScore(candidate: StreakScore, current: StreakScore): boolean {
  return candidate.streak3Plus === current.streak3Plus && candidate.maxStreak === current.maxStreak;
}

/**
 * Best-effort Step C. The random walk only accepts an improvement, or an equal
 * score with probability 1/3 so it can cross a plateau. Pairings never change.
 */
function reduceStreaks(
  scheduled: readonly ScheduledEdge[],
  attemptSeed: string,
): { state: OrientationState; score: StreakScore } {
  const random = createSeededRandom(deriveSeed(attemptSeed, "step-c"));

  let flips = new Array<boolean>(BLOCK_COUNT).fill(false);
  let colourToDay = Array.from({ length: LEAGUE_MATCHDAY_COUNT }, (_, index) => index);
  let current = evaluateStreaks(scheduled, flips, colourToDay, LEAGUE_POT_COUNT * LEAGUE_POT_SIZE);
  let bestScore = current;
  let bestFlips = [...flips];
  let bestColourToDay = [...colourToDay];

  for (let step = 0; step < STEP_C_ITERATIONS && bestScore.streak3Plus > 0; step += 1) {
    const candidateFlips = [...flips];
    const candidateColourToDay = [...colourToDay];

    if (random.nextInt(2) === 0) {
      const block = random.nextInt(BLOCK_COUNT);
      candidateFlips[block] = !candidateFlips[block];
    } else {
      const first = random.nextInt(LEAGUE_MATCHDAY_COUNT);
      let second = random.nextInt(LEAGUE_MATCHDAY_COUNT);

      while (second === first) {
        second = random.nextInt(LEAGUE_MATCHDAY_COUNT);
      }

      const held = candidateColourToDay[first] as number;
      candidateColourToDay[first] = candidateColourToDay[second] as number;
      candidateColourToDay[second] = held;
    }

    const candidate = evaluateStreaks(
      scheduled,
      candidateFlips,
      candidateColourToDay,
      LEAGUE_POT_COUNT * LEAGUE_POT_SIZE,
    );

    if (
      isBetter(candidate, current) ||
      (equalScore(candidate, current) && random.nextInt(3) === 0)
    ) {
      flips = candidateFlips;
      colourToDay = candidateColourToDay;
      current = candidate;

      if (isBetter(current, bestScore)) {
        bestScore = current;
        bestFlips = [...flips];
        bestColourToDay = [...colourToDay];
      }
    }
  }

  return {
    state: { flips: bestFlips, colourToDay: bestColourToDay },
    score: bestScore,
  };
}

function buildFixtures(
  scheduled: readonly ScheduledEdge[],
  players: readonly string[],
  state: OrientationState,
): GeneratedFixture[] {
  const fixtures = scheduled.map((edge) => {
    const home = isHome(edge, state.flips);

    return {
      matchday: (state.colourToDay[edge.colour] as number) + 1,
      homeId: players[home ? edge.u : edge.v] as string,
      awayId: players[home ? edge.v : edge.u] as string,
    };
  });

  fixtures.sort(compareFixtures);
  return fixtures;
}

/**
 * Generates the complete 144-match league phase. Throws a typed
 * `FixtureGenerationError` rather than returning a partial or invalid schedule.
 */
export function generateLeaguePhase(
  input: GenerateLeaguePhaseInput,
  options: GenerateLeaguePhaseOptions = {},
): LeaguePhaseGeneration {
  if (typeof input.seed !== "string" || input.seed.trim().length === 0) {
    throw new FixtureGenerationError("invalid-seed", "Fixture generation needs a non-empty seed.");
  }

  const players = flattenPots(input.pots);
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? FIXTURE_MAX_ATTEMPTS));
  const nodeBudget = Math.max(
    0,
    Math.floor(options.colourNodeBudget ?? FIXTURE_COLOURING_NODE_BUDGET),
  );

  let colouringNodes = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attemptSeed = attempt === 1 ? input.seed : deriveSeed(input.seed, `attempt-${attempt}`);
    const { edges } = buildEdges(attemptSeed);

    const colouring = findEdgeColouring(
      edges.map(({ u, v }) => ({ u, v })),
      LEAGUE_POT_COUNT * LEAGUE_POT_SIZE,
      LEAGUE_MATCHDAY_COUNT,
      nodeBudget,
    );

    colouringNodes += colouring.nodes;

    if (!colouring.ok || !colouring.colours) {
      continue;
    }

    const scheduled: ScheduledEdge[] = edges.map((edge, index) => ({
      ...edge,
      colour: colouring.colours?.[index] as number,
    }));

    const reduced = reduceStreaks(scheduled, attemptSeed);
    const fixtures = buildFixtures(scheduled, players, reduced.state);
    const perMatchdayCounts = new Array<number>(LEAGUE_MATCHDAY_COUNT).fill(0);

    for (const fixture of fixtures) {
      perMatchdayCounts[fixture.matchday - 1] += 1;
    }

    if (fixtures.length !== LEAGUE_MATCH_COUNT) {
      // Defensive: an exact cover is supposed to produce exactly 144 edges.
      continue;
    }

    return {
      fixtures,
      seed: input.seed,
      attempts: attempt,
      report: {
        algorithmVersion: FIXTURE_ALGORITHM_VERSION,
        attemptSeed,
        attempts: attempt,
        colouringNodes,
        maxHomeAwayStreak: reduced.score.maxStreak,
        playersWithStreak3Plus: reduced.score.streak3Plus,
        perMatchdayCounts,
      },
    };
  }

  throw new FixtureGenerationError(
    "attempts-exhausted",
    `Could not colour the fixture graph after ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"}.`,
    maxAttempts,
  );
}
