// GCC - standings tie-break comparators.
//
// The profiles are applied as one sequential sort over the whole table, never
// as mini-leagues. Higher values sort first, except the lot which sorts
// ascending. A final participant-id comparison makes the order a strict total
// order even in the vanishingly unlikely event that two lots collide.
import { hashSeed } from "../random";
import {
  CLASSIC_TIE_BREAK_CRITERIA,
  STANDING_BAND_LIMITS,
  TIE_BREAK_CRITERIA,
  type StandingBand,
  type StandingRow,
  type StandingRowBase,
  type TiebreakCriterion,
  type TiebreakerProfile,
} from "./types";

/** The criteria a profile applies, in order. */
export function tiebreakCriteria(profile: TiebreakerProfile): readonly TiebreakCriterion[] {
  return profile === "classic" ? CLASSIC_TIE_BREAK_CRITERIA : TIE_BREAK_CRITERIA;
}

/** Numeric value of one criterion. Higher is better except lot. */
export function criterionValue(row: StandingRowBase, criterion: TiebreakCriterion): number {
  switch (criterion) {
    case "points":
      return row.points;
    case "goalDifference":
      return row.goalDifference;
    case "goalsFor":
      return row.goalsFor;
    case "awayGoals":
      return row.awayGoals;
    case "wins":
      return row.wins;
    case "awayWins":
      return row.awayWins;
    case "opponentPoints":
      return row.opponentPoints;
    case "opponentGoalDifference":
      return row.opponentGoalDifference;
    case "opponentGoalsFor":
      return row.opponentGoalsFor;
    case "lot":
      return row.lot;
  }
}

/**
 * Total order for a profile. Returns a negative number when `a` ranks above
 * `b`, a positive number when `b` ranks above `a`, and zero only for the same
 * participant. Input array order is never consulted.
 */
export function compareStandingRows(
  a: StandingRowBase,
  b: StandingRowBase,
  profile: TiebreakerProfile,
): number {
  for (const criterion of tiebreakCriteria(profile)) {
    // The lot is the only ascending criterion: a lower lot ranks higher.
    const difference =
      criterion === "lot"
        ? a.lot - b.lot
        : criterionValue(b, criterion) - criterionValue(a, criterion);

    if (difference !== 0) {
      return difference;
    }
  }

  // Safety net for identical lots: the participant id keeps the order strict.
  if (a.id < b.id) {
    return -1;
  }

  if (a.id > b.id) {
    return 1;
  }

  return 0;
}

/**
 * Returns the first profile criterion that separates a row from the row above
 * when the two have equal points. Returns null when the points differ (the
 * table is not separated by a tie-break) or when the two rows are identical.
 */
export function separatedByAbove(
  above: StandingRowBase,
  row: StandingRowBase,
  profile: TiebreakerProfile,
): TiebreakCriterion | null {
  if (above.points !== row.points) {
    return null;
  }

  for (const criterion of tiebreakCriteria(profile)) {
    if (criterion === "points") {
      continue;
    }

    if (criterionValue(above, criterion) !== criterionValue(row, criterion)) {
      return criterion;
    }
  }

  return null;
}

/** Applies the published qualification band for each 1-based position. */
export function assignBands(rows: readonly StandingRowBase[]): readonly StandingRow[] {
  return rows.map((row) => ({
    ...row,
    band: bandForPosition(row.position),
  }));
}

export function bandForPosition(position: number): StandingBand {
  if (position <= STANDING_BAND_LIMITS.direct) {
    return "direct";
  }

  if (position <= STANDING_BAND_LIMITS.playoff_seeded) {
    return "playoff_seeded";
  }

  if (position <= STANDING_BAND_LIMITS.playoff_unseeded) {
    return "playoff_unseeded";
  }

  return "eliminated";
}

/**
 * Deterministic 53-bit lot derived from `hash(tiebreakSeed + uid)`.
 *
 * The two cyrb128 words are combined into a safe integer so the whole 53-bit
 * space is used without ever exceeding `Number.MAX_SAFE_INTEGER`.
 */
export function deriveLot(tiebreakSeed: string, participantId: string): number {
  const [first = 0, second = 0] = hashSeed(`${tiebreakSeed}\u0000${participantId}`);

  return (first >>> 0) * 2 ** 21 + (second >>> 11);
}
