// GCC - knockout bracket progression, tie resolution and independent validation.
//
// PURE TypeScript. No away-goals rule: a tie level on aggregate after all legs
// needs an explicit organiser decider. The validator re-derives every bracket
// rule from the tie list and never trusts the generator.
import {
  KNOCKOUT_ROUND_TIE_COUNTS,
  PLAYOFF_GROUPS,
  PLAYOFF_GROUP_SEEDS,
  R16_BRACKET_ORDER,
  R16_OPPONENT_GROUP,
  type KnockoutAggregate,
  type KnockoutDecider,
  type KnockoutLegs,
  type KnockoutMatch,
  type KnockoutRound,
  type KnockoutTie,
  type KnockoutValidation,
  type KnockoutValidationIssue,
  type PlayoffGroup,
  type TieResolution,
} from "./types";

function compareText(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function compareTies(a: KnockoutTie, b: KnockoutTie): number {
  if (a.bracketSlot !== b.bracketSlot) {
    return a.bracketSlot - b.bracketSlot;
  }

  return compareText(a.tieId, b.tieId);
}

export function knockoutRoundAfter(round: KnockoutRound): KnockoutRound | null {
  switch (round) {
    case "playoff":
      return "r16";
    case "r16":
      return "qf";
    case "qf":
      return "sf";
    case "sf":
      return "final";
    case "final":
      return null;
  }
}

export function nextRoundFor(previousTies: readonly KnockoutTie[]): KnockoutRound {
  const rounds = new Set(previousTies.map((tie) => tie.round));

  if (rounds.size !== 1) {
    throw new Error("Every previous-round tie must belong to the same round.");
  }

  const round = previousTies[0]?.round;

  if (!round || round === "playoff") {
    throw new Error("The Round of 16 is built from play-off winners, not buildNextRound.");
  }

  const next = knockoutRoundAfter(round);

  if (!next) {
    throw new Error("The final has no next round.");
  }

  return next;
}

export function winnerPosition(tie: KnockoutTie): number | null {
  if (!tie.winnerUid) {
    return null;
  }

  if (tie.winnerPosition !== null && tie.winnerPosition !== undefined) {
    return tie.winnerPosition;
  }

  if (tie.winnerUid === tie.higherSeedUid) {
    return tie.higherSeedPosition;
  }

  if (tie.winnerUid === tie.lowerSeedUid) {
    return tie.lowerSeedPosition;
  }

  return null;
}

/**
 * Builds the next deterministic round by pairing adjacent bracket slots. Every
 * previous tie must be completed; the higher-ranked winner (lower league
 * position) is the higher seed in the new tie.
 */
export function buildNextRound(
  previousTies: readonly KnockoutTie[],
  legs: KnockoutLegs = 2,
): readonly KnockoutTie[] {
  const round = nextRoundFor(previousTies);
  const effectiveLegs: KnockoutLegs = round === "final" ? 1 : legs;

  if (effectiveLegs !== 1 && effectiveLegs !== 2) {
    throw new Error("A knockout tie must have one or two legs.");
  }

  const sorted = [...previousTies].sort(compareTies);

  if (sorted.length !== KNOCKOUT_ROUND_TIE_COUNTS[sorted[0]?.round ?? "final"]) {
    throw new Error("The previous round is incomplete.");
  }

  sorted.forEach((tie, index) => {
    if (tie.bracketSlot !== index + 1) {
      throw new Error("Previous-round bracket slots must run from 1 without gaps.");
    }

    if (!tie.winnerUid) {
      throw new Error(`Tie ${tie.tieId} has no winner yet.`);
    }
  });

  const ties: KnockoutTie[] = [];

  for (let index = 0; index < sorted.length; index += 2) {
    const first = sorted[index];
    const second = sorted[index + 1];

    if (!first || !second) {
      throw new Error("A knockout round needs an even number of completed ties.");
    }

    const firstPosition = winnerPosition(first);
    const secondPosition = winnerPosition(second);

    if (!firstPosition || !secondPosition || !first.winnerUid || !second.winnerUid) {
      throw new Error("A previous-round winner has no league position.");
    }

    const firstPlayer = {
      playerId: first.winnerUid,
      position: firstPosition,
    };
    const secondPlayer = {
      playerId: second.winnerUid,
      position: secondPosition,
    };
    const higher = firstPosition < secondPosition ? firstPlayer : secondPlayer;
    const lower = higher === firstPlayer ? secondPlayer : firstPlayer;

    ties.push({
      tieId: `${round}-${index / 2 + 1}`,
      round,
      bracketSlot: index / 2 + 1,
      legs: effectiveLegs,
      higherSeedUid: higher.playerId,
      lowerSeedUid: lower.playerId,
      higherSeedPosition: higher.position,
      lowerSeedPosition: lower.position,
      group: null,
      sourceTieIds: [first.tieId, second.tieId],
      winnerUid: null,
      winnerPosition: null,
    });
  }

  return ties;
}

/** The home side of one leg under the published home-advantage rule. */
export function homeUidForLeg(tie: KnockoutTie, leg: number): string {
  if (leg < 1 || leg > tie.legs) {
    throw new Error(`Tie ${tie.tieId} has no leg ${leg}.`);
  }

  if (tie.legs === 1) {
    return tie.higherSeedUid;
  }

  return leg === 1 ? tie.lowerSeedUid : tie.higherSeedUid;
}

export function awayUidForLeg(tie: KnockoutTie, leg: number): string {
  return homeUidForLeg(tie, leg) === tie.higherSeedUid ? tie.lowerSeedUid : tie.higherSeedUid;
}

function emptyAggregate(): KnockoutAggregate {
  return { higherGoals: 0, lowerGoals: 0 };
}

/**
 * Resolves one two-legged (or single-legged) tie. No away-goals rule is
 * applied. A level aggregate after every leg returns `needs_decider`.
 */
export function resolveTie(
  tie: Pick<KnockoutTie, "tieId" | "legs" | "higherSeedUid" | "lowerSeedUid">,
  matches: readonly KnockoutMatch[],
): TieResolution {
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

    const expectedHome = homeUidForLeg(tie as KnockoutTie, match.leg);
    const expectedAway = awayUidForLeg(tie as KnockoutTie, match.leg);

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
  tie: Pick<KnockoutTie, "higherSeedUid" | "lowerSeedUid">,
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

/**
 * Validates one generated or stored round against the published bracket
 * definition. It checks counts, slots, unique participants, ranking and the
 * play-off/group path rules. Progression is checked separately.
 */
export function validateKnockoutRound(input: {
  readonly round: KnockoutRound;
  readonly ties: readonly KnockoutTie[];
}): KnockoutValidation {
  const issues: KnockoutValidationIssue[] = [];
  const expectedCount = KNOCKOUT_ROUND_TIE_COUNTS[input.round];

  if (input.ties.length !== expectedCount) {
    issues.push(
      invalid("tie-count-invalid", `The ${input.round} round needs exactly ${expectedCount} ties.`),
    );
  }

  const seenTieIds = new Set<string>();
  const seenSlots = new Set<number>();
  const seenPlayers = new Map<string, string>();

  for (const tie of input.ties) {
    if (tie.round !== input.round) {
      issues.push(
        invalid("tie-count-invalid", `Tie ${tie.tieId} belongs to another round.`, tie.tieId),
      );
    }

    if (seenTieIds.has(tie.tieId)) {
      issues.push(invalid("tie-id-duplicate", `Tie id ${tie.tieId} appears twice.`, tie.tieId));
    }
    seenTieIds.add(tie.tieId);

    if (
      !Number.isInteger(tie.bracketSlot) ||
      tie.bracketSlot < 1 ||
      tie.bracketSlot > expectedCount ||
      seenSlots.has(tie.bracketSlot)
    ) {
      issues.push(
        invalid("bracket-slot-invalid", `Tie ${tie.tieId} has an invalid bracket slot.`, tie.tieId),
      );
    }
    seenSlots.add(tie.bracketSlot);

    if (tie.legs !== 1 && tie.legs !== 2) {
      issues.push(invalid("legs-invalid", `Tie ${tie.tieId} has an invalid leg count.`, tie.tieId));
    }

    if (input.round === "final" && tie.legs !== 1) {
      issues.push(invalid("final-legs-invalid", "The final must be one match.", tie.tieId));
    }

    if (tie.higherSeedUid === tie.lowerSeedUid) {
      issues.push(
        invalid("self-tie", `Tie ${tie.tieId} pairs a player with themselves.`, tie.tieId),
      );
    }

    if (
      !Number.isInteger(tie.higherSeedPosition) ||
      !Number.isInteger(tie.lowerSeedPosition) ||
      tie.higherSeedPosition >= tie.lowerSeedPosition
    ) {
      issues.push(
        invalid(
          "rank-invalid",
          `Tie ${tie.tieId} must list the better league position as the higher seed.`,
          tie.tieId,
        ),
      );
    }

    for (const playerId of [tie.higherSeedUid, tie.lowerSeedUid]) {
      const existing = seenPlayers.get(playerId);
      if (existing) {
        issues.push(
          invalid(
            "participant-duplicate",
            `Player ${playerId} appears in both ${existing} and ${tie.tieId}.`,
            tie.tieId,
          ),
        );
      }
      seenPlayers.set(playerId, tie.tieId);
    }
  }

  for (let slot = 1; slot <= expectedCount; slot += 1) {
    if (!seenSlots.has(slot)) {
      issues.push(
        invalid("bracket-slot-invalid", `The ${input.round} bracket is missing slot ${slot}.`),
      );
    }
  }

  if (input.round === "playoff") {
    validatePlayoff(issues, input.ties);
  } else if (input.round === "r16") {
    validateRoundOf16(issues, input.ties);
  }

  return { valid: issues.length === 0, issues };
}

function validatePlayoff(issues: KnockoutValidationIssue[], ties: readonly KnockoutTie[]): void {
  const styleIssues: KnockoutValidationIssue[] = [];
  const seenPositions = new Set<number>();

  for (const tie of ties) {
    const group = tie.group;

    if (!group || !PLAYOFF_GROUPS.includes(group)) {
      styleIssues.push(
        invalid(
          "playoff-group-invalid",
          `Tie ${tie.tieId} has no valid play-off group.`,
          tie.tieId,
        ),
      );
      continue;
    }

    const definition = PLAYOFF_GROUP_SEEDS[group];
    const positions = [tie.higherSeedPosition, tie.lowerSeedPosition];
    const seeded = positions.filter((position) => definition.seeded.includes(position));
    const unseeded = positions.filter((position) => definition.unseeded.includes(position));

    if (seeded.length !== 1 || unseeded.length !== 1) {
      styleIssues.push(
        invalid(
          "playoff-pair-invalid",
          `Tie ${tie.tieId} must pair one seeded and one unseeded player from group ${group}.`,
          tie.tieId,
        ),
      );
    }

    for (const position of positions) {
      if (seenPositions.has(position)) {
        styleIssues.push(
          invalid(
            "participant-duplicate",
            `League position ${position} appears in more than one play-off tie.`,
            tie.tieId,
          ),
        );
      }
      seenPositions.add(position);
    }
  }

  for (const group of PLAYOFF_GROUPS) {
    const definition = PLAYOFF_GROUP_SEEDS[group];
    const groupTies = ties.filter((tie) => tie.group === group);

    if (groupTies.length !== 2) {
      styleIssues.push(
        invalid("playoff-group-invalid", `Play-off group ${group} must contain two ties.`),
      );
    }

    for (const position of [...definition.seeded, ...definition.unseeded]) {
      if (!seenPositions.has(position)) {
        styleIssues.push(
          invalid(
            "participant-unknown",
            `Play-off position ${position} is missing from group ${group}.`,
          ),
        );
      }
    }
  }

  issues.push(...styleIssues);
}

function validateRoundOf16(issues: KnockoutValidationIssue[], ties: readonly KnockoutTie[]): void {
  const styleIssues: KnockoutValidationIssue[] = [];
  const directPositions = new Set<number>();
  const opponentPositions = new Set<number>();

  for (const tie of ties) {
    const positions = [tie.higherSeedPosition, tie.lowerSeedPosition];
    const direct = positions.find((position) => position >= 1 && position <= 8);
    const opponent = positions.find((position) => position >= 9 && position <= 24);

    if (direct === undefined || opponent === undefined) {
      styleIssues.push(
        invalid(
          "r16-opponent-invalid",
          `Tie ${tie.tieId} must pair one direct qualifier with one play-off winner.`,
          tie.tieId,
        ),
      );
      continue;
    }

    if (directPositions.has(direct)) {
      styleIssues.push(
        invalid("r16-direct-seed-invalid", `Direct seed ${direct} appears twice.`, tie.tieId),
      );
    }
    directPositions.add(direct);

    if (opponentPositions.has(opponent)) {
      styleIssues.push(
        invalid("r16-opponent-invalid", `Play-off winner ${opponent} appears twice.`, tie.tieId),
      );
    }
    opponentPositions.add(opponent);

    const requiredGroup = R16_OPPONENT_GROUP[direct];

    if (!requiredGroup || tie.group !== requiredGroup) {
      styleIssues.push(
        invalid(
          "r16-group-invalid",
          `Direct seed ${direct} must face a group ${requiredGroup ?? "?"} winner.`,
          tie.tieId,
        ),
      );
    }
  }

  for (let seed = 1; seed <= 8; seed += 1) {
    if (!directPositions.has(seed)) {
      styleIssues.push(
        invalid("r16-direct-seed-invalid", `Direct qualifier seed ${seed} is missing.`),
      );
    }
  }

  // Seeds 1 and 2 must sit on opposite halves of the bracket.
  const seedOne = ties.find((tie) => [tie.higherSeedPosition, tie.lowerSeedPosition].includes(1));
  const seedTwo = ties.find((tie) => [tie.higherSeedPosition, tie.lowerSeedPosition].includes(2));

  if (seedOne && seedTwo && !(seedOne.bracketSlot <= 4 && seedTwo.bracketSlot >= 5)) {
    styleIssues.push(
      invalid(
        "r16-direct-seed-invalid",
        "Seeds 1 and 2 must be placed on opposite halves of the bracket.",
        seedTwo.tieId,
      ),
    );
  }

  if (new Set(ties.map((tie) => tie.group)).size !== 4) {
    styleIssues.push(
      invalid(
        "r16-group-invalid",
        "The Round of 16 must use winners from all four play-off groups.",
      ),
    );
  }

  issues.push(...styleIssues);
}

/**
 * Validates that `nextTies` is exactly the bracket progression of a completed
 * `previousTies` round: adjacent slots feed one next tie and only the winners
 * advance.
 */
export function validateProgression(
  previousTies: readonly KnockoutTie[],
  nextTies: readonly KnockoutTie[],
): KnockoutValidation {
  const issues: KnockoutValidationIssue[] = [];
  const sorted = [...previousTies].sort(compareTies);
  const expected = Math.floor(sorted.length / 2);

  if (nextTies.length !== expected) {
    issues.push(invalid("progression-count-invalid", `Expected ${expected} next-round ties.`));
  }

  for (let index = 0; index < sorted.length; index += 2) {
    const first = sorted[index];
    const second = sorted[index + 1];
    const next = [...nextTies].sort(compareTies)[index / 2];

    if (!first || !second) {
      issues.push(invalid("progression-source-invalid", "A previous-round pair is incomplete."));
      continue;
    }

    if (!first.winnerUid || !second.winnerUid) {
      issues.push(
        invalid(
          "progression-winner-invalid",
          `Ties ${first.tieId} and ${second.tieId} must both have winners.`,
        ),
      );
      continue;
    }

    if (!next) {
      continue;
    }

    const sources = [...next.sourceTieIds].sort(compareText);
    const expectedSources = [first.tieId, second.tieId].sort(compareText);

    if (sources.join("\u0000") !== expectedSources.join("\u0000")) {
      issues.push(
        invalid(
          "progression-source-invalid",
          `Tie ${next.tieId} does not come from the adjacent bracket slots.`,
          next.tieId,
        ),
      );
    }

    const participants = [next.higherSeedUid, next.lowerSeedUid].sort(compareText);
    const winners = [first.winnerUid, second.winnerUid].sort(compareText);

    if (participants.join("\u0000") !== winners.join("\u0000")) {
      issues.push(
        invalid(
          "progression-winner-invalid",
          `Tie ${next.tieId} must contain the two previous winners.`,
          next.tieId,
        ),
      );
    }
  }

  return { valid: issues.length === 0, issues };
}

/** A small helper used by the UI and server: both halves of the R16 path. */
export function roundOf16SeedOrder(): readonly number[] {
  return [...R16_BRACKET_ORDER];
}

/** Type guard used when reading stored group values. */
export function isPlayoffGroup(value: unknown): value is PlayoffGroup {
  return typeof value === "string" && (PLAYOFF_GROUPS as readonly string[]).includes(value);
}
