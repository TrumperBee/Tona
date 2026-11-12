// GCC — public surface of the pure competition engine.
// Only pure functions and types may be exported from this folder.
// Phase 9 exports seeded randomness and pot allocation; Phase 10 adds fixture
// generation and validation, then standings and knockout APIs.

export type {
  ConfirmedResult,
  EngineParticipant,
  Fixture,
  FixtureGenerationConstraints,
  MatchScore,
  ParticipantId,
  PotIndex,
  QualificationOutcome,
  StandingRow,
  ValidationIssue,
  ValidationResult,
} from "./types";

export { createSeededRandom, deriveSeed, hashSeed, type SeededRandom } from "./random";

export {
  createEmptyPots,
  POT_COUNT,
  POT_KEYS,
  POT_NUMBERS,
  POT_PLAYER_TOTAL,
  POT_SIZE,
  PotAllocationError,
  shuffleIntoPots,
  validatePots,
  type PotAllocation,
  type PotErrorCode,
  type PotKey,
  type PotNumber,
  type Pots,
  type PotValidationIssue,
  type PotsValidationResult,
  type ShuffleIntoPotsInput,
} from "./pots";
