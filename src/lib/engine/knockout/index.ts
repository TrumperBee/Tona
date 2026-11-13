// GCC - public surface of the pure knockout engine.
//
// PURE TypeScript: no Firebase, no framework imports, no I/O. The bracket is
// deterministic for a recorded seed and validated independently of the
// generator that produced it.
export {
  DEFAULT_KNOCKOUT_CONFIG,
  KNOCKOUT_LEG_CHOICES,
  KNOCKOUT_ROUNDS,
  KNOCKOUT_ROUND_LABELS,
  KNOCKOUT_ROUND_SLUGS,
  KNOCKOUT_ROUND_TIE_COUNTS,
  KNOCKOUT_TIE_STATUSES,
  PLAYOFF_GROUPS,
  PLAYOFF_GROUP_SEEDS,
  R16_BRACKET_ORDER,
  R16_OPPONENT_GROUP,
  type KnockoutAggregate,
  type KnockoutConfig,
  type KnockoutDecidedBy,
  type KnockoutDecider,
  type KnockoutLegs,
  type KnockoutMatch,
  type KnockoutPlayer,
  type KnockoutRound,
  type KnockoutTie,
  type KnockoutTieStatus,
  type KnockoutValidation,
  type KnockoutValidationCode,
  type KnockoutValidationIssue,
  type PlayoffGroup,
  type PlayoffWinner,
  type TieResolution,
} from "./types";

export {
  buildPlayoffTies,
  buildRoundOf16Ties,
  type BuildPlayoffTiesInput,
  type BuildRoundOf16TiesInput,
} from "./playoffs";

export {
  applyDecider,
  awayUidForLeg,
  buildNextRound,
  homeUidForLeg,
  isPlayoffGroup,
  knockoutRoundAfter,
  nextRoundFor,
  resolveTie,
  roundOf16SeedOrder,
  validateKnockoutRound,
  validateProgression,
  winnerPosition,
} from "./bracket";
