// GCC - public surface of the pure fixture engine.
export {
  FIXTURE_ALGORITHM_VERSION,
  FIXTURE_COLOURING_NODE_BUDGET,
  FIXTURE_MAX_ATTEMPTS,
  FixtureGenerationError,
  LEAGUE_MATCHDAY_COUNT,
  LEAGUE_MATCHES_PER_MATCHDAY,
  LEAGUE_MATCH_COUNT,
  LEAGUE_PLAYER_COUNT,
  LEAGUE_POT_COUNT,
  LEAGUE_POT_SIZE,
  type FixtureErrorCode,
  type GenerateLeaguePhaseInput,
  type GenerateLeaguePhaseOptions,
  type GeneratedFixture,
  type LeaguePhaseGeneration,
  type LeaguePhaseReport,
} from "./types";

export { findEdgeColouring, type ColouringEdge, type EdgeColouringResult } from "./colouring";

export { generateLeaguePhase } from "./generate";

export {
  validateLeaguePhase,
  type FixtureValidationCode,
  type FixtureValidationIssue,
  type LeagueFixtureInput,
  type LeaguePhaseValidation,
  type LeaguePhaseValidationStats,
  type PlayerFixtureStats,
} from "./validate";
