// GCC - emulator-backed integration tests for the Phase 9 pot draw.
//
// These tests use the real Admin SDK, the real module transactions and the real
// route guards against the Auth and Firestore emulators. They prove the draw is
// seeded on the server, locks survive a re-shuffle, manual capacity is enforced,
// confirmation re-validates the field, concurrent confirmations cannot both
// win, fixture work blocks an undo, and a replacement keeps exactly 36 players
// in the same pot slot.
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sessionCookie } = vi.hoisted(() => ({
  sessionCookie: { value: undefined as string | undefined },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "gcc_session" && sessionCookie.value
        ? { name, value: sessionCookie.value }
        : undefined,
  }),
}));

import { PUT as assignRoute } from "@/app/api/organiser/tournaments/[id]/draw/assign/route";
import { POST as clearRoute } from "@/app/api/organiser/tournaments/[id]/draw/clear/route";
import { POST as confirmRoute } from "@/app/api/organiser/tournaments/[id]/draw/confirm/route";
import { PUT as lockRoute } from "@/app/api/organiser/tournaments/[id]/draw/lock/route";
import { POST as replaceRoute } from "@/app/api/organiser/tournaments/[id]/draw/replace/route";
import { POST as shuffleRoute } from "@/app/api/organiser/tournaments/[id]/draw/shuffle/route";
import { POST as unconfirmRoute } from "@/app/api/organiser/tournaments/[id]/draw/unconfirm/route";
import { requirePageRole } from "@/lib/auth/page-access";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";

const PASSWORD = "correct horse battery";
const SUPER_ADMIN_EMAIL = "owner@example.com";
const SUPER_ADMIN_UID = "integration-super-admin";
const TOURNAMENT_ID = "draw-cup";

interface SeededUser {
  readonly uid: string;
  readonly email: string;
}

let owner: SeededUser;
let otherOrganiser: SeededUser;
let plainPlayer: SeededUser;

async function clearEmulator(): Promise<void> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();

  const users = await auth.listUsers(1000);
  if (users.users.length > 0) {
    await auth.deleteUsers(users.users.map((user) => user.uid));
  }

  const tournaments = await firestore.collection(paths.tournaments()).listDocuments();
  for (const tournament of tournaments) {
    await firestore.recursiveDelete(tournament);
  }

  for (const collection of [
    paths.users(),
    paths.publicProfiles(),
    paths.gamerTags(),
    paths.tournamentSlugs(),
    paths.organiserProfiles(),
    paths.auditLogs(),
    paths.platformSettings(),
    paths.rateLimits(),
    paths.platformStats(),
  ]) {
    const snapshot = await firestore.collection(collection).get();

    if (!snapshot.empty) {
      const batch = firestore.batch();
      snapshot.docs.forEach((document) => batch.delete(document.ref));
      await batch.commit();
    }
  }
}

async function createUser(options: {
  readonly email: string;
  readonly role: "user" | "organiser" | "super_admin";
  readonly gamerTag: string;
}): Promise<SeededUser> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();
  const record = await auth.createUser({
    ...(options.email === SUPER_ADMIN_EMAIL && options.role === "super_admin"
      ? { uid: SUPER_ADMIN_UID }
      : {}),
    email: options.email,
    password: PASSWORD,
    displayName: options.gamerTag,
  });

  await auth.setCustomUserClaims(record.uid, { role: options.role });

  const now = new Date();
  const profile = {
    gamerTag: options.gamerTag,
    gamerTagLower: options.gamerTag.toLowerCase(),
    country: "KE",
    preferredGame: "efootball",
    platform: "android",
    community: null,
    favouriteClub: null,
    photoUrl: null,
    avatarUrl: null,
    avatarPublicId: null,
  };

  await Promise.all([
    firestore.doc(paths.user(record.uid)).set({
      fullName: `${options.gamerTag} Player`,
      ...profile,
      email: options.email,
      whatsappE164: null,
      role: options.role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }),
    firestore.doc(paths.publicProfile(record.uid)).set({
      ...profile,
      status: "active",
      stats: {
        overall: {
          tournaments: 0,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          titles: 0,
        },
        byGame: {},
      },
    }),
  ]);

  return { uid: record.uid, email: options.email };
}

async function signInIdToken(email: string): Promise<string> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const response = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    },
  );

  if (!response.ok) {
    throw new Error(`Emulator sign-in failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { idToken: string };
  return payload.idToken;
}

async function sessionFor(user: SeededUser): Promise<string> {
  const idToken = await signInIdToken(user.email);
  return getFirebaseAdminAuth().createSessionCookie(idToken, { expiresIn: 60 * 60 * 1000 });
}

function jsonRequest(method: "POST" | "PUT", path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function routeContext(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: TOURNAMENT_ID }) };
}

function drawRequest(method: "POST" | "PUT", action: string, body?: unknown): NextRequest {
  return jsonRequest(method, `/api/organiser/tournaments/${TOURNAMENT_ID}/draw/${action}`, body);
}

async function createTournament(status: string, count = 36): Promise<void> {
  const now = new Date();
  const firestore = getFirebaseAdminFirestore();

  await firestore.doc(paths.tournament(TOURNAMENT_ID)).set({
    ownerUid: owner.uid,
    ownerTag: "Organiser",
    organisationName: "Draw Org",
    slug: "draw-cup",
    name: "Draw Cup",
    nameLower: "draw cup",
    description: "Draw integration test.",
    gameId: "efootball",
    formatId: "ucl-league-phase-36",
    coverImageUrl: null,
    coverImagePublicId: null,
    logoUrl: null,
    logoPublicId: null,
    rules: "Fair play.",
    matchDurationMinutes: 10,
    timezone: "Africa/Nairobi",
    registrationOpensAt: new Date(now.getTime() - 7 * 86_400_000),
    registrationClosesAt: new Date(now.getTime() - 86_400_000),
    startsAt: new Date(now.getTime() + 7 * 86_400_000),
    maxParticipants: 36,
    registrationCount: count,
    status,
    suspendedFrom: null,
    season: "2026",
    allowedPlatforms: null,
    allowedCountries: null,
    createdAt: now,
    updatedAt: now,
  });

  await firestore.doc(paths.tournamentSlug("draw-cup")).set({
    tournamentId: TOURNAMENT_ID,
    name: "Draw Cup",
    createdAt: now,
  });
}

async function seedRegistrations(count = 36): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const batch = firestore.batch();
  const now = new Date();

  for (let index = 0; index < count; index += 1) {
    const uid = `player-${String(index).padStart(2, "0")}`;
    batch.set(firestore.doc(paths.tournamentRegistration(TOURNAMENT_ID, uid)), {
      tournamentId: TOURNAMENT_ID,
      gamerTag: `Player${String(index).padStart(2, "0")}`,
      gamerTagLower: `player${String(index).padStart(2, "0")}`,
      country: "KE",
      avatarUrl: null,
      platform: "android",
      status: "registered",
      registeredAt: now,
      withdrawnAt: null,
      removedAt: null,
      removedBy: null,
    });
  }

  await batch.commit();
}

async function readDraw(): Promise<Record<string, unknown> | null> {
  const snapshot = await getFirebaseAdminFirestore()
    .doc(paths.tournamentDrawCurrent(TOURNAMENT_ID))
    .get();

  return snapshot.exists ? (snapshot.data() as Record<string, unknown>) : null;
}

async function readTournamentStatus(): Promise<string | undefined> {
  const snapshot = await getFirebaseAdminFirestore().doc(paths.tournament(TOURNAMENT_ID)).get();
  return snapshot.data()?.status as string | undefined;
}

async function auditCount(action: string): Promise<number> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.auditLogs())
    .where("action", "==", action)
    .where("tournamentId", "==", TOURNAMENT_ID)
    .get();

  return snapshot.size;
}

function potOf(draw: Record<string, unknown>, uid: string): string | null {
  const pots = draw.pots as Record<string, readonly string[]>;

  for (const key of ["1", "2", "3", "4"]) {
    if ((pots[key] ?? []).includes(uid)) {
      return key;
    }
  }

  return null;
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

beforeEach(async () => {
  sessionCookie.value = undefined;
  await clearEmulator();

  owner = await createUser({
    email: "draw-owner@example.com",
    role: "organiser",
    gamerTag: "DrawOwner",
  });
  otherOrganiser = await createUser({
    email: "draw-other@example.com",
    role: "organiser",
    gamerTag: "OtherOrganiser",
  });
  plainPlayer = await createUser({
    email: "draw-player@example.com",
    role: "user",
    gamerTag: "PlainPlayer",
  });

  await createTournament("registration_closed");
  await seedRegistrations();
  sessionCookie.value = await sessionFor(owner);
});

afterAll(async () => {
  await clearEmulator();
});

describe("draw shuffle", () => {
  it("creates four pots of nine from a server-generated seed", async () => {
    const response = await shuffleRoute(drawRequest("POST", "shuffle", {}), routeContext());

    expect(response.status).toBe(200);

    const draw = await readDraw();
    expect(draw?.status).toBe("draft");
    expect(draw?.method).toBe("shuffle");
    expect(String(draw?.shuffleSeed)).toMatch(/^[0-9a-f]{64}$/);
    expect(draw?.algorithmVersion).toBe(1);

    const pots = draw?.pots as Record<string, readonly string[]>;
    const all = ["1", "2", "3", "4"].flatMap((key) => pots[key] ?? []);

    expect(all).toHaveLength(36);
    expect(new Set(all).size).toBe(36);

    for (const key of ["1", "2", "3", "4"]) {
      expect(pots[key]).toHaveLength(9);
    }

    expect(await auditCount("tournament.draw.shuffled")).toBe(1);
  });

  it("keeps pinned players in their pot across a re-shuffle", async () => {
    const first = await shuffleRoute(
      drawRequest("POST", "shuffle", { locked: { "player-00": 1, "player-01": 1 } }),
      routeContext(),
    );
    expect(first.status).toBe(200);

    let draw = await readDraw();
    expect(draw).not.toBeNull();
    expect(potOf(draw as Record<string, unknown>, "player-00")).toBe("1");
    expect(potOf(draw as Record<string, unknown>, "player-01")).toBe("1");

    const pinned = "player-05";
    const currentPot = potOf(draw as Record<string, unknown>, pinned);
    expect(currentPot).not.toBeNull();

    const lock = await lockRoute(
      drawRequest("PUT", "lock", { uid: pinned, locked: true }),
      routeContext(),
    );
    expect(lock.status).toBe(200);

    const second = await shuffleRoute(
      drawRequest("POST", "shuffle", { locked: { [pinned]: Number(currentPot) } }),
      routeContext(),
    );
    expect(second.status).toBe(200);

    draw = await readDraw();
    expect(potOf(draw as Record<string, unknown>, pinned)).toBe(currentPot);
  });
});

describe("manual moves", () => {
  it("moves players between pots and refuses a tenth player in one pot", async () => {
    const clear = await clearRoute(drawRequest("POST", "clear"), routeContext());
    expect(clear.status).toBe(200);

    for (let index = 0; index < 9; index += 1) {
      const uid = `player-${String(index).padStart(2, "0")}`;
      const response = await assignRoute(
        drawRequest("PUT", "assign", { uid, pot: 1 }),
        routeContext(),
      );
      expect(response.status).toBe(200);
    }

    const overflow = await assignRoute(
      drawRequest("PUT", "assign", { uid: "player-09", pot: 1 }),
      routeContext(),
    );
    expect(overflow.status).toBe(409);

    const back = await assignRoute(
      drawRequest("PUT", "assign", { uid: "player-00", pot: null }),
      routeContext(),
    );
    expect(back.status).toBe(200);

    const draw = await readDraw();
    expect((draw?.unassigned as string[]).includes("player-00")).toBe(true);
    expect(draw?.method).toBe("manual");
  });
});

describe("draw confirmation", () => {
  it("refuses to confirm while registration is open, short of 36, or unevenly potted", async () => {
    await getFirebaseAdminFirestore()
      .doc(paths.tournament(TOURNAMENT_ID))
      .update({ status: "registration_open" });
    const open = await confirmRoute(drawRequest("POST", "confirm"), routeContext());
    expect(open.status).toBe(409);

    await getFirebaseAdminFirestore()
      .doc(paths.tournament(TOURNAMENT_ID))
      .update({ status: "registration_closed" });
    await getFirebaseAdminFirestore()
      .doc(paths.tournamentRegistration(TOURNAMENT_ID, "player-35"))
      .delete();
    await getFirebaseAdminFirestore()
      .doc(paths.tournament(TOURNAMENT_ID))
      .update({ registrationCount: 35 });

    const short = await confirmRoute(drawRequest("POST", "confirm"), routeContext());
    expect(short.status).toBe(409);
    expect(String((await responseBody(short)).error)).toContain("36");

    await seedRegistrations(36);
    await getFirebaseAdminFirestore()
      .doc(paths.tournament(TOURNAMENT_ID))
      .update({ registrationCount: 36 });

    const now = new Date();
    const ids = Array.from(
      { length: 36 },
      (_, index) => `player-${String(index).padStart(2, "0")}`,
    );
    await getFirebaseAdminFirestore()
      .doc(paths.tournamentDrawCurrent(TOURNAMENT_ID))
      .set({
        status: "draft",
        pots: {
          "1": ids.slice(0, 8),
          "2": ids.slice(8, 18),
          "3": ids.slice(18, 27),
          "4": ids.slice(27, 36),
        },
        unassigned: [],
        method: "manual",
        shuffleSeed: null,
        algorithmVersion: 1,
        locks: {},
        playersSnapshot: {},
        tiebreakSeed: null,
        createdAt: now,
        updatedAt: now,
        confirmedAt: null,
        confirmedBy: null,
      });

    const uneven = await confirmRoute(drawRequest("POST", "confirm"), routeContext());
    expect(uneven.status).toBe(409);

    const shuffled = await shuffleRoute(drawRequest("POST", "shuffle", {}), routeContext());
    expect(shuffled.status).toBe(200);

    const confirmed = await confirmRoute(drawRequest("POST", "confirm"), routeContext());
    expect(confirmed.status).toBe(200);
    expect(await readTournamentStatus()).toBe("pots_confirmed");

    const draw = await readDraw();
    expect(draw?.status).toBe("confirmed");
    expect(String(draw?.tiebreakSeed)).toMatch(/^[0-9a-f]{64}$/);
    expect(draw?.confirmedBy).toBe(owner.uid);
  });

  it("allows exactly one of two concurrent confirmations", async () => {
    const shuffled = await shuffleRoute(drawRequest("POST", "shuffle", {}), routeContext());
    expect(shuffled.status).toBe(200);

    const [first, second] = await Promise.all([
      confirmRoute(drawRequest("POST", "confirm"), routeContext()),
      confirmRoute(drawRequest("POST", "confirm"), routeContext()),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(await auditCount("tournament.draw.confirmed")).toBe(1);
    expect((await readDraw())?.status).toBe("confirmed");
  });

  it("blocks undo once fixture work exists, then undoes the confirmation", async () => {
    await shuffleRoute(drawRequest("POST", "shuffle", {}), routeContext());
    await confirmRoute(drawRequest("POST", "confirm"), routeContext());

    await getFirebaseAdminFirestore()
      .doc(paths.tournamentFixtureDraftCurrent(TOURNAMENT_ID))
      .set({ generatedBy: owner.uid, generatedAt: new Date(), fixtures: [], validation: {} });

    const blocked = await unconfirmRoute(
      drawRequest("POST", "unconfirm", { reason: "Wrong seed used." }),
      routeContext(),
    );
    expect(blocked.status).toBe(409);

    await getFirebaseAdminFirestore()
      .doc(paths.tournamentFixtureDraftCurrent(TOURNAMENT_ID))
      .delete();

    const undone = await unconfirmRoute(
      drawRequest("POST", "unconfirm", { reason: "Wrong seed used." }),
      routeContext(),
    );
    expect(undone.status).toBe(200);
    expect(await readTournamentStatus()).toBe("registration_closed");

    const draw = await readDraw();
    expect(draw?.status).toBe("draft");
    expect(draw?.tiebreakSeed).toBeNull();
    expect(draw?.confirmedAt).toBeNull();
  });
});

describe("player replacement", () => {
  it("swaps exactly one player into the same pot and keeps the field at 36", async () => {
    await shuffleRoute(drawRequest("POST", "shuffle", {}), routeContext());
    await confirmRoute(drawRequest("POST", "confirm"), routeContext());

    const before = await readDraw();
    const outUid = "player-00";
    const pot = potOf(before as Record<string, unknown>, outUid);
    expect(pot).not.toBeNull();

    const incoming = await createUser({
      email: "incoming@example.com",
      role: "user",
      gamerTag: "IncomingPlayer",
    });

    const response = await replaceRoute(
      drawRequest("POST", "replace", {
        outUid,
        inUid: incoming.uid,
        reason: "The original player withdrew.",
      }),
      routeContext(),
    );
    expect(response.status).toBe(200);

    const after = await readDraw();
    expect(potOf(after as Record<string, unknown>, outUid)).toBeNull();
    expect(potOf(after as Record<string, unknown>, incoming.uid)).toBe(pot);

    const pots = after?.pots as Record<string, readonly string[]>;
    const all = ["1", "2", "3", "4"].flatMap((key) => pots[key] ?? []);
    expect(all).toHaveLength(36);
    expect(new Set(all).size).toBe(36);

    const firestore = getFirebaseAdminFirestore();
    const outRegistration = await firestore
      .doc(paths.tournamentRegistration(TOURNAMENT_ID, outUid))
      .get();
    const inRegistration = await firestore
      .doc(paths.tournamentRegistration(TOURNAMENT_ID, incoming.uid))
      .get();
    const tournament = await firestore.doc(paths.tournament(TOURNAMENT_ID)).get();

    expect(outRegistration.data()?.status).toBe("removed");
    expect(inRegistration.data()?.status).toBe("registered");
    expect(tournament.data()?.registrationCount).toBe(36);
    expect(await auditCount("tournament.draw.player_replaced")).toBe(1);
  });
});

describe("draw access", () => {
  it("hides the action from another organiser and redirects a plain player", async () => {
    sessionCookie.value = await sessionFor(otherOrganiser);

    const nonOwner = await shuffleRoute(drawRequest("POST", "shuffle", {}), routeContext());
    expect(nonOwner.status).toBe(404);

    sessionCookie.value = await sessionFor(plainPlayer);

    const plain = await shuffleRoute(drawRequest("POST", "shuffle", {}), routeContext());
    expect(plain.status).toBe(403);

    const redirect = await requirePageRole(
      "organiser",
      `/organiser/tournaments/${TOURNAMENT_ID}/pots`,
    ).catch((error: unknown) => error);

    expect(redirect).toBeInstanceOf(Error);
    expect((redirect as { digest?: string }).digest).toContain("NEXT_REDIRECT");
    expect((redirect as { digest?: string }).digest).toContain("/dashboard");
  });
});
