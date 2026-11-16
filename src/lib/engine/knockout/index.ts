// GCC - public surface of the pure knockout engine.
//
// PURE TypeScript: no Firebase, no framework imports, no I/O. The bracket is
// deterministic for a recorded seed and validated independently of the
// generator that produced it.
export {
  DEFAULT_KNOCKOUT_CONFIG,
  KNOCKOUT_LEG_CHOICES,
  KNOCKOUT_ALGORITHM_VERSION,
  KNOCKOUT_ROUNDS,
  KNOCKOUT_ROUND_LABELS,
  KNOCKOUT_ROUND_SLUGS,
  KNOCKOUT_ROUND_TIE_COUNTS,
  KNOCKOUT_TIE_STATUSES,
  PLAYOFF_GROUPS,
  PLAYOFF_GROUP_SEEDS,
  R16_BRACKET_ORDER,
  R16_OPPONENT_GROUP,
  type BracketSlot,
  type BracketTie,
  type BracketTieResult,
  type KnockoutAggregate,
  type KnockoutBracket,
  type KnockoutConfig,
  type KnockoutDecidedBy,
  type KnockoutDecider,
  type KnockoutLegs,
  type KnockoutMatch,
  type KnockoutPlayer,
  type KnockoutRound,
  type KnockoutSlot,
  type KnockoutTieStatus,
  type KnockoutValidation,
  type KnockoutValidationCode,
  type KnockoutValidationIssue,
  type PlayoffGroup,
  type ResolvableTie,
  type TieResolution,
} from "./types";

export {
  advanceBracket,
  applyDecider,
  awayUidForLeg,
  buildKnockoutBracket,
  dependentTieIds,
  homeUidForLeg,
  knockoutRoundAfter,
  resolveBracket,
  resolveTie,
  roundTies,
  validateBracket,
  type BuildKnockoutBracketInput,
} from "./bracket";
