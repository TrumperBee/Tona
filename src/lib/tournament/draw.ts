// GCC - the pot draw: shuffle, manual moves, locks, confirmation and replacement.
//
// Every mutation re-reads the tournament, the draw and the registered field in
// ONE Firestore transaction before writing anything. The client never supplies
// a seed or a pot list that is trusted: the shuffle seed is generated with
// `crypto.randomBytes`, the allocation comes from the pure seeded engine, and a
// confirmation re-validates the stored pots against the registered field.
//
// Registration data is read-only here. The only exception is a post-confirmation
// `replace`, which runs the same removal/entry rules as Phase 8 so the field
// stays at exactly 36 players in exactly four pots of nine.
import "server-only";

import { randomBytes } from "node:crypto";

import { FieldValue, Timestamp, type QuerySnapshot } from "firebase-admin/firestore";

import { writeAuditLog } from "@/lib/audit/log";
import { requireTournamentOwnerOrSuperAdmin } from "@/lib/auth/guards";
import { createNotifications } from "@/lib/notifications";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import {
  POT_KEYS,
  POT_PLAYER_TOTAL,
  PotAllocationError,
  shuffleIntoPots,
  validatePots,
} from "@/lib/engine";
import { loadPlayerSnapshot, type PlayerEntrySnapshot } from "@/lib/tournament/registrations";
import { TournamentMutationError } from "@/lib/tournament/errors";
import {
  DRAW_ALGORITHM_VERSION,
  type DrawMethod,
  type DrawPlayerSnapshot,
  type DrawStatus,
  type PotNumber,
  type TournamentDocument,
} from "@/types/domain";

/**
 * Server-side draw shape. Timestamps are Admin SDK values; the public domain
 * type uses the structurally similar client Timestamp, so boundary reads are
 * cast once and every internal write stays typed.
 */
interface StoredDraw {
  readonly status: DrawStatus;
  readonly pots: Record<PotNumber, string[]>;
  readonly unassigned: string[];
  readonly method: DrawMethod;
  readonly shuffleSeed: string | null;
  readonly algorithmVersion: number;
  readonly locks: Record<string, PotNumber>;
  readonly playersSnapshot: Record<string, DrawPlayerSnapshot>;
  readonly tiebreakSeed: string | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly confirmedAt: Timestamp | null;
  readonly confirmedBy: string | null;
}

const SEED_BYTES = 32;

/** One registered player as the draw reads them. */
export interface DrawPlayer extends DrawPlayerSnapshot {
  readonly uid: string;
  readonly platform: string;
}

/** The organiser page view: real draw plus the live registered field. */
export interface OrganiserDrawView {
  readonly tournament: TournamentDocument;
  readonly draw: StoredDraw | null;
  readonly registeredIds: readonly string[];
  readonly players: Readonly<Record<string, DrawPlayerSnapshot>>;
}

function emptyPots(): Record<PotNumber, string[]> {
  return { "1": [], "2": [], "3": [], "4": [] };
}

function newSeed(): string {
  return randomBytes(SEED_BYTES).toString("hex");
}

function isDrawStatus(value: unknown): value is StoredDraw["status"] {
  return value === "draft" || value === "confirmed";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? [...value] : [];
}

function readPots(value: unknown): Record<PotNumber, string[]> {
  const pots = emptyPots();

  if (typeof value !== "object" || value === null) {
    return pots;
  }

  const record = value as Record<string, unknown>;

  for (const key of POT_KEYS) {
    pots[key] = readStringArray(record[key]);
  }

  return pots;
}

function readSnapshotMap(value: unknown): Record<string, DrawPlayerSnapshot> {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const result: Record<string, DrawPlayerSnapshot> = {};

  for (const [uid, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const data = entry as Record<string, unknown>;

    if (typeof data.gamerTag !== "string") {
      continue;
    }

    result[uid] = {
      gamerTag: data.gamerTag,
      avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
      country: typeof data.country === "string" ? data.country : "",
    };
  }

  return result;
}

function readLocks(value: unknown): Record<string, PotNumber> {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const result: Record<string, PotNumber> = {};

  for (const [uid, raw] of Object.entries(value as Record<string, unknown>)) {
    const key = String(raw);

    if (key === "1" || key === "2" || key === "3" || key === "4") {
      result[uid] = key as PotNumber;
    }
  }

  return result;
}

/** Normalises a stored draw document, tolerating a partially written record. */
function readDraw(data: Record<string, unknown> | undefined): StoredDraw | null {
  if (!data || !isDrawStatus(data.status)) {
    return null;
  }

  return {
    status: data.status,
    pots: readPots(data.pots),
    unassigned: readStringArray(data.unassigned),
    method:
      data.method === "shuffle" || data.method === "manual" || data.method === "mixed"
        ? data.method
        : "manual",
    shuffleSeed: typeof data.shuffleSeed === "string" ? data.shuffleSeed : null,
    algorithmVersion:
      typeof data.algorithmVersion === "number" ? data.algorithmVersion : DRAW_ALGORITHM_VERSION,
    locks: readLocks(data.locks),
    playersSnapshot: readSnapshotMap(data.playersSnapshot),
    tiebreakSeed: typeof data.tiebreakSeed === "string" ? data.tiebreakSeed : null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : Timestamp.now(),
    confirmedAt: data.confirmedAt instanceof Timestamp ? data.confirmedAt : null,
    confirmedBy: typeof data.confirmedBy === "string" ? data.confirmedBy : null,
  };
}

function readRegisteredPlayers(snapshot: QuerySnapshot): DrawPlayer[] {
  const players: DrawPlayer[] = [];

  for (const document of snapshot.docs) {
    const data = document.data();

    if (data.status !== "registered" || typeof data.gamerTag !== "string") {
      continue;
    }

    players.push({
      uid: document.id,
      gamerTag: data.gamerTag,
      avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
      country: typeof data.country === "string" ? data.country : "",
      platform: typeof data.platform === "string" ? data.platform : "",
    });
  }

  return players;
}

function snapshotMap(players: readonly DrawPlayer[]): Record<string, DrawPlayerSnapshot> {
  const result: Record<string, DrawPlayerSnapshot> = {};

  for (const player of players) {
    result[player.uid] = {
      gamerTag: player.gamerTag,
      avatarUrl: player.avatarUrl,
      country: player.country,
    };
  }

  return result;
}

function requireFullField(players: readonly DrawPlayer[]): void {
  if (players.length !== POT_PLAYER_TOTAL) {
    throw new TournamentMutationError(
      `The draw needs exactly ${POT_PLAYER_TOTAL} registered players; this competition has ${players.length}.`,
      409,
    );
  }
}

function assertDrawStage(tournament: TournamentDocument): void {
  if (tournament.status !== "registration_closed") {
    if (tournament.status === "pots_confirmed") {
      throw new TournamentMutationError(
        "The draw is confirmed. Undo the confirmation before editing it.",
        409,
      );
    }

    if (tournament.status === "registration_open") {
      throw new TournamentMutationError("Close registration before preparing the draw.", 409);
    }

    throw new TournamentMutationError("The draw can no longer be edited at this stage.", 409);
  }
}

function assertNotConfirmed(draw: StoredDraw | null): void {
  if (draw?.status === "confirmed") {
    throw new TournamentMutationError(
      "The draw is confirmed. Undo the confirmation before editing it.",
      409,
    );
  }
}

function baseDraw(players: readonly DrawPlayer[]): StoredDraw {
  const now = Timestamp.now();

  return {
    status: "draft",
    pots: emptyPots(),
    unassigned: players.map((player) => player.uid),
    method: "manual",
    shuffleSeed: null,
    algorithmVersion: DRAW_ALGORITHM_VERSION,
    locks: {},
    playersSnapshot: snapshotMap(players),
    tiebreakSeed: null,
    createdAt: now,
    updatedAt: now,
    confirmedAt: null,
    confirmedBy: null,
  };
}

function drawWrite(draw: StoredDraw): Record<string, unknown> {
  return { ...draw };
}

function findPot(draw: StoredDraw, uid: string): PotNumber | null {
  for (const key of POT_KEYS) {
    if (draw.pots[key].includes(uid)) {
      return key;
    }
  }

  return null;
}

function registeredIds(players: readonly DrawPlayer[]): string[] {
  return players.map((player) => player.uid);
}

function assertRegistered(players: readonly DrawPlayer[], uid: string): DrawPlayer {
  const player = players.find((entry) => entry.uid === uid);

  if (!player) {
    throw new TournamentMutationError("That player is not registered for this competition.", 409);
  }

  return player;
}

function methodAfterEdit(draw: StoredDraw): DrawMethod {
  if (draw.shuffleSeed !== null) {
    return "mixed";
  }

  return "manual";
}

/** Reads the guarded organiser view without mutating anything. */
export async function getOrganiserDraw(tournamentId: string): Promise<OrganiserDrawView> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();

  const [drawSnapshot, registrationsSnapshot] = await Promise.all([
    firestore.doc(paths.tournamentDrawCurrent(tournamentId)).get(),
    firestore
      .collection(paths.tournamentRegistrations(tournamentId))
      .where("status", "==", "registered")
      .get(),
  ]);

  const players = readRegisteredPlayers(registrationsSnapshot);
  const draw = readDraw(drawSnapshot.data());

  return {
    tournament: access.tournament,
    draw,
    registeredIds: registeredIds(players),
    players: snapshotMap(players),
  };
}

export interface ShuffleDrawResult {
  readonly draw: StoredDraw;
}

/**
 * Creates a fresh seeded draft. Locked players keep their pot; everyone else is
 * shuffled into the open slots. The seed is always server-generated.
 */
export async function shuffleDraw(
  tournamentId: string,
  lockedInput: Readonly<Record<string, 1 | 2 | 3 | 4>> = {},
): Promise<ShuffleDrawResult> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const drawRef = firestore.doc(paths.tournamentDrawCurrent(tournamentId));
  const registrationsQuery = firestore
    .collection(paths.tournamentRegistrations(tournamentId))
    .where("status", "==", "registered");

  const result = await firestore.runTransaction<StoredDraw>(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);
    const drawSnapshot = await transaction.get(drawRef);
    const registrationsSnapshot = await transaction.get(registrationsQuery);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;
    const players = readRegisteredPlayers(registrationsSnapshot);
    const existing = readDraw(drawSnapshot.data());

    assertDrawStage(tournament);
    assertNotConfirmed(existing);
    requireFullField(players);

    const seed = newSeed();
    let allocation;

    try {
      allocation = shuffleIntoPots({
        playerIds: players.map((player) => player.uid),
        locked: lockedInput,
        seed,
      });
    } catch (error) {
      if (error instanceof PotAllocationError) {
        throw new TournamentMutationError(error.message, 400);
      }

      throw error;
    }

    const now = Timestamp.now();
    const draw: StoredDraw = {
      status: "draft",
      pots: {
        "1": [...allocation.pots["1"]],
        "2": [...allocation.pots["2"]],
        "3": [...allocation.pots["3"]],
        "4": [...allocation.pots["4"]],
      },
      unassigned: [],
      method: Object.keys(lockedInput).length > 0 ? "mixed" : "shuffle",
      shuffleSeed: seed,
      algorithmVersion: DRAW_ALGORITHM_VERSION,
      locks: Object.fromEntries(
        Object.entries(lockedInput).map(([uid, pot]) => [uid, String(pot) as PotNumber]),
      ),
      playersSnapshot: snapshotMap(players),
      tiebreakSeed: null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      confirmedAt: null,
      confirmedBy: null,
    };

    transaction.set(drawRef, drawWrite(draw));

    return draw;
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.draw.shuffled",
    targetType: "draw",
    targetId: tournamentId,
    tournamentId,
    before: null,
    after: {
      method: result.method,
      seed: result.shuffleSeed,
      algorithmVersion: result.algorithmVersion,
      locks: result.locks,
    },
  });

  return { draw: result };
}

/** Moves one player to a pot (numeric 1-4) or back to unassigned (null). */
export async function assignPlayer(
  tournamentId: string,
  uid: string,
  pot: number | null,
): Promise<StoredDraw> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const drawRef = firestore.doc(paths.tournamentDrawCurrent(tournamentId));
  const registrationsQuery = firestore
    .collection(paths.tournamentRegistrations(tournamentId))
    .where("status", "==", "registered");

  const draw = await firestore.runTransaction<StoredDraw>(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);
    const drawSnapshot = await transaction.get(drawRef);
    const registrationsSnapshot = await transaction.get(registrationsQuery);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;
    const players = readRegisteredPlayers(registrationsSnapshot);
    const existing = readDraw(drawSnapshot.data());

    assertDrawStage(tournament);
    assertNotConfirmed(existing);
    assertRegistered(players, uid);

    const current = existing ?? baseDraw(players);
    const pots = readPots(current.pots);

    for (const key of POT_KEYS) {
      pots[key] = pots[key].filter((playerUid) => playerUid !== uid);
    }

    const unassigned = current.unassigned.filter((playerUid) => playerUid !== uid);

    if (pot === null) {
      unassigned.push(uid);
    } else {
      if (pot !== 1 && pot !== 2 && pot !== 3 && pot !== 4) {
        throw new TournamentMutationError("Choose pot 1, 2, 3 or 4.", 400);
      }

      const key = String(pot) as PotNumber;

      if (pots[key].length >= 9) {
        throw new TournamentMutationError(`Pot ${key} already holds nine players.`, 409);
      }

      pots[key].push(uid);
    }

    const locks = { ...current.locks };

    if (locks[uid]) {
      if (pot === null) {
        delete locks[uid];
      } else {
        locks[uid] = String(pot) as PotNumber;
      }
    }

    const next: StoredDraw = {
      ...current,
      pots,
      unassigned,
      locks,
      method: methodAfterEdit(current),
      playersSnapshot: snapshotMap(players),
      updatedAt: Timestamp.now(),
    };

    transaction.set(drawRef, drawWrite(next));

    return next;
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.draw.player_moved",
    targetType: "draw",
    targetId: tournamentId,
    tournamentId,
    before: null,
    after: { uid, pot },
  });

  return draw;
}

/** Pins a player to the pot they currently occupy, or releases the pin. */
export async function lockPlayer(
  tournamentId: string,
  uid: string,
  locked: boolean,
): Promise<StoredDraw> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const drawRef = firestore.doc(paths.tournamentDrawCurrent(tournamentId));
  const registrationsQuery = firestore
    .collection(paths.tournamentRegistrations(tournamentId))
    .where("status", "==", "registered");

  const draw = await firestore.runTransaction<StoredDraw>(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);
    const drawSnapshot = await transaction.get(drawRef);
    const registrationsSnapshot = await transaction.get(registrationsQuery);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;
    const players = readRegisteredPlayers(registrationsSnapshot);
    const existing = readDraw(drawSnapshot.data());

    assertDrawStage(tournament);
    assertNotConfirmed(existing);
    assertRegistered(players, uid);

    if (!existing) {
      throw new TournamentMutationError("Shuffle the field before locking players.", 409);
    }

    const locks = { ...existing.locks };

    if (locked) {
      const pot = findPot(existing, uid);

      if (pot === null) {
        throw new TournamentMutationError("Assign the player to a pot before locking them.", 409);
      }

      locks[uid] = pot;
    } else {
      delete locks[uid];
    }

    const next: StoredDraw = {
      ...existing,
      locks,
      playersSnapshot: snapshotMap(players),
      updatedAt: Timestamp.now(),
    };

    transaction.set(drawRef, drawWrite(next));

    return next;
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: locked ? "tournament.draw.player_locked" : "tournament.draw.player_unlocked",
    targetType: "draw",
    targetId: tournamentId,
    tournamentId,
    before: null,
    after: { uid, locked },
  });

  return draw;
}

/** Clears the draft: every player becomes unassigned and all pins are released. */
export async function clearDraw(tournamentId: string): Promise<StoredDraw> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const drawRef = firestore.doc(paths.tournamentDrawCurrent(tournamentId));
  const registrationsQuery = firestore
    .collection(paths.tournamentRegistrations(tournamentId))
    .where("status", "==", "registered");

  const draw = await firestore.runTransaction<StoredDraw>(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);
    const drawSnapshot = await transaction.get(drawRef);
    const registrationsSnapshot = await transaction.get(registrationsQuery);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;
    const players = readRegisteredPlayers(registrationsSnapshot);
    const existing = readDraw(drawSnapshot.data());

    assertDrawStage(tournament);
    assertNotConfirmed(existing);

    const now = Timestamp.now();
    const next: StoredDraw = {
      status: "draft",
      pots: emptyPots(),
      unassigned: players.map((player) => player.uid),
      method: "manual",
      shuffleSeed: null,
      algorithmVersion: DRAW_ALGORITHM_VERSION,
      locks: {},
      playersSnapshot: snapshotMap(players),
      tiebreakSeed: null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      confirmedAt: null,
      confirmedBy: null,
    };

    transaction.set(drawRef, drawWrite(next));

    return next;
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.draw.cleared",
    targetType: "draw",
    targetId: tournamentId,
    tournamentId,
    before: null,
    after: { registered: draw.unassigned.length },
  });

  return draw;
}

/** A uid-to-pot map used to address one notification per group. */
function groupByPot(draw: StoredDraw): ReadonlyMap<PotNumber, string[]> {
  const groups = new Map<PotNumber, string[]>();

  for (const key of POT_KEYS) {
    groups.set(key, [...draw.pots[key]]);
  }

  return groups;
}

/**
 * Confirms the draw. ONE transaction re-reads the registered field and the
 * stored pots; the draw only becomes public when exactly 36 registered players
 * fill four pots of nine.
 */
export async function confirmDraw(tournamentId: string): Promise<StoredDraw> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const drawRef = firestore.doc(paths.tournamentDrawCurrent(tournamentId));
  const registrationsQuery = firestore
    .collection(paths.tournamentRegistrations(tournamentId))
    .where("status", "==", "registered");

  const result = await firestore.runTransaction<{
    draw: StoredDraw;
    slug: string;
    name: string;
  }>(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);
    const drawSnapshot = await transaction.get(drawRef);
    const registrationsSnapshot = await transaction.get(registrationsQuery);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;
    const players = readRegisteredPlayers(registrationsSnapshot);
    const existing = readDraw(drawSnapshot.data());

    assertDrawStage(tournament);
    assertNotConfirmed(existing);
    requireFullField(players);

    if (!existing) {
      throw new TournamentMutationError("Shuffle or assign the pots before confirming.", 409);
    }

    const validation = validatePots(existing.pots, registeredIds(players));

    if (!validation.valid) {
      throw new TournamentMutationError(
        validation.issues.map((issue) => issue.message).join(" "),
        409,
      );
    }

    const now = Timestamp.now();
    const draw: StoredDraw = {
      ...existing,
      status: "confirmed",
      unassigned: [],
      playersSnapshot: snapshotMap(players),
      tiebreakSeed: newSeed(),
      updatedAt: now,
      confirmedAt: now,
      confirmedBy: access.user.userId,
    };

    transaction.set(drawRef, drawWrite(draw));
    transaction.update(tournamentRef, {
      status: "pots_confirmed",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { draw, slug: tournament.slug, name: tournament.name };
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.draw.confirmed",
    targetType: "draw",
    targetId: tournamentId,
    tournamentId,
    before: { status: "draft" },
    after: {
      status: "confirmed",
      method: result.draw.method,
      seed: result.draw.shuffleSeed,
      tiebreakSeed: result.draw.tiebreakSeed,
    },
  });

  // Nine recipients per pot: four small batches, well inside the 500 limit.
  for (const [pot, uids] of groupByPot(result.draw)) {
    await createNotifications(uids, {
      type: "tournament",
      title: "The draw is complete",
      body: `The draw is complete: you are in Pot ${pot}.`,
      link: `/tournaments/${result.slug}`,
    }).catch(() => undefined);
  }

  return result.draw;
}

interface DrawFixtureGuard {
  readonly hasFixtureDraft: boolean;
  readonly hasMatches: boolean;
}

/**
 * Returns whether any fixture work exists. Replacing a player or undoing the
 * confirmation would invalidate it, so both actions refuse while it does.
 */
async function readFixtureGuard(
  firestore: ReturnType<typeof getFirebaseAdminFirestore>,
  transaction: import("firebase-admin/firestore").Transaction,
  tournamentId: string,
): Promise<DrawFixtureGuard> {
  const [draft, matches] = await Promise.all([
    transaction.get(firestore.doc(paths.tournamentFixtureDraftCurrent(tournamentId))),
    transaction.get(firestore.collection(paths.tournamentMatches(tournamentId)).limit(1)),
  ]);

  return { hasFixtureDraft: draft.exists, hasMatches: !matches.empty };
}

function assertNoFixtureWork(guard: DrawFixtureGuard): void {
  if (guard.hasFixtureDraft || guard.hasMatches) {
    throw new TournamentMutationError(
      "Fixtures already exist. Remove them before changing the confirmed draw.",
      409,
    );
  }
}

/**
 * Returns a confirmed draw to draft editing. Allowed only from `pots_confirmed`
 * and only while no fixture draft or match exists. The tiebreak seed is
 * discarded; the shuffle seed stays so the original draw remains replayable.
 */
export async function unconfirmDraw(tournamentId: string, reason: string): Promise<void> {
  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();
  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const drawRef = firestore.doc(paths.tournamentDrawCurrent(tournamentId));

  await firestore.runTransaction(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);
    const drawSnapshot = await transaction.get(drawRef);
    const fixtures = await readFixtureGuard(firestore, transaction, tournamentId);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;
    const existing = readDraw(drawSnapshot.data());

    if (tournament.status !== "pots_confirmed") {
      throw new TournamentMutationError("This draw is not confirmed.", 409);
    }

    if (!existing || existing.status !== "confirmed") {
      throw new TournamentMutationError("This draw is not confirmed.", 409);
    }

    assertNoFixtureWork(fixtures);

    const now = Timestamp.now();
    const next: StoredDraw = {
      ...existing,
      status: "draft",
      tiebreakSeed: null,
      updatedAt: now,
      confirmedAt: null,
      confirmedBy: null,
    };

    transaction.set(drawRef, drawWrite(next));
    transaction.update(tournamentRef, {
      status: "registration_closed",
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.draw.unconfirmed",
    targetType: "draw",
    targetId: tournamentId,
    tournamentId,
    before: { status: "confirmed" },
    after: { status: "draft" },
    reason,
  });
}

function registrationWrite(
  tournamentId: string,
  player: PlayerEntrySnapshot,
): Record<string, unknown> {
  return {
    tournamentId,
    gamerTag: player.gamerTag,
    gamerTagLower: player.gamerTagLower,
    country: player.country,
    avatarUrl: player.avatarUrl,
    platform: player.platform,
    status: "registered",
    registeredAt: FieldValue.serverTimestamp(),
    withdrawnAt: null,
    removedAt: null,
    removedBy: null,
  };
}

function membershipWrite(
  tournamentId: string,
  tournament: TournamentDocument,
  playerStatus: "registered" | "removed",
): Record<string, unknown> {
  return {
    tournamentId,
    slug: tournament.slug,
    name: tournament.name,
    gameId: tournament.gameId,
    status: tournament.status,
    playerStatus,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/**
 * Replaces one registered player with another in the same pot slot, keeping the
 * field at exactly 36. Allowed while registration is closed (draft draw) or
 * after confirmation, but never once fixture work exists.
 */
export async function replaceDrawPlayer(
  tournamentId: string,
  outUid: string,
  inUid: string,
  reason: string,
): Promise<void> {
  if (outUid === inUid) {
    throw new TournamentMutationError(
      "Choose a different player to bring into the competition.",
      400,
    );
  }

  const access = await requireTournamentOwnerOrSuperAdmin(tournamentId);
  const firestore = getFirebaseAdminFirestore();

  const userSnapshot = await firestore.doc(paths.user(inUid)).get();

  if (!userSnapshot.exists || userSnapshot.data()?.status !== "active") {
    throw new TournamentMutationError("That player's account is not active.", 409);
  }

  const inPlayer = await loadPlayerSnapshot(inUid);

  const tournamentRef = firestore.doc(paths.tournament(tournamentId));
  const drawRef = firestore.doc(paths.tournamentDrawCurrent(tournamentId));
  const outRef = firestore.doc(paths.tournamentRegistration(tournamentId, outUid));
  const inRef = firestore.doc(paths.tournamentRegistration(tournamentId, inUid));
  const outMembershipRef = firestore.doc(paths.userMembership(outUid, tournamentId));
  const inMembershipRef = firestore.doc(paths.userMembership(inUid, tournamentId));

  const result = await firestore.runTransaction<{
    tournament: TournamentDocument;
    outTag: string;
    pot: PotNumber | null;
    name: string;
    slug: string;
  }>(async (transaction) => {
    const tournamentSnapshot = await transaction.get(tournamentRef);
    const drawSnapshot = await transaction.get(drawRef);
    const outSnapshot = await transaction.get(outRef);
    const inSnapshot = await transaction.get(inRef);
    const fixtures = await readFixtureGuard(firestore, transaction, tournamentId);

    if (!tournamentSnapshot.exists) {
      throw new TournamentMutationError("Tournament not found.", 404);
    }

    const tournament = tournamentSnapshot.data() as TournamentDocument;

    if (tournament.status !== "registration_closed" && tournament.status !== "pots_confirmed") {
      throw new TournamentMutationError(
        "A player can only be replaced after registration closes and before fixtures are published.",
        409,
      );
    }

    assertNoFixtureWork(fixtures);

    const existing = readDraw(drawSnapshot.data());

    if (!existing) {
      throw new TournamentMutationError("Create the draw before replacing a player.", 409);
    }

    if (outSnapshot.data()?.status !== "registered") {
      throw new TournamentMutationError("That player is not registered.", 409);
    }

    if (inSnapshot.data()?.status === "registered") {
      throw new TournamentMutationError("That player is already registered.", 409);
    }

    if (tournament.allowedPlatforms && !tournament.allowedPlatforms.includes(inPlayer.platform)) {
      throw new TournamentMutationError(
        "This competition does not accept that player's platform.",
        409,
      );
    }

    if (tournament.allowedCountries && !tournament.allowedCountries.includes(inPlayer.country)) {
      throw new TournamentMutationError(
        "This competition does not accept entries from that player's country.",
        409,
      );
    }

    const pots = readPots(existing.pots);
    const unassigned = [...existing.unassigned];
    let replacedPot: PotNumber | null = null;
    let replaced = false;

    for (const key of POT_KEYS) {
      const index = pots[key].indexOf(outUid);

      if (index !== -1) {
        pots[key][index] = inUid;
        replacedPot = key;
        replaced = true;
        break;
      }
    }

    if (!replaced) {
      const index = unassigned.indexOf(outUid);

      if (index === -1) {
        throw new TournamentMutationError("That player is not part of the stored draw.", 409);
      }

      unassigned[index] = inUid;
      replaced = true;
    }

    const locks = { ...existing.locks };
    const lockedPot = locks[outUid];
    delete locks[outUid];

    if (lockedPot) {
      locks[inUid] = replacedPot ?? lockedPot;
    } else {
      delete locks[inUid];
    }

    const snapshots = { ...existing.playersSnapshot };
    delete snapshots[outUid];
    snapshots[inUid] = {
      gamerTag: inPlayer.gamerTag,
      avatarUrl: inPlayer.avatarUrl,
      country: inPlayer.country,
    };

    const now = Timestamp.now();
    const next: StoredDraw = {
      ...existing,
      pots,
      unassigned,
      locks,
      playersSnapshot: snapshots,
      updatedAt: now,
    };

    transaction.set(drawRef, drawWrite(next));
    transaction.update(outRef, {
      status: "removed",
      removedAt: FieldValue.serverTimestamp(),
      removedBy: access.user.userId,
    });
    transaction.set(inRef, registrationWrite(tournamentId, inPlayer));
    transaction.set(
      outMembershipRef,
      { playerStatus: "removed", updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    transaction.set(inMembershipRef, membershipWrite(tournamentId, tournament, "registered"), {
      merge: true,
    });
    transaction.update(tournamentRef, { updatedAt: FieldValue.serverTimestamp() });

    const outTag =
      typeof outSnapshot.data()?.gamerTag === "string"
        ? (outSnapshot.data()?.gamerTag as string)
        : "Player";

    return {
      tournament,
      outTag,
      pot: replacedPot,
      name: tournament.name,
      slug: tournament.slug,
    };
  });

  await writeAuditLog({
    actorUid: access.user.userId,
    actorRole: access.user.role,
    action: "tournament.draw.player_replaced",
    targetType: "draw",
    targetId: tournamentId,
    tournamentId,
    before: { uid: outUid, gamerTag: result.outTag, pot: result.pot },
    after: { uid: inUid, gamerTag: inPlayer.gamerTag, pot: result.pot },
    reason,
  });

  await createNotifications([outUid], {
    type: "tournament",
    title: "Removed from the draw",
    body: `The organiser removed you from the draw: ${reason}`,
    link: `/tournaments/${result.slug}`,
  }).catch(() => undefined);

  await createNotifications([inUid], {
    type: "tournament",
    title: result.pot ? `The draw is complete — Pot ${result.pot}` : "Added to the draw",
    body: result.pot
      ? `The organiser entered you into ${result.name} and placed you in Pot ${result.pot}.`
      : `The organiser entered you into ${result.name}.`,
    link: `/tournaments/${result.slug}`,
  }).catch(() => undefined);
}
