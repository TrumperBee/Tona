// GCC - standard Elo for one game.
//
// Start at 1000, K = 32, expected score 1 / (1 + 10^((opponent - player)/400)).
// A win scores 1, a draw 0.5 and a loss 0. Goal margin is deliberately ignored,
// and a 3-0 walkover is just another win. Ratings are stored as whole numbers:
// each side is rounded independently, which keeps a match zero-sum once darts
// are ignored.

export const DEFAULT_ELO_RATING = 1000;
export const DEFAULT_ELO_K = 32;

export type EloScore = 0 | 0.5 | 1;

export interface ApplyEloInput {
  readonly rating: number;
  readonly opponentRating: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly kFactor?: number;
}

export interface ApplyEloResult {
  readonly rating: number;
  readonly delta: number;
  readonly score: EloScore;
}

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

function scoreFor(goalsFor: number, goalsAgainst: number): EloScore {
  if (goalsFor > goalsAgainst) return 1;
  if (goalsFor < goalsAgainst) return 0;
  return 0.5;
}

export function applyElo(input: ApplyEloInput): ApplyEloResult {
  const kFactor = input.kFactor ?? DEFAULT_ELO_K;
  const score = scoreFor(input.goalsFor, input.goalsAgainst);
  const expected = expectedScore(input.rating, input.opponentRating);
  const rawDelta = kFactor * (score - expected);
  const rating = Math.round(input.rating + rawDelta);

  return {
    rating,
    delta: rating - input.rating,
    score,
  };
}
