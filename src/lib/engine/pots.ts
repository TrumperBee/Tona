// GCC - deterministic pot allocation and validation.
//
// PURE TypeScript: no Firebase, no framework imports, no I/O. Pots are plain:
// there are no country or association restrictions (ADR-009). Four pots hold
// exactly nine players each, and every registered player appears exactly once.
//
// A shuffle keeps explicitly locked players in their pot and fills the open
// slots with a seeded Fisher-Yates shuffle, so a draw can be replayed from its
// recorded seed. Validation is independent of generation: a stored draw is only
// confirmed after `validatePots` accepts it.
import { createSeededRandom } from "./random";

export const POT_NUMBERS = [1, 2, 3, 4] as const;
export type PotNumber = (typeof POT_NUMBERS)[number];

export const POT_KEYS = ["1", "2", "3", "4"] as const;
export type PotKey = (typeof POT_KEYS)[number];

export const POT_SIZE = 9;
export const POT_COUNT = 4;
export const POT_PLAYER_TOTAL = POT_SIZE * POT_COUNT;

export type Pots = Readonly<Record<PotKey, readonly string[]>>;

export type PotErrorCode =
  | "invalid-player-count"
  | "duplicate-player"
  | "invalid-seed"
  | "unknown-locked-player"
  | "invalid-locked-pot"
  | "pot-over-capacity"
  | "invalid-registered-players"
  | "duplicate-registered-player"
  | "invalid-pots"
  | "pot-size"
  | "unknown-player"
  | "missing-player";

/** A typed allocation failure. API routes map `message` straight to the user. */
export class PotAllocationError extends Error {
  readonly code: PotErrorCode;

  constructor(code: PotErrorCode, message: string) {
    super(message);
    this.name = "PotAllocationError";
    this.code = code;
  }
}

export interface ShuffleIntoPotsInput {
  readonly playerIds: readonly string[];
  /** UID to pot pin. Locked players never move in this shuffle. */
  readonly locked?: Readonly<Record<string, PotNumber>>;
  readonly seed: string;
}

export interface PotAllocation {
  readonly pots: Pots;
  /** Always empty after a successful allocation (kept for a uniform shape). */
  readonly unassigned: readonly string[];
}

function isPotNumber(value: unknown): value is PotNumber {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function emptyPotMap(): Record<PotKey, string[]> {
  return { "1": [], "2": [], "3": [], "4": [] };
}

/** Returns four empty pots, used when a draw is first opened for editing. */
export function createEmptyPots(): Pots {
  return emptyPotMap();
}

function assertUniquePlayerIds(playerIds: readonly string[]): void {
  if (playerIds.length !== POT_PLAYER_TOTAL) {
    throw new PotAllocationError(
      "invalid-player-count",
      `A draw needs exactly ${POT_PLAYER_TOTAL} players; received ${playerIds.length}.`,
    );
  }

  const seen = new Set<string>();

  for (const uid of playerIds) {
    if (typeof uid !== "string" || uid.length === 0) {
      throw new PotAllocationError(
        "invalid-player-count",
        "Every player in a draw needs a non-empty id.",
      );
    }

    if (seen.has(uid)) {
      throw new PotAllocationError("duplicate-player", "A player can only enter the draw once.");
    }

    seen.add(uid);
  }
}

/**
 * Shuffles unlocked players into the four pots while keeping every locked
 * player in their chosen pot. Every pot ends with exactly nine players.
 */
export function shuffleIntoPots({
  playerIds,
  locked = {},
  seed,
}: ShuffleIntoPotsInput): PotAllocation {
  assertUniquePlayerIds(playerIds);

  if (typeof seed !== "string" || seed.length === 0) {
    throw new PotAllocationError("invalid-seed", "A shuffle needs a non-empty server seed.");
  }

  const playerSet = new Set(playerIds);
  const pots = emptyPotMap();
  const lockedCounts: Record<PotKey, number> = { "1": 0, "2": 0, "3": 0, "4": 0 };

  for (const [uid, pot] of Object.entries(locked)) {
    if (!playerSet.has(uid)) {
      throw new PotAllocationError(
        "unknown-locked-player",
        "A locked player is not registered for this competition.",
      );
    }

    if (!isPotNumber(pot)) {
      throw new PotAllocationError(
        "invalid-locked-pot",
        "A locked player must be pinned to pot 1, 2, 3 or 4.",
      );
    }

    const key = String(pot) as PotKey;
    lockedCounts[key] += 1;

    if (lockedCounts[key] > POT_SIZE) {
      throw new PotAllocationError(
        "pot-over-capacity",
        `Pot ${pot} cannot hold more than ${POT_SIZE} players.`,
      );
    }

    pots[key].push(uid);
  }

  const unlocked = playerIds.filter((uid) => locked[uid] === undefined);
  const openSlots: PotKey[] = [];

  for (const key of POT_KEYS) {
    const open = POT_SIZE - pots[key].length;

    for (let index = 0; index < open; index += 1) {
      openSlots.push(key);
    }
  }

  const random = createSeededRandom(seed);
  const shuffledPlayers = random.shuffle(unlocked);

  // `openSlots` is already arranged so the shuffled players fill each pot's
  // remaining places. The shuffle decides which player takes which slot.
  shuffledPlayers.forEach((uid, index) => {
    const key = openSlots[index];

    if (key === undefined) {
      throw new PotAllocationError("pot-over-capacity", "The draw has more players than slots.");
    }

    pots[key].push(uid);
  });

  for (const key of POT_KEYS) {
    if (pots[key].length !== POT_SIZE) {
      throw new PotAllocationError("pot-size", `Pot ${key} must hold exactly ${POT_SIZE} players.`);
    }
  }

  return { pots, unassigned: [] };
}

export interface PotValidationIssue {
  readonly code: PotErrorCode;
  readonly message: string;
}

export interface PotsValidationResult {
  readonly valid: boolean;
  readonly issues: readonly PotValidationIssue[];
}

function readPot(value: Record<string, unknown>, key: PotKey): unknown {
  if (key in value) {
    return value[key];
  }

  // In-memory callers may build numeric keys; Firestore always stores strings.
  return value[String(Number(key))];
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}

/**
 * Validates a stored draw against the current registered field. Returns every
 * issue it can prove instead of throwing, so the organiser sees the exact
 * reason a confirmation is refused.
 *
 * Required invariants: exactly four pots, exactly nine players per pot, no
 * duplicates, only registered players and every registered player present.
 */
export function validatePots(
  pots: unknown,
  registeredIds: readonly string[],
): PotsValidationResult {
  const issues: PotValidationIssue[] = [];

  if (!Array.isArray(registeredIds) || registeredIds.some((uid) => typeof uid !== "string")) {
    return {
      valid: false,
      issues: [
        {
          code: "invalid-registered-players",
          message: "The registered field could not be read.",
        },
      ],
    };
  }

  const registered = new Set(registeredIds);

  if (registered.size !== registeredIds.length) {
    return {
      valid: false,
      issues: [
        {
          code: "duplicate-registered-player",
          message: "The registered field contains a duplicate player.",
        },
      ],
    };
  }

  if (registeredIds.length !== POT_PLAYER_TOTAL) {
    return {
      valid: false,
      issues: [
        {
          code: "invalid-registered-players",
          message: `The draw needs exactly ${POT_PLAYER_TOTAL} registered players; this competition has ${registeredIds.length}.`,
        },
      ],
    };
  }

  if (typeof pots !== "object" || pots === null || Array.isArray(pots)) {
    return {
      valid: false,
      issues: [{ code: "invalid-pots", message: "The draw is not stored in the expected shape." }],
    };
  }

  const record = pots as Record<string, unknown>;
  const knownKeys = new Set<string>([...POT_KEYS]);
  const extraKeys = Object.keys(record).filter((key) => !knownKeys.has(key));

  if (extraKeys.length > 0) {
    return {
      valid: false,
      issues: [{ code: "invalid-pots", message: "The draw has unexpected pot keys." }],
    };
  }

  const missingKeys = POT_KEYS.filter((key) => readPot(record, key) === undefined);

  if (missingKeys.length > 0) {
    return {
      valid: false,
      issues: [{ code: "invalid-pots", message: "The draw is missing one or more pots." }],
    };
  }

  const placed = new Set<string>();
  const duplicated = new Set<string>();
  const unknown = new Set<string>();

  for (const key of POT_KEYS) {
    const pot = readPot(record, key);

    if (!isStringArray(pot)) {
      issues.push({ code: "invalid-pots", message: `Pot ${key} is not a list of player ids.` });
      continue;
    }

    if (pot.length !== POT_SIZE) {
      issues.push({
        code: "pot-size",
        message: `Pot ${key} must hold exactly ${POT_SIZE} players; it holds ${pot.length}.`,
      });
    }

    for (const uid of pot) {
      if (placed.has(uid)) {
        duplicated.add(uid);
      }

      placed.add(uid);

      if (!registered.has(uid)) {
        unknown.add(uid);
      }
    }
  }

  if (duplicated.size > 0) {
    issues.push({
      code: "duplicate-player",
      message: "A player appears in more than one pot.",
    });
  }

  if (unknown.size > 0) {
    issues.push({
      code: "unknown-player",
      message: "The draw contains a player who is not registered for this competition.",
    });
  }

  const missing = registeredIds.filter((uid) => !placed.has(uid));

  if (missing.length > 0) {
    issues.push({
      code: "missing-player",
      message: `${missing.length} registered ${missing.length === 1 ? "player is" : "players are"} not assigned to a pot.`,
    });
  }

  return { valid: issues.length === 0, issues };
}
