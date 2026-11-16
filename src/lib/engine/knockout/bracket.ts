// GCC - the complete knockout bracket, slot resolution and independent validation.
//
// PURE TypeScript. The bracket is built once from the frozen league table: the
// play-off pairings and the Round-of-16 opponents are the only random choices,
// and both are replayed from the recorded seed. Later rounds are placeholders
// that name their source tie, so a correction can never silently rewrite the
// path. No away-goals rule is applied; a level tie needs an explicit decider.
import { createSeededRandom } from "../random";
import {
  KNOCKOUT_ROUNDS,
  KNOCKOUT_ROUND_TIE_COUNTS,
  PLAYOFF_GROUPS,
  PLAYOFF_GROUP_SEEDS,
  R16_BRACKET_ORDER,
  R16_OPPONENT_GROUP,
  type BracketSlot,
  type BracketTie,
  type BracketTieResult,
  type KnockoutAggregate,
  type KnockoutBracket,
  type KnockoutDecider,
  type KnockoutLegs,
  type KnockoutMatch,
  type KnockoutPlayer,
  type KnockoutRound,
  type KnockoutSlot,
  type KnockoutValidation,
  type KnockoutValidationIssue,
  type ResolvableTie,
  type TieResolution,
} from "./types";

const PLAYER_COUNT = 36;

function compareText(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function compareTies(a: BracketTie, b: BracketTie): number {
  const roundDelta = KNOCKOUT_ROUNDS.indexOf(a.round) - KNOCKOUT_ROUNDS.indexOf(b.round);

  if (roundDelta !== 0) {
    return roundDelta;
  }

  if (a.bracketSlot !== b.bracketSlot) {
    return a.bracketSlot - b.bracketSlot;
  }

  return compareText(a.tieId, b.tieId);
}

export function knockoutRoundAfter(round: KnockoutRound): KnockoutRound | null {
  const index = KNOCKOUT_ROUNDS.indexOf(round);
  return index >= 0 && index < KNOCKOUT_ROUNDS.length - 1
    ? (KNOCKOUT_ROUNDS[index + 1] ?? null)
    : null;
}

export function roundTies(bracket: KnockoutBracket, round: KnockoutRound): readonly BracketTie[] {
  return bracket.ties
    .filter((tie) => tie.round === round)
    .sort((a, b) => a.bracketSlot - b.bracketSlot);
}

function seedRef(seed: number): KnockoutSlot {
  return { type: "seed", seed };
}

function winnerRef(tieId: string): KnockoutSlot {
  return { type: "winnerOf", tieId };
}

function slot(ref: KnockoutSlot, player: KnockoutPlayer | null): BracketSlot {
  return { ref, player };
}

function ordered(
  first: KnockoutPlayer,
  second: KnockoutPlayer,
): { readonly higher: KnockoutPlayer; readonly lower: KnockoutPlayer } {
  return first.position < second.position
    ? { higher: first, lower: second }
    : { higher: second, lower: first };
}

function requireSeed(seed: string): void {
  if (typeof seed !== "string" || seed.trim().length === 0) {
    throw new Error("A knockout draw needs a non-empty seed.");
  }
}

function requireLegs(legs: number): asserts legs is KnockoutLegs {
  if (legs !== 1 && legs !== 2) {
    throw new Error("A knockout tie must have one or two legs.");
  }
}

function standingsByPosition(standings: readonly KnockoutPlayer[]): Map<number, KnockoutPlayer> {
  const byPosition = new Map<number, KnockoutPlayer>();
  const seenPlayers = new Set<string>();

  for (const player of standings) {
    if (typeof player.playerId !== "string" || player.playerId.trim().length === 0) {
      throw new Error("The knockout standings contain an invalid player id.");
    }

    if (
      !Number.isInteger(player.position) ||
      player.position < 1 ||
      player.position > PLAYER_COUNT
    ) {
      throw new Error("The knockout standings contain an invalid league position.");
    }

    if (byPosition.has(player.position)) {
      throw new Error(`The knockout standings contain position ${player.position} more than once.`);
    }

    if (seenPlayers.has(player.playerId)) {
      throw new Error(`The knockout standings contain player ${player.playerId} more than once.`);
    }

    seenPlayers.add(player.playerId);
    byPosition.set(player.position, player);
  }

  for (let position = 1; position <= PLAYER_COUNT; position += 1) {
    if (!byPosition.has(position)) {
      throw new Error(`The knockout standings are missing league position ${position}.`);
    }
  }

  return byPosition;
}

function requirePlayer(
  byPosition: Map<number, KnockoutPlayer>,
  position: number,
  label: string,
): KnockoutPlayer {
  const player = byPosition.get(position);

  if (!player) {
    throw new Error(`${label} is missing league position ${position}.`);
  }

  return player;
}

export interface BuildKnockoutBracketInput {
  readonly standings: readonly KnockoutPlayer[];
  readonly seed: string;
  readonly legs?: KnockoutLegs;
}

/**
 * Builds all 23 ties at once. Every random choice is made here:
 *
 * - within each play-off group, which unseeded player faces which seeded player;
 * - which of the two group winners meets which of the two direct seeds.
 *
 * Quarter-final, semi-final and final slots name the tie that feeds them.
 */
export function buildKnockoutBracket(input: BuildKnockoutBracketInput): KnockoutBracket {
  requireSeed(input.seed);
  const legs = input.legs ?? 2;
  requireLegs(legs);

  const byPosition = standingsByPosition(input.standings);
  const random = createSeededRandom(input.seed);
  const ties: BracketTie[] = [];

  // Play-offs: two seeded-vs-unseeded ties per group.
  for (const group of PLAYOFF_GROUPS) {
    const definition = PLAYOFF_GROUP_SEEDS[group];
    const seeded = definition.seeded.map((position) =>
      requirePlayer(byPosition, position, `Play-off group ${group}`),
    );
    const unseeded = random.shuffle(
      definition.unseeded.map((position) =>
        requirePlayer(byPosition, position, `Play-off group ${group}`),
      ),
    );

    for (let index = 0; index < 2; index += 1) {
      const seededPlayer = seeded[index];
      const unseededPlayer = unseeded[index];

      if (!seededPlayer || !unseededPlayer) {
        throw new Error(`Play-off group ${group} could not be paired.`);
      }

      const pair = ordered(seededPlayer, unseededPlayer);

      ties.push({
        tieId: `playoff-${group.toLowerCase()}${index + 1}`,
        round: "playoff",
        bracketSlot: ties.length + 1,
        legs,
        higher: slot(seedRef(seededPlayer.position), pair.higher),
        lower: slot(seedRef(unseededPlayer.position), pair.lower),
        group,
        winner: null,
      });
    }
  }

  const playoffTies = [...ties];

  // Round of 16: direct seeds against the group winners assigned to them.
  const seedPairs: ReadonlyArray<readonly [number, number]> = [
    [1, 2],
    [3, 4],
    [5, 6],
    [7, 8],
  ];
  const opponentBySeed = new Map<number, BracketTie>();

  for (const pair of seedPairs) {
    const group = R16_OPPONENT_GROUP[pair[0] as number];
    const groupTies = random.shuffle(playoffTies.filter((tie) => tie.group === group));

    if (groupTies.length !== 2) {
      throw new Error(`Play-off group ${group ?? "?"} does not contain two ties.`);
    }

    pair.forEach((seed, index) => {
      const source = groupTies[index];

      if (!source) {
        throw new Error(`Round-of-16 seed ${seed} has no play-off tie.`);
      }

      opponentBySeed.set(seed, source);
    });
  }

  R16_BRACKET_ORDER.forEach((seed, index) => {
    const direct = requirePlayer(byPosition, seed, "Round of 16");
    const source = opponentBySeed.get(seed);

    if (!source) {
      throw new Error(`Round-of-16 seed ${seed} has no play-off opponent.`);
    }

    ties.push({
      tieId: `r16-${index + 1}`,
      round: "r16",
      bracketSlot: index + 1,
      legs,
      higher: slot(seedRef(seed), direct),
      lower: slot(winnerRef(source.tieId), null),
      group: source.group,
      winner: null,
    });
  });

  // Later rounds are fixed adjacent-slot progressions.
  const rounds: ReadonlyArray<{
    readonly round: KnockoutRound;
    readonly previous: KnockoutRound;
    readonly count: number;
  }> = [
    { round: "qf", previous: "r16", count: KNOCKOUT_ROUND_TIE_COUNTS.qf },
    { round: "sf", previous: "qf", count: KNOCKOUT_ROUND_TIE_COUNTS.sf },
    { round: "final", previous: "sf", count: KNOCKOUT_ROUND_TIE_COUNTS.final },
  ];

  for (const entry of rounds) {
    for (let index = 0; index < entry.count; index += 1) {
      const first = `${entry.previous}-${index * 2 + 1}`;
      const second = `${entry.previous}-${index * 2 + 2}`;

      ties.push({
        tieId: `${entry.round}-${index + 1}`,
        round: entry.round,
        bracketSlot: index + 1,
        legs: entry.round === "final" ? 1 : legs,
        higher: slot(winnerRef(first), null),
        lower: slot(winnerRef(second), null),
        group: null,
        winner: null,
      });
    }
  }

  const bracket: KnockoutBracket = {
    seed: input.seed,
    legs,
    ties: ties.sort(compareTies),
  };
  const validation = validateBracket(bracket);

  if (!validation.valid) {
    throw new Error(
      `The generated bracket is invalid: ${validation.issues.map((issue) => issue.message).join(" ")}`,
    );
  }

  return bracket;
}

function playerForSlot(
  current: BracketSlot,
  winners: ReadonlyMap<string, KnockoutPlayer>,
): KnockoutPlayer | null {
  if (current.ref.type === "seed") {
    return current.player;
  }

  return winners.get(current.ref.tieId) ?? null;
}

function samePlayer(a: KnockoutPlayer | null, b: KnockoutPlayer | null): boolean {
  return (a?.playerId ?? null) === (b?.playerId ?? null);
}

/**
 * Recomputes every participant and every winner from the slots alone. A winner
 * that is no longer one of its tie's participants is cleared, so a changed
 * earlier result can never leak into a later round.
 */
export function resolveBracket(bracket: KnockoutBracket): KnockoutBracket {
  let current: BracketTie[] = bracket.ties.map((tie) => ({ ...tie }));

  for (let pass = 0; pass < KNOCKOUT_ROUNDS.length + 1; pass += 1) {
    let changed = false;
    const winners = new Map(
      current
        .filter((tie): tie is BracketTie & { winner: KnockoutPlayer } => tie.winner !== null)
        .map((tie) => [tie.tieId, tie.winner] as const),
    );
    const next: BracketTie[] = [];

    for (const round of KNOCKOUT_ROUNDS) {
      const roundEntries = current
        .filter((tie) => tie.round === round)
        .sort((a, b) => a.bracketSlot - b.bracketSlot);

      for (const tie of roundEntries) {
        const higherPlayer = playerForSlot(tie.higher, winners);
        const lowerPlayer = playerForSlot(tie.lower, winners);
        let winner = tie.winner;

        if (
          winner &&
          (!higherPlayer ||
            !lowerPlayer ||
            (winner.playerId !== higherPlayer.playerId && winner.playerId !== lowerPlayer.playerId))
        ) {
          winner = null;
        }

        if (
          !samePlayer(higherPlayer, tie.higher.player) ||
          !samePlayer(lowerPlayer, tie.lower.player) ||
          (winner?.playerId ?? null) !== (tie.winner?.playerId ?? null)
        ) {
          changed = true;
        }

        next.push({
          ...tie,
          higher: slot(tie.higher.ref, higherPlayer),
          lower: slot(tie.lower.ref, lowerPlayer),
          winner,
        });
      }
    }

    current = next.sort(compareTies);

    if (!changed) {
      break;
    }
  }

  return { ...bracket, ties: current };
}

/**
 * Applies one completed tie (or clears it) and resolves the whole bracket.
 * Applying a winner that is not one of the tie's two participants is refused.
 */
export function advanceBracket(
  bracket: KnockoutBracket,
  result: BracketTieResult,
): KnockoutBracket {
  const target = bracket.ties.find((tie) => tie.tieId === result.tieId);

  if (!target) {
    throw new Error(`Bracket tie ${result.tieId} does not exist.`);
  }

  if (result.winner) {
    const participants = [target.higher.player, target.lower.player].filter(
      (player): player is KnockoutPlayer => player !== null,
    );

    if (!participants.some((player) => player.playerId === result.winner?.playerId)) {
      throw new Error(`Tie ${result.tieId} has no participant ${result.winner.playerId}.`);
    }
  }

  const ties = bracket.ties.map((tie) =>
    tie.tieId === result.tieId ? { ...tie, winner: result.winner } : tie,
  );

  return resolveBracket({ ...bracket, ties });
}

/** Every tie that transitively depends on the winner of `tieId`. */
export function dependentTieIds(bracket: KnockoutBracket, tieId: string): ReadonlySet<string> {
  const dependents = new Set<string>();
  let frontier = [tieId];

  while (frontier.length > 0) {
    const next: string[] = [];

    for (const current of frontier) {
      for (const tie of bracket.ties) {
        if (dependents.has(tie.tieId)) {
          continue;
        }

        const refsSource =
          (tie.higher.ref.type === "winnerOf" && tie.higher.ref.tieId === current) ||
          (tie.lower.ref.type === "winnerOf" && tie.lower.ref.tieId === current);

        if (refsSource) {
          dependents.add(tie.tieId);
          next.push(tie.tieId);
        }
      }
    }

    frontier = next;
  }

  return dependents;
}

/** The home side of one leg under the published home-advantage rule. */
export function homeUidForLeg(tie: ResolvableTie, leg: number): string {
  if (leg < 1 || leg > tie.legs) {
    throw new Error(`Tie ${tie.tieId} has no leg ${leg}.`);
  }

  if (tie.legs === 1) {
    return tie.higherSeedUid;
  }

  return leg === 1 ? tie.lowerSeedUid : tie.higherSeedUid;
}

export function awayUidForLeg(tie: ResolvableTie, leg: number): string {
  return homeUidForLeg(tie, leg) === tie.higherSeedUid ? tie.lowerSeedUid : tie.higherSeedUid;
}

function emptyAggregate(): KnockoutAggregate {
  return { higherGoals: 0, lowerGoals: 0 };
}

/**
 * Resolves one two-legged (or single-legged) tie. No away-goals rule is
 * applied. A level aggregate after every leg returns `needs_decider`.
 */
export function resolveTie(tie: ResolvableTie, matches: readonly KnockoutMatch[]): TieResolution {
  if (tie.higherSeedUid.length === 0 || tie.lowerSeedUid.length === 0) {
    throw new Error(`Tie ${tie.tieId} has no participants.`);
  }

  const seenLegs = new Set<number>();
  let aggregate = emptyAggregate();
  let legsPlayed = 0;

  for (const match of matches) {
    if (!Number.isInteger(match.leg) || match.leg < 1 || match.leg > tie.legs) {
      throw new Error(`Tie ${tie.tieId} has an invalid leg number.`);
    }

    if (seenLegs.has(match.leg)) {
      throw new Error(`Tie ${tie.tieId} has more than one leg ${match.leg}.`);
    }

    seenLegs.add(match.leg);

    const expectedHome = homeUidForLeg(tie, match.leg);
    const expectedAway = awayUidForLeg(tie, match.leg);

    if (match.homeUid !== expectedHome || match.awayUid !== expectedAway) {
      throw new Error(`Tie ${tie.tieId} leg ${match.leg} has the wrong home or away player.`);
    }

    const hasHome = match.homeGoals !== null;
    const hasAway = match.awayGoals !== null;

    if (hasHome !== hasAway) {
      throw new Error(`Tie ${tie.tieId} leg ${match.leg} needs both scores or neither.`);
    }

    if (!hasHome || !hasAway) {
      continue;
    }

    for (const goals of [match.homeGoals, match.awayGoals]) {
      if (typeof goals !== "number" || !Number.isInteger(goals) || goals < 0) {
        throw new Error(`Tie ${tie.tieId} leg ${match.leg} has an invalid score.`);
      }
    }

    legsPlayed += 1;
    const homeGoals = match.homeGoals as number;
    const awayGoals = match.awayGoals as number;

    if (match.homeUid === tie.higherSeedUid) {
      aggregate = {
        higherGoals: aggregate.higherGoals + homeGoals,
        lowerGoals: aggregate.lowerGoals + awayGoals,
      };
    } else {
      aggregate = {
        higherGoals: aggregate.higherGoals + awayGoals,
        lowerGoals: aggregate.lowerGoals + homeGoals,
      };
    }
  }

  if (legsPlayed === 0) {
    return {
      status: "pending",
      aggregate,
      legsPlayed: 0,
      winnerUid: null,
      decidedBy: null,
    };
  }

  if (legsPlayed < tie.legs) {
    return {
      status: "in_progress",
      aggregate,
      legsPlayed,
      winnerUid: null,
      decidedBy: null,
    };
  }

  if (aggregate.higherGoals === aggregate.lowerGoals) {
    return {
      status: "needs_decider",
      aggregate,
      legsPlayed,
      winnerUid: null,
      decidedBy: null,
    };
  }

  return {
    status: "completed",
    aggregate,
    legsPlayed,
    winnerUid: aggregate.higherGoals > aggregate.lowerGoals ? tie.higherSeedUid : tie.lowerSeedUid,
    decidedBy: "aggregate",
  };
}

/**
 * Applies an organiser's decider to a level tie. The winner must be one of the
 * two participants; a penalty score, when supplied, must be consistent with the
 * chosen winner and must not be level.
 */
export function applyDecider(
  resolution: TieResolution,
  tie: Pick<ResolvableTie, "higherSeedUid" | "lowerSeedUid">,
  decider: KnockoutDecider,
): TieResolution {
  if (resolution.status !== "needs_decider") {
    throw new Error("A decider can only be recorded for a tie level on aggregate.");
  }

  if (decider.winnerUid !== tie.higherSeedUid && decider.winnerUid !== tie.lowerSeedUid) {
    throw new Error("The decider winner must be one of the two tied players.");
  }

  if (decider.method !== "extra_time" && decider.method !== "penalties") {
    throw new Error("A decider method must be extra time or penalties.");
  }

  if (decider.penalties) {
    const { higher, lower } = decider.penalties;

    if (!Number.isInteger(higher) || !Number.isInteger(lower) || higher < 0 || lower < 0) {
      throw new Error("A penalty score must be two non-negative whole numbers.");
    }

    if (higher === lower) {
      throw new Error("A penalty score cannot be level.");
    }

    const penaltyWinner = higher > lower ? tie.higherSeedUid : tie.lowerSeedUid;

    if (penaltyWinner !== decider.winnerUid) {
      throw new Error("The penalty score must agree with the chosen decider winner.");
    }
  }

  return {
    status: "completed",
    aggregate: resolution.aggregate,
    legsPlayed: resolution.legsPlayed,
    winnerUid: decider.winnerUid,
    decidedBy: decider.method,
  };
}

function invalid(code: KnockoutValidationIssue["code"], message: string, tieId?: string) {
  return tieId ? { code, message, tieId } : { code, message };
}

function isPlayerListed(tie: BracketTie, playerId: string): boolean {
  return tie.higher.player?.playerId === playerId || tie.lower.player?.playerId === playerId;
}

/**
 * Validates the complete bracket independently of the generator. It re-derives
 * the counts, the play-off group pairs, the Round-of-16 path, every slot
 * reference and every recorded participant from the tie list alone.
 */
export function validateBracket(bracket: KnockoutBracket): KnockoutValidation {
  const issues: KnockoutValidationIssue[] = [];
  const expectedTotal = KNOCKOUT_ROUNDS.reduce(
    (total, round) => total + KNOCKOUT_ROUND_TIE_COUNTS[round],
    0,
  );

  if (bracket.ties.length !== expectedTotal) {
    issues.push(invalid("tie-count-invalid", `The bracket needs exactly ${expectedTotal} ties.`));
  }

  const byId = new Map<string, BracketTie>();

  for (const tie of bracket.ties) {
    if (byId.has(tie.tieId)) {
      issues.push(invalid("tie-id-duplicate", `Tie id ${tie.tieId} appears twice.`, tie.tieId));
    }

    byId.set(tie.tieId, tie);
  }

  const roundOrder = new Map<KnockoutRound, number>(
    KNOCKOUT_ROUNDS.map((round, index) => [round, index] as const),
  );

  for (const round of KNOCKOUT_ROUNDS) {
    const ties = bracket.ties.filter((tie) => tie.round === round);
    const expectedCount = KNOCKOUT_ROUND_TIE_COUNTS[round];
    const seenSlots = new Set<number>();
    const seenPlayers = new Set<string>();

    if (ties.length !== expectedCount) {
      issues.push(
        invalid("tie-count-invalid", `The ${round} round needs exactly ${expectedCount} ties.`),
      );
    }

    for (const tie of ties) {
      if (
        !Number.isInteger(tie.bracketSlot) ||
        tie.bracketSlot < 1 ||
        tie.bracketSlot > expectedCount ||
        seenSlots.has(tie.bracketSlot)
      ) {
        issues.push(
          invalid(
            "bracket-slot-invalid",
            `Tie ${tie.tieId} has an invalid bracket slot.`,
            tie.tieId,
          ),
        );
      }
      seenSlots.add(tie.bracketSlot);

      if (tie.legs !== 1 && tie.legs !== 2) {
        issues.push(
          invalid("legs-invalid", `Tie ${tie.tieId} has an invalid leg count.`, tie.tieId),
        );
      }

      if (round === "final" && tie.legs !== 1) {
        issues.push(invalid("final-legs-invalid", "The final must be one match.", tie.tieId));
      }

      for (const current of [tie.higher, tie.lower]) {
        if (current.ref.type === "winnerOf") {
          const source = byId.get(current.ref.tieId);

          if (!source) {
            issues.push(
              invalid(
                "slot-reference-invalid",
                `Tie ${tie.tieId} references a tie that does not exist.`,
                tie.tieId,
              ),
            );
            continue;
          }

          const sourceRound = roundOrder.get(source.round) ?? Number.POSITIVE_INFINITY;

          if (sourceRound >= (roundOrder.get(round) ?? 0)) {
            issues.push(
              invalid(
                "slot-reference-invalid",
                `Tie ${tie.tieId} must be fed by an earlier round.`,
                tie.tieId,
              ),
            );
          }

          if (source.winner && current.player?.playerId !== source.winner.playerId) {
            issues.push(
              invalid(
                "slot-unresolved-invalid",
                `Tie ${tie.tieId} does not carry the current winner of ${source.tieId}.`,
                tie.tieId,
              ),
            );
          }

          if (!source.winner && current.player !== null) {
            issues.push(
              invalid(
                "slot-unresolved-invalid",
                `Tie ${tie.tieId} names a participant before ${source.tieId} is decided.`,
                tie.tieId,
              ),
            );
          }
        } else if (current.player === null) {
          issues.push(
            invalid(
              "slot-unresolved-invalid",
              `Tie ${tie.tieId} is missing its seed ${current.ref.seed} participant.`,
              tie.tieId,
            ),
          );
        } else if (current.player.position !== current.ref.seed) {
          issues.push(
            invalid(
              "rank-invalid",
              `Tie ${tie.tieId} seed ${current.ref.seed} has position ${current.player.position}.`,
              tie.tieId,
            ),
          );
        }
      }

      const higherPlayer = tie.higher.player;
      const lowerPlayer = tie.lower.player;

      if (
        tie.higher.ref.type === "seed" &&
        higherPlayer &&
        lowerPlayer &&
        (higherPlayer.position >= lowerPlayer.position ||
          higherPlayer.playerId === lowerPlayer.playerId)
      ) {
        issues.push(
          invalid(
            "rank-invalid",
            `Tie ${tie.tieId} must list the better league position as the higher seed.`,
            tie.tieId,
          ),
        );
      }

      if (tie.winner) {
        if (!higherPlayer || !lowerPlayer) {
          issues.push(
            invalid(
              "winner-invalid",
              `Tie ${tie.tieId} has a winner before both participants are known.`,
              tie.tieId,
            ),
          );
        } else if (!isPlayerListed(tie, tie.winner.playerId)) {
          issues.push(
            invalid("winner-invalid", `Tie ${tie.tieId} has a winner outside the tie.`, tie.tieId),
          );
        }
      }

      for (const player of [higherPlayer, lowerPlayer]) {
        if (!player) {
          continue;
        }

        if (seenPlayers.has(player.playerId)) {
          issues.push(
            invalid(
              "participant-duplicate",
              `Player ${player.playerId} appears more than once in the ${round}.`,
              tie.tieId,
            ),
          );
        }
        seenPlayers.add(player.playerId);
      }
    }

    for (let slotNumber = 1; slotNumber <= expectedCount; slotNumber += 1) {
      if (!seenSlots.has(slotNumber)) {
        issues.push(
          invalid("bracket-slot-invalid", `The ${round} bracket is missing slot ${slotNumber}.`),
        );
      }
    }
  }

  validatePlayoffs(
    issues,
    bracket.ties.filter((tie) => tie.round === "playoff"),
  );
  validateRoundOf16(issues, bracket);
  validateLaterRounds(issues, bracket);

  return { valid: issues.length === 0, issues };
}

function validatePlayoffs(issues: KnockoutValidationIssue[], ties: readonly BracketTie[]): void {
  const seenPositions = new Set<number>();
  const seenPlayers = new Set<string>();

  for (const tie of ties) {
    const group = tie.group;

    if (!group || !PLAYOFF_GROUPS.includes(group)) {
      issues.push(
        invalid(
          "playoff-group-invalid",
          `Tie ${tie.tieId} has no valid play-off group.`,
          tie.tieId,
        ),
      );
      continue;
    }

    const definition = PLAYOFF_GROUP_SEEDS[group];
    const positions = [tie.higher.player?.position ?? -1, tie.lower.player?.position ?? -1];
    const seeded = positions.filter((position) => definition.seeded.includes(position));
    const unseeded = positions.filter((position) => definition.unseeded.includes(position));

    if (seeded.length !== 1 || unseeded.length !== 1) {
      issues.push(
        invalid(
          "playoff-pair-invalid",
          `Tie ${tie.tieId} must pair one seeded and one unseeded player from group ${group}.`,
          tie.tieId,
        ),
      );
    }

    for (const player of [tie.higher.player, tie.lower.player]) {
      if (!player) {
        issues.push(
          invalid("participant-unknown", `Tie ${tie.tieId} is missing a participant.`, tie.tieId),
        );
        continue;
      }

      if (seenPositions.has(player.position)) {
        issues.push(
          invalid(
            "participant-duplicate",
            `League position ${player.position} appears in more than one play-off tie.`,
            tie.tieId,
          ),
        );
      }
      seenPositions.add(player.position);

      if (seenPlayers.has(player.playerId)) {
        issues.push(
          invalid(
            "participant-duplicate",
            `Player ${player.playerId} appears in more than one play-off tie.`,
            tie.tieId,
          ),
        );
      }
      seenPlayers.add(player.playerId);
    }
  }

  for (const group of PLAYOFF_GROUPS) {
    const definition = PLAYOFF_GROUP_SEEDS[group];
    const groupTies = ties.filter((tie) => tie.group === group);

    if (groupTies.length !== 2) {
      issues.push(
        invalid("playoff-group-invalid", `Play-off group ${group} must contain two ties.`),
      );
    }

    for (const position of [...definition.seeded, ...definition.unseeded]) {
      if (!seenPositions.has(position)) {
        issues.push(
          invalid(
            "participant-unknown",
            `Play-off position ${position} is missing from group ${group}.`,
          ),
        );
      }
    }
  }
}

function directSeedOf(tie: BracketTie): number | null {
  for (const current of [tie.higher, tie.lower]) {
    if (current.ref.type === "seed" && current.ref.seed >= 1 && current.ref.seed <= 8) {
      return current.ref.seed;
    }
  }

  return null;
}

function validateRoundOf16(issues: KnockoutValidationIssue[], bracket: KnockoutBracket): void {
  const ties = bracket.ties.filter((tie) => tie.round === "r16");
  const byId = new Map(bracket.ties.map((tie) => [tie.tieId, tie] as const));
  const seenSeeds = new Set<number>();
  const seenPlayers = new Set<string>();
  let seedOneSlot: number | null = null;
  let seedTwoSlot: number | null = null;

  for (const tie of ties) {
    const direct = directSeedOf(tie);

    if (direct === null) {
      issues.push(
        invalid(
          "r16-direct-seed-invalid",
          `Tie ${tie.tieId} must contain one direct qualifier seed 1-8.`,
          tie.tieId,
        ),
      );
      continue;
    }

    if (seenSeeds.has(direct)) {
      issues.push(
        invalid("r16-direct-seed-invalid", `Direct seed ${direct} appears twice.`, tie.tieId),
      );
    }
    seenSeeds.add(direct);

    if (direct === 1) {
      seedOneSlot = tie.bracketSlot;
    }

    if (direct === 2) {
      seedTwoSlot = tie.bracketSlot;
    }

    const directSlot =
      tie.higher.ref.type === "seed" && tie.higher.ref.seed === direct ? tie.higher : tie.lower;
    const opponentSlot = directSlot === tie.higher ? tie.lower : tie.higher;

    if (directSlot.player?.position !== direct) {
      issues.push(
        invalid(
          "r16-direct-seed-invalid",
          `Direct seed ${direct} does not carry its league position.`,
          tie.tieId,
        ),
      );
    }

    if (opponentSlot.ref.type !== "winnerOf") {
      issues.push(
        invalid("r16-opponent-invalid", `Tie ${tie.tieId} must face a play-off winner.`, tie.tieId),
      );
      continue;
    }

    const requiredGroup = R16_OPPONENT_GROUP[direct];
    const opponentTie = byId.get(opponentSlot.ref.tieId);
    const opponentGroup = opponentTie?.group ?? null;

    if (!requiredGroup || opponentGroup !== requiredGroup) {
      issues.push(
        invalid(
          "r16-group-invalid",
          `Direct seed ${direct} must face a group ${requiredGroup ?? "?"} winner.`,
          tie.tieId,
        ),
      );
    }

    for (const player of [tie.higher.player, tie.lower.player]) {
      if (!player) {
        continue;
      }

      if (seenPlayers.has(player.playerId)) {
        issues.push(
          invalid(
            "participant-duplicate",
            `Player ${player.playerId} appears more than once in the Round of 16.`,
            tie.tieId,
          ),
        );
      }
      seenPlayers.add(player.playerId);
    }
  }

  for (let seed = 1; seed <= 8; seed += 1) {
    if (!seenSeeds.has(seed)) {
      issues.push(invalid("r16-direct-seed-invalid", `Direct qualifier seed ${seed} is missing.`));
    }
  }

  if (seedOneSlot !== null && seedTwoSlot !== null && !(seedOneSlot <= 4 && seedTwoSlot >= 5)) {
    issues.push(
      invalid(
        "r16-direct-seed-invalid",
        "Seeds 1 and 2 must be placed on opposite halves of the bracket.",
      ),
    );
  }
}

function validateLaterRounds(issues: KnockoutValidationIssue[], bracket: KnockoutBracket): void {
  const byId = new Map(bracket.ties.map((tie) => [tie.tieId, tie] as const));

  for (const round of ["qf", "sf", "final"] as const) {
    const previous: KnockoutRound = round === "qf" ? "r16" : round === "sf" ? "qf" : "sf";

    for (const tie of bracket.ties.filter((entry) => entry.round === round)) {
      const index = tie.bracketSlot - 1;
      const expected = [`${previous}-${index * 2 + 1}`, `${previous}-${index * 2 + 2}`];

      for (const current of [tie.higher, tie.lower]) {
        if (current.ref.type !== "winnerOf") {
          issues.push(
            invalid(
              "slot-reference-invalid",
              `Tie ${tie.tieId} must be fed by two ${previous} winners.`,
              tie.tieId,
            ),
          );
          continue;
        }

        if (!expected.includes(current.ref.tieId) || !byId.has(current.ref.tieId)) {
          issues.push(
            invalid(
              "slot-reference-invalid",
              `Tie ${tie.tieId} is not fed by the adjacent ${previous} slots.`,
              tie.tieId,
            ),
          );
        }
      }
    }
  }
}
