// GCC - play-off and Round-of-16 draw construction.
//
// PURE TypeScript. The client never supplies a draw: a server-generated seed is
// replayed by this module and the result is validated independently before it
// is stored. Randomness only chooses within a pre-defined group, so the bracket
// path can never drift from the published definition.
import { createSeededRandom } from "../random";
import {
  KNOCKOUT_ROUND_TIE_COUNTS,
  PLAYOFF_GROUPS,
  PLAYOFF_GROUP_SEEDS,
  R16_BRACKET_ORDER,
  R16_OPPONENT_GROUP,
  type KnockoutLegs,
  type KnockoutPlayer,
  type KnockoutTie,
  type PlayoffGroup,
  type PlayoffWinner,
} from "./types";

export interface BuildPlayoffTiesInput {
  readonly standings: readonly KnockoutPlayer[];
  readonly seed: string;
  readonly legs?: KnockoutLegs;
}

export interface BuildRoundOf16TiesInput {
  readonly directQualifiers: readonly KnockoutPlayer[];
  readonly playoffWinners: readonly PlayoffWinner[];
  readonly seed: string;
  readonly legs?: KnockoutLegs;
}

function requireSeed(seed: string): void {
  if (typeof seed !== "string" || seed.trim().length === 0) {
    throw new Error("A knockout draw needs a non-empty seed.");
  }
}

function standingsByPosition(
  standings: readonly KnockoutPlayer[],
  label: string,
): Map<number, KnockoutPlayer> {
  const byPosition = new Map<number, KnockoutPlayer>();
  const seenPlayers = new Set<string>();

  for (const player of standings) {
    if (typeof player.playerId !== "string" || player.playerId.trim().length === 0) {
      throw new Error(`${label} contains an invalid player id.`);
    }

    if (!Number.isInteger(player.position) || player.position < 1 || player.position > 36) {
      throw new Error(`${label} contains an invalid league position.`);
    }

    if (byPosition.has(player.position)) {
      throw new Error(`${label} contains position ${player.position} more than once.`);
    }

    if (seenPlayers.has(player.playerId)) {
      throw new Error(`${label} contains player ${player.playerId} more than once.`);
    }

    seenPlayers.add(player.playerId);
    byPosition.set(player.position, player);
  }

  return byPosition;
}

function tie(input: {
  readonly tieId: string;
  readonly round: KnockoutTie["round"];
  readonly bracketSlot: number;
  readonly legs: KnockoutLegs;
  readonly first: KnockoutPlayer;
  readonly second: KnockoutPlayer;
  readonly group: PlayoffGroup | null;
  readonly sourceTieIds?: readonly string[];
}): KnockoutTie {
  const higher = input.first.position < input.second.position ? input.first : input.second;
  const lower = higher === input.first ? input.second : input.first;

  return {
    tieId: input.tieId,
    round: input.round,
    bracketSlot: input.bracketSlot,
    legs: input.legs,
    higherSeedUid: higher.playerId,
    lowerSeedUid: lower.playerId,
    higherSeedPosition: higher.position,
    lowerSeedPosition: lower.position,
    group: input.group,
    sourceTieIds: input.sourceTieIds ?? [],
    winnerUid: null,
    winnerPosition: null,
  };
}

/**
 * Builds the eight play-off ties. Each group pairs its two seeded players with
 * its two unseeded players; the unseeded order is the only random choice, so
 * every seeded/unseeded pairing within a group is equally likely.
 */
export function buildPlayoffTies(input: BuildPlayoffTiesInput): readonly KnockoutTie[] {
  requireSeed(input.seed);
  const byPosition = standingsByPosition(input.standings, "Play-off standings");
  const legs = input.legs ?? 2;

  if (legs !== 1 && legs !== 2) {
    throw new Error("A knockout tie must have one or two legs.");
  }

  const random = createSeededRandom(input.seed);
  const ties: KnockoutTie[] = [];

  for (const group of PLAYOFF_GROUPS) {
    const definition = PLAYOFF_GROUP_SEEDS[group];
    const seeded = definition.seeded.map((position) => {
      const player = byPosition.get(position);
      if (!player) {
        throw new Error(`Play-off group ${group} is missing league position ${position}.`);
      }
      return player;
    });
    const unseeded = definition.unseeded.map((position) => {
      const player = byPosition.get(position);
      if (!player) {
        throw new Error(`Play-off group ${group} is missing league position ${position}.`);
      }
      return player;
    });
    const shuffledUnseeded = random.shuffle(unseeded);

    for (let index = 0; index < 2; index += 1) {
      const seededPlayer = seeded[index];
      const unseededPlayer = shuffledUnseeded[index];

      if (!seededPlayer || !unseededPlayer) {
        throw new Error(`Play-off group ${group} could not be paired.`);
      }

      ties.push(
        tie({
          tieId: `playoff-${group.toLowerCase()}${index + 1}`,
          round: "playoff",
          bracketSlot: ties.length + 1,
          legs,
          first: seededPlayer,
          second: unseededPlayer,
          group,
        }),
      );
    }
  }

  if (ties.length !== KNOCKOUT_ROUND_TIE_COUNTS.playoff) {
    throw new Error("The play-off draw did not produce eight ties.");
  }

  return ties;
}

/**
 * Completes the Round of 16 from the eight direct qualifiers and eight play-off
 * winners. The direct seeds are placed in the fixed bracket order; within each
 * pair (1/2 vs group D, 3/4 vs group C, 5/6 vs group B, 7/8 vs group A) the two
 * winners are randomly assigned.
 */
export function buildRoundOf16Ties(input: BuildRoundOf16TiesInput): readonly KnockoutTie[] {
  requireSeed(input.seed);
  const legs = input.legs ?? 2;

  if (legs !== 1 && legs !== 2) {
    throw new Error("A knockout tie must have one or two legs.");
  }

  const direct = standingsByPosition(input.directQualifiers, "Direct qualifiers");
  const winnersByGroup = new Map<PlayoffGroup, PlayoffWinner[]>();

  for (const winner of input.playoffWinners) {
    if (!PLAYOFF_GROUPS.includes(winner.group)) {
      throw new Error(`Play-off winner ${winner.playerId} has an invalid group.`);
    }

    const list = winnersByGroup.get(winner.group) ?? [];
    list.push(winner);
    winnersByGroup.set(winner.group, list);
  }

  for (const group of PLAYOFF_GROUPS) {
    const winners = winnersByGroup.get(group) ?? [];
    if (winners.length !== 2) {
      throw new Error(`Play-off group ${group} must supply exactly two winners.`);
    }

    const seen = new Set<string>();
    for (const winner of winners) {
      if (seen.has(winner.playerId)) {
        throw new Error(`Play-off group ${group} contains a duplicate winner.`);
      }
      seen.add(winner.playerId);
    }
  }

  const directById = new Map<number, KnockoutPlayer>();

  for (let position = 1; position <= 8; position += 1) {
    const player = direct.get(position);
    if (!player) {
      throw new Error(`The Round of 16 is missing direct qualifier position ${position}.`);
    }
    directById.set(position, player);
  }

  const random = createSeededRandom(input.seed);
  const opponentBySeed = new Map<number, PlayoffWinner>();
  const seedPairs: ReadonlyArray<readonly [number, number]> = [
    [1, 2],
    [3, 4],
    [5, 6],
    [7, 8],
  ];

  for (const pair of seedPairs) {
    const group = R16_OPPONENT_GROUP[pair[0]];
    const winners = winnersByGroup.get(group) ?? [];
    const shuffled = random.shuffle(winners);

    pair.forEach((seed, index) => {
      const winner = shuffled[index];
      if (!winner) {
        throw new Error(`Round-of-16 seed ${seed} has no play-off winner.`);
      }
      opponentBySeed.set(seed, winner);
    });
  }

  const ties: KnockoutTie[] = R16_BRACKET_ORDER.map((seed, index) => {
    const directPlayer = directById.get(seed);
    const winner = opponentBySeed.get(seed);

    if (!directPlayer || !winner) {
      throw new Error(`Round-of-16 seed ${seed} could not be paired.`);
    }

    return tie({
      tieId: `r16-${index + 1}`,
      round: "r16",
      bracketSlot: index + 1,
      legs,
      first: directPlayer,
      second: {
        playerId: winner.playerId,
        position: winner.position,
        gamerTag: winner.gamerTag,
      },
      group: winner.group,
      sourceTieIds: [winner.tieId],
    });
  });

  if (ties.length !== KNOCKOUT_ROUND_TIE_COUNTS.r16) {
    throw new Error("The Round of 16 draw did not produce eight ties.");
  }

  return ties;
}
