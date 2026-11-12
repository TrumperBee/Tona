// GCC - public surface of the pure standings engine.
export { computeStandings } from "./calculate";
export {
  assignBands,
  bandForPosition,
  compareStandingRows,
  criterionValue,
  deriveLot,
  separatedByAbove,
  tiebreakCriteria,
} from "./tiebreakers";
export {
  CLASSIC_TIE_BREAK_CRITERIA,
  DEFAULT_TIEBREAKER_PROFILE,
  STANDING_BANDS,
  STANDING_BAND_LABELS,
  STANDING_BAND_LIMITS,
  TIEBREAKER_PROFILES,
  TIEBREAKER_PROFILE_DESCRIPTIONS,
  TIEBREAKER_PROFILE_LABELS,
  TIE_BREAK_CRITERIA,
  TIEBREAK_CRITERION_LABELS,
  type ComputeStandingsInput,
  type StandingBand,
  type StandingRow,
  type StandingRowBase,
  type StandingsForm,
  type StandingsMatch,
  type StandingsPlayer,
  type TiebreakCriterion,
  type TiebreakerProfile,
} from "./types";
