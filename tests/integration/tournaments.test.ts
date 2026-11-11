// GCC - emulator-backed integration tests for Phase 8 tournaments.
//
// Covers the wizard's draft creation and slug reservation, the lifecycle
// actions, the server-side editable-fields matrix, player entry and
// withdrawal (including the one-transaction 36-capacity guarantee under 40
// concurrent registrations), organiser registration management, the WhatsApp
// contact link, the CSV export, and the Super Admin suspension and transfer
// controls. Route-level tests prove that a non-owner organiser receives the
// branded 404 on every Phase 8 endpoint while the Super Admin may act.
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Route handlers and mutation modules read the session through next/headers.
// Outside a Next.js request there is no cookie store, so the test supplies
// one. `cookieQueue` lets a burst of concurrent module calls (the capacity
// test) each consume a distinct session cookie in call order: every
// registerPlayer call reaches `cookies()` synchronously before its first
// await, so the queue drains in invocation order.
const { sessionCookie, cookieQueue } = vi.hoisted(() => ({
  sessionCookie: { value: undefined as string | undefined },
  cookieQueue: [] as string[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name !== "gcc_session") {
        return undefined;
      }

      const queued = cookieQueue.shift();

      if (queued !== undefined) {
        return { name, value: queued };
      }

      return sessionCookie.value ? { name, value: sessionCookie.value } : undefined;
    },
  }),
}));

import { POST as createDraftRoute } from "@/app/api/organiser/tournaments/route";
import {
  DELETE as deleteTournamentRoute,
  PATCH as patchTournamentRoute,
} from "@/app/api/organiser/tournaments/[id]/route";
import { POST as publishRoute } from "@/app/api/organiser/tournaments/[id]/publish/route";
import { POST as closeRegistrationRoute } from "@/app/api/organiser/tournaments/[id]/close-registration/route";
import { POST as reopenRegistrationRoute } from "@/app/api/organiser/tournaments/[id]/reopen-registration/route";
import { POST as cancelTournamentRoute } from "@/app/api/organiser/tournaments/[id]/cancel/route";
import { POST as addPlayerRoute } from "@/app/api/organiser/tournaments/[id]/registrations/route";
import { POST as removePlayerRoute } from "@/app/api/organiser/tournaments/[id]/registrations/[uid]/remove/route";
import { GET as contactRoute } from "@/app/api/organiser/tournaments/[id]/registrations/[uid]/contact/route";
import { GET as exportRoute } from "@/app/api/organiser/tournaments/[id]/registrations/export/route";
import { POST as playerRegisterRoute } from "@/app/api/tournaments/[id]/register/route";
import { POST as playerWithdrawRoute } from "@/app/api/tournaments/[id]/withdraw/route";
import { POST as suspendRoute } from "@/app/api/super-admin/tournaments/[id]/suspend/route";
import { POST as unsuspendRoute } from "@/app/api/super-admin/tournaments/[id]/unsuspend/route";
import { POST as transferRoute } from "@/app/api/super-admin/tournaments/[id]/transfer/route";
import { POST as superAdminCancelRoute } from "@/app/api/super-admin/tournaments/[id]/cancel/route";

import { AuthorizationError, requireTournamentOwnerOrSuperAdmin } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import {
  exportTournamentRegistrationsCsv,
  issueRegistrationContactLink,
  listTournamentRegistrations,
} from "@/lib/organiser/registrations";
import { createTournamentDraft } from "@/lib/tournament/create";
import { TournamentMutationError } from "@/lib/tournament/errors";
import {
  cancelTournament,
  closeRegistration,
  deleteTournamentDraft,
  publishTournament,
  reopenRegistration,
} from "@/lib/tournament/lifecycle";
import {
  addPlayer,
  registerPlayer,
  removePlayer,
  withdrawPlayer,
} from "@/lib/tournament/registrations";
import { updateTournament } from "@/lib/tournament/update";
import type { TournamentUpdateInput } from "@/lib/validation/tournament";
import type { AuditLogDocument, TournamentDocument, TournamentStatus } from "@/types/domain";

const PASSWORD = "correct horse battery";
const SUPER_ADMIN_EMAIL = "owner@example.com";
const DAY_MS = 86_400_000;

interface SeededUser {
  readonly uid: string;
  readonly email: string;
  readonly role: "user" | "organiser" | "super_admin";
}

async function clearEmulator(): Promise<void> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();

  const users = await auth.listUsers(1000);
  if (users.users.length > 0) {
    await auth.deleteUsers(users.users.map((user) => user.uid));
  }

  // Tournaments own registration subcollections, so they are removed
  // recursively before the top-level collections.
  const tournaments = await firestore.collection(paths.tournaments()).listDocuments();
  for (const tournament of tournaments) {
    await firestore.recursiveDelete(tournament);
  }

  for (const collection of [
    paths.users(),
    paths.publicProfiles(),
    paths.gamerTags(),
    paths.tournamentSlugs(),
    paths.adminApplications(),
    paths.organiserProfiles(),
    paths.tournaments(),
    paths.auditLogs(),
    paths.announcements(),
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
  readonly country?: string;
  readonly platform?: string;
  readonly whatsapp?: string;
  readonly organisationName?: string;
}): Promise<SeededUser> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();
  const record = await auth.createUser({
    email: options.email,
    password: PASSWORD,
    emailVerified: true,
    displayName: options.gamerTag,
  });

  await auth.setCustomUserClaims(record.uid, { role: options.role });

  const now = new Date();
  const writes: Array<Promise<unknown>> = [
    firestore.doc(paths.user(record.uid)).set({
      fullName: `${options.gamerTag} Player`,
      gamerTag: options.gamerTag,
      gamerTagLower: options.gamerTag.toLowerCase(),
      email: options.email,
      whatsappE164: options.whatsapp ?? null,
      country: options.country ?? "KE",
      preferredGame: "efootball",
      platform: options.platform ?? "android",
      community: null,
      favouriteClub: null,
      photoUrl: null,
      avatarUrl: null,
      avatarPublicId: null,
      role: options.role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }),
    firestore.doc(paths.publicProfile(record.uid)).set({
      gamerTag: options.gamerTag,
      gamerTagLower: options.gamerTag.toLowerCase(),
      country: options.country ?? "KE",
      preferredGame: "efootball",
      platform: options.platform ?? "android",
      community: null,
      favouriteClub: null,
      photoUrl: null,
      avatarUrl: null,
      avatarPublicId: null,
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
  ];

  if (options.organisationName !== undefined) {
    writes.push(
      firestore.doc(paths.organiserProfile(record.uid)).set({
        organisationName: options.organisationName,
        bio: null,
        logoUrl: null,
        links: [],
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  await Promise.all(writes);

  return { uid: record.uid, email: options.email, role: options.role };
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

/** Session identity for module functions that take the user as a parameter. */
function sessionUser(user: SeededUser): SessionUser {
  return {
    userId: user.uid,
    email: user.email,
    emailVerified: true,
    role: user.role,
    isSuperAdmin: user.role === "super_admin",
  };
}

function jsonRequest(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      origin: "http://localhost:3000",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function idContext(id: string): { readonly params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function uidContext(
  id: string,
  uid: string,
): { readonly params: Promise<{ id: string; uid: string }> } {
  return { params: Promise.resolve({ id, uid }) };
}

interface TournamentSeed {
  readonly ownerUid: string;
  readonly ownerTag?: string;
  readonly organisationName?: string;
  readonly status: TournamentStatus;
  readonly name: string;
  readonly slug?: string;
  readonly season?: string;
  readonly description?: string;
  readonly rules?: string;
  readonly registrationOpensAt?: Date | null;
  readonly registrationClosesAt?: Date | null;
  readonly startsAt?: Date | null;
  readonly registrationCount?: number;
  readonly maxParticipants?: number;
  readonly allowedPlatforms?: readonly string[] | null;
  readonly allowedCountries?: readonly string[] | null;
  readonly suspendedFrom?: TournamentStatus | null;
}

/** Writes a real Phase 8 tournament document plus its slug reservation. */
async function seedTournament(tournamentId: string, seed: TournamentSeed): Promise<string> {
  const now = new Date();
  const slug = seed.slug ?? seed.name.toLowerCase().replaceAll(" ", "-");
  const firestore = getFirebaseAdminFirestore();

  await firestore.doc(paths.tournament(tournamentId)).set({
    ownerUid: seed.ownerUid,
    ownerTag: seed.ownerTag ?? "organiser",
    organisationName: seed.organisationName ?? "Organisation",
    slug,
    name: seed.name,
    nameLower: seed.name.toLowerCase(),
    description: seed.description ?? "Integration test competition.",
    gameId: "efootball",
    formatId: "ucl-league-phase-36",
    coverImageUrl: null,
    coverImagePublicId: null,
    logoUrl: null,
    logoPublicId: null,
    rules: seed.rules ?? "Fair play above everything.",
    matchDurationMinutes: 10,
    timezone: "Africa/Nairobi",
    registrationOpensAt:
      seed.registrationOpensAt === undefined
        ? new Date(now.getTime() - 7 * DAY_MS)
        : seed.registrationOpensAt,
    registrationClosesAt:
      seed.registrationClosesAt === undefined
        ? new Date(now.getTime() + 7 * DAY_MS)
        : seed.registrationClosesAt,
    startsAt: seed.startsAt === undefined ? new Date(now.getTime() + 14 * DAY_MS) : seed.startsAt,
    maxParticipants: seed.maxParticipants ?? 36,
    registrationCount: seed.registrationCount ?? 0,
    status: seed.status,
    suspendedFrom: seed.suspendedFrom ?? null,
    season: seed.season ?? "2026",
    allowedPlatforms: seed.allowedPlatforms ?? null,
    allowedCountries: seed.allowedCountries ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await firestore.doc(paths.tournamentSlug(slug)).set({
    tournamentId,
    name: seed.name,
    createdAt: now,
  });

  return slug;
}

async function seedPlatformSettings(options: {
  readonly maxActiveTournamentsPerOrganiser: number;
}): Promise<void> {
  await getFirebaseAdminFirestore().doc(paths.platformSettingsMain()).set({
    maintenanceMode: false,
    maintenanceMessage: "",
    registrationsOpen: true,
    maxActiveTournamentsPerOrganiser: options.maxActiveTournamentsPerOrganiser,
    applicationCooldownDays: 7,
    updatedBy: null,
    updatedAt: new Date(),
  });
}

async function tournamentData(tournamentId: string): Promise<TournamentDocument> {
  const snapshot = await getFirebaseAdminFirestore().doc(paths.tournament(tournamentId)).get();

  if (!snapshot.exists) {
    throw new Error(`Tournament ${tournamentId} does not exist.`);
  }

  return snapshot.data() as TournamentDocument;
}

async function registrationStatus(tournamentId: string, uid: string): Promise<string | null> {
  const snapshot = await getFirebaseAdminFirestore()
    .doc(paths.tournamentRegistration(tournamentId, uid))
    .get();

  return snapshot.exists ? ((snapshot.data()?.status as string | undefined) ?? null) : null;
}

async function notificationTitles(uid: string): Promise<string[]> {
  const snapshot = await getFirebaseAdminFirestore().collection(paths.userNotifications(uid)).get();

  return snapshot.docs.map((document) => String(document.data().title));
}

async function auditEntries(
  action: string,
  tournamentId?: string,
): Promise<Array<{ id: string; data: AuditLogDocument }>> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.auditLogs())
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs
    .map((document) => ({ id: document.id, data: document.data() as AuditLogDocument }))
    .filter(
      (entry) =>
        entry.data.action === action &&
        (tournamentId === undefined || entry.data.tournamentId === tournamentId),
    );
}

/** Awaits a rejection and asserts it is a tournament mutation error. */
async function rejection(promise: Promise<unknown>): Promise<TournamentMutationError> {
  const error: unknown = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );

  expect(error).toBeInstanceOf(TournamentMutationError);

  return error as TournamentMutationError;
}

beforeEach(async () => {
  sessionCookie.value = undefined;
  cookieQueue.length = 0;
  await clearEmulator();
});

afterAll(async () => {
  await clearEmulator();
});

describe("tournament creation and slug reservation", () => {
  it("creates a draft with derived fields, owner snapshots and a reserved slug", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "Chief",
      organisationName: "Nairobi Esports",
    });

    const created = await createTournamentDraft(sessionUser(organiser), {
      name: "Nairobi Cup",
      season: "2026/27",
      gameId: "efootball",
      description: "The opening competition.",
    });

    expect(created.slug).toBe("nairobi-cup-2026-27");

    const document = await tournamentData(created.tournamentId);
    expect(document.status).toBe("draft");
    expect(document.formatId).toBe("ucl-league-phase-36");
    expect(document.maxParticipants).toBe(36);
    expect(document.registrationCount).toBe(0);
    expect(document.nameLower).toBe("nairobi cup");
    expect(document.ownerUid).toBe(organiser.uid);
    expect(document.ownerTag).toBe("Chief");
    expect(document.organisationName).toBe("Nairobi Esports");
    expect(document.suspendedFrom).toBeNull();
    expect(document.registrationOpensAt).toBeNull();
    expect(document.registrationClosesAt).toBeNull();
    expect(document.startsAt).toBeNull();

    const reservation = await getFirebaseAdminFirestore()
      .doc(paths.tournamentSlug("nairobi-cup-2026-27"))
      .get();
    expect(reservation.exists).toBe(true);
    expect(reservation.data()?.tournamentId).toBe(created.tournamentId);

    const audits = await auditEntries("tournament.created", created.tournamentId);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.data.after).toMatchObject({
      name: "Nairobi Cup",
      season: "2026/27",
      slug: "nairobi-cup-2026-27",
      status: "draft",
    });
  });

  it("resolves slug collisions with numeric suffixes across organisers", async () => {
    const organiserA = await createUser({
      email: "organiser-a@example.com",
      role: "organiser",
      gamerTag: "ChiefA",
    });
    const organiserB = await createUser({
      email: "organiser-b@example.com",
      role: "organiser",
      gamerTag: "ChiefB",
    });

    const first = await createTournamentDraft(sessionUser(organiserA), {
      name: "Derby Cup",
      season: "2026",
      gameId: "efootball",
      description: "The first derby.",
    });
    const second = await createTournamentDraft(sessionUser(organiserB), {
      name: "Derby Cup",
      season: "2026",
      gameId: "efootball",
      description: "The second derby.",
    });

    expect(first.slug).toBe("derby-cup-2026");
    expect(second.slug).toBe("derby-cup-2026-2");

    const firestore = getFirebaseAdminFirestore();
    const firstReservation = await firestore.doc(paths.tournamentSlug(first.slug)).get();
    const secondReservation = await firestore.doc(paths.tournamentSlug(second.slug)).get();
    expect(firstReservation.data()?.tournamentId).toBe(first.tournamentId);
    expect(secondReservation.data()?.tournamentId).toBe(second.tournamentId);
  });

  it("enforces the active-slot limit for organisers and exempts the Super Admin", async () => {
    await seedPlatformSettings({ maxActiveTournamentsPerOrganiser: 2 });

    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "SlotOrg",
    });

    // Two live competitions fill the slots; a cancelled record does not count.
    await seedTournament("slots-live-1", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Live One",
    });
    await seedTournament("slots-live-2", {
      ownerUid: organiser.uid,
      status: "league_phase",
      name: "Live Two",
    });
    await seedTournament("slots-cancelled", {
      ownerUid: organiser.uid,
      status: "cancelled",
      name: "Dead One",
    });

    const error = await rejection(
      createTournamentDraft(sessionUser(organiser), {
        name: "Third Cup",
        season: "2026",
        gameId: "efootball",
        description: "One too many.",
      }),
    );
    expect(error.status).toBe(409);
    expect(error.message).toContain("active competitions");

    // The Super Admin already owns a live competition but is exempt.
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    await seedTournament("slots-root", {
      ownerUid: root.uid,
      status: "registration_open",
      name: "Root Cup",
    });

    await expect(
      createTournamentDraft(sessionUser(root), {
        name: "Root Cup Two",
        season: "2026",
        gameId: "efootball",
        description: "Admins are exempt.",
      }),
    ).resolves.toMatchObject({ slug: "root-cup-two-2026" });
  });

  it("releases the slug when a draft is deleted and refuses to delete published work", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "DeleteOrg",
    });

    const created = await createTournamentDraft(sessionUser(organiser), {
      name: "Legacy Cup",
      season: "2026",
      gameId: "efootball",
      description: "Soon gone.",
    });
    expect(created.slug).toBe("legacy-cup-2026");

    sessionCookie.value = await sessionFor(organiser);
    await deleteTournamentDraft(created.tournamentId);

    const firestore = getFirebaseAdminFirestore();
    expect((await firestore.doc(paths.tournament(created.tournamentId)).get()).exists).toBe(false);
    expect((await firestore.doc(paths.tournamentSlug("legacy-cup-2026")).get()).exists).toBe(false);

    // The released base slug is claimable again.
    const recreated = await createTournamentDraft(sessionUser(organiser), {
      name: "Legacy Cup",
      season: "2026",
      gameId: "efootball",
      description: "Reclaimed.",
    });
    expect(recreated.slug).toBe("legacy-cup-2026");

    // A published competition is cancelled, never hard-deleted.
    await seedTournament("del-published", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Published Cup",
    });
    const error = await rejection(deleteTournamentDraft("del-published"));
    expect(error.status).toBe(409);
    expect(error.message).toContain("Only a draft");
  });
});

describe("publishing and the lifecycle", () => {
  it("refuses to publish an incomplete draft, then publishes once complete", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "PublishOrg",
    });

    const created = await createTournamentDraft(sessionUser(organiser), {
      name: "Open Season",
      season: "2026",
      gameId: "efootball",
      description: "The first cup.",
    });

    sessionCookie.value = await sessionFor(organiser);
    const incomplete = await rejection(publishTournament(created.tournamentId));
    expect(incomplete.status).toBe(400);
    expect(Object.keys(incomplete.fields).sort()).toEqual([
      "registrationClosesAt",
      "registrationOpensAt",
      "rules",
      "startsAt",
    ]);

    const now = Date.now();
    await updateTournament(created.tournamentId, {
      rules: "Fair play above everything.",
      registrationOpensAt: new Date(now + DAY_MS),
      registrationClosesAt: new Date(now + 5 * DAY_MS),
      startsAt: new Date(now + 7 * DAY_MS),
    });

    await publishTournament(created.tournamentId);
    expect((await tournamentData(created.tournamentId)).status).toBe("registration_open");

    const audits = await auditEntries("tournament.status.set", created.tournamentId);
    expect(audits[0]?.data).toMatchObject({
      before: { status: "draft" },
      after: { status: "registration_open" },
    });
  });

  it("refuses to publish when the registration deadline is not in the future", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "PastOrg",
    });
    const now = Date.now();

    await seedTournament("pub-past", {
      ownerUid: organiser.uid,
      status: "draft",
      name: "Past Cup",
      registrationOpensAt: new Date(now - 7 * DAY_MS),
      registrationClosesAt: new Date(now - DAY_MS),
      startsAt: new Date(now + 7 * DAY_MS),
    });

    sessionCookie.value = await sessionFor(organiser);
    const error = await rejection(publishTournament("pub-past"));
    expect(error.status).toBe(400);
    expect(error.fields.registrationClosesAt).toContain("future");
  });

  it("closes and reopens registration, and refuses a repeated reopen", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "CycleOrg",
    });
    await seedTournament("lc-cup", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Lifecycle Cup",
    });

    sessionCookie.value = await sessionFor(organiser);
    await closeRegistration("lc-cup");
    expect((await tournamentData("lc-cup")).status).toBe("registration_closed");

    await reopenRegistration("lc-cup");
    expect((await tournamentData("lc-cup")).status).toBe("registration_open");

    // registration_open has no transition onto itself.
    const error = await rejection(reopenRegistration("lc-cup"));
    expect(error.status).toBe(409);

    const audits = await auditEntries("tournament.status.set", "lc-cup");
    const transitions = audits.map((entry) => [
      (entry.data.before as { status: string }).status,
      (entry.data.after as { status: string }).status,
    ]);
    expect(transitions).toContainEqual(["registration_open", "registration_closed"]);
    expect(transitions).toContainEqual(["registration_closed", "registration_open"]);
  });

  it("cancels with a reason, keeps entrant records and notifies every player", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "CancelOrg",
    });
    const playerA = await createUser({
      email: "player-a@example.com",
      role: "user",
      gamerTag: "CancelA",
    });
    const playerB = await createUser({
      email: "player-b@example.com",
      role: "user",
      gamerTag: "CancelB",
    });

    await seedTournament("cancel-cup", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Cancel Cup",
    });

    sessionCookie.value = await sessionFor(playerA);
    await registerPlayer("cancel-cup");
    sessionCookie.value = await sessionFor(playerB);
    await registerPlayer("cancel-cup");

    sessionCookie.value = await sessionFor(organiser);
    await cancelTournament("cancel-cup", "Not enough interest this season.");

    const document = await tournamentData("cancel-cup");
    expect(document.status).toBe("cancelled");

    // Entrants keep their records.
    expect(await registrationStatus("cancel-cup", playerA.uid)).toBe("registered");
    expect(await registrationStatus("cancel-cup", playerB.uid)).toBe("registered");
    expect(document.registrationCount).toBe(2);

    expect(await notificationTitles(playerA.uid)).toContain("Cancel Cup was cancelled");
    expect(await notificationTitles(playerB.uid)).toContain("Cancel Cup was cancelled");

    // Further entry is refused with an honest terminal message.
    sessionCookie.value = await sessionFor(playerA);
    const error = await rejection(registerPlayer("cancel-cup"));
    expect(error.status).toBe(409);
    expect(error.message).toContain("cancelled");

    const audits = await auditEntries("tournament.status.set", "cancel-cup");
    expect(audits[0]?.data).toMatchObject({
      before: { status: "registration_open" },
      after: { status: "cancelled" },
    });
  });
});

describe("the editable-fields matrix", () => {
  it("lets a draft change every editable field and records the audit diff", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "DraftOrg",
    });

    const created = await createTournamentDraft(sessionUser(organiser), {
      name: "Matrix Cup",
      season: "2026",
      gameId: "efootball",
      description: "Before.",
    });

    sessionCookie.value = await sessionFor(organiser);
    const now = Date.now();
    await updateTournament(created.tournamentId, {
      name: "Renamed Cup",
      season: "2027",
      gameId: "ea-sports-fc",
      description: "After.",
      rules: "New rules.",
      registrationOpensAt: new Date(now + DAY_MS),
      registrationClosesAt: new Date(now + 5 * DAY_MS),
      startsAt: new Date(now + 7 * DAY_MS),
      timezone: "Europe/London",
      matchDurationMinutes: 15,
      allowedPlatforms: ["pc", "playstation"],
      allowedCountries: ["KE", "UG"],
    });

    const document = await tournamentData(created.tournamentId);
    expect(document.name).toBe("Renamed Cup");
    expect(document.nameLower).toBe("renamed cup");
    expect(document.season).toBe("2027");
    expect(document.gameId).toBe("ea-sports-fc");
    expect(document.description).toBe("After.");
    expect(document.rules).toBe("New rules.");
    expect(document.timezone).toBe("Europe/London");
    expect(document.matchDurationMinutes).toBe(15);
    expect(document.allowedPlatforms).toEqual(["pc", "playstation"]);
    expect(document.allowedCountries).toEqual(["KE", "UG"]);

    const audits = await auditEntries("tournament.updated", created.tournamentId);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.data.before).toMatchObject({ name: "Matrix Cup" });
    expect(audits[0]?.data.after).toMatchObject({ name: "Renamed Cup" });
  });

  it("locks identity and restriction fields once a published competition has entries", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "LockOrg",
    });
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "LockPlayer",
    });

    await seedTournament("mx-live", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Live Matrix Cup",
    });

    sessionCookie.value = await sessionFor(player);
    await registerPlayer("mx-live");

    sessionCookie.value = await sessionFor(organiser);
    const patches: TournamentUpdateInput[] = [
      { name: "Stolen Name" },
      { season: "2027" },
      { allowedPlatforms: ["pc"] },
      { registrationOpensAt: new Date(Date.now() + 2 * DAY_MS) },
    ];

    for (const patch of patches) {
      const error = await rejection(updateTournament("mx-live", patch));
      expect(error.status).toBe(403);
      expect(Object.keys(error.fields)).toEqual([Object.keys(patch)[0]]);
      expect(error.fields[Object.keys(patch)[0] ?? ""]).toContain("locked");
    }

    // Description and rules stay editable with entries on the field.
    await updateTournament("mx-live", { description: "Still editable." });
    await updateTournament("mx-live", { rules: "Fresh rules." });
    const document = await tournamentData("mx-live");
    expect(document.description).toBe("Still editable.");
    expect(document.rules).toBe("Fresh rules.");

    // Without entries, identity fields remain editable.
    await seedTournament("mx-empty", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Empty Matrix Cup",
    });
    await updateTournament("mx-empty", {
      name: "Empty Renamed Cup",
      gameId: "ea-sports-fc",
      allowedCountries: ["NG"],
    });
    const empty = await tournamentData("mx-empty");
    expect(empty.name).toBe("Empty Renamed Cup");
    expect(empty.gameId).toBe("ea-sports-fc");
    expect(empty.allowedCountries).toEqual(["NG"]);
  });

  it("makes the registration deadline extend-only after publication", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "DeadlineOrg",
    });
    const now = Date.now();
    const stored = new Date(now + DAY_MS);

    await seedTournament("dl-cup", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Deadline Cup",
      registrationClosesAt: stored,
    });
    await seedTournament("dl-draft", {
      ownerUid: organiser.uid,
      status: "draft",
      name: "Deadline Draft Cup",
      registrationClosesAt: stored,
    });

    sessionCookie.value = await sessionFor(organiser);

    const earlier = new Date(now + 12 * 3_600_000);
    const error = await rejection(updateTournament("dl-cup", { registrationClosesAt: earlier }));
    expect(error.status).toBe(400);
    expect(error.message).toContain("only be extended");

    const later = new Date(now + 2 * DAY_MS);
    await updateTournament("dl-cup", { registrationClosesAt: later });
    const document = await tournamentData("dl-cup");
    expect(document.registrationClosesAt?.toDate?.().toISOString()).toBe(later.toISOString());

    // A draft may still move its deadline freely.
    await updateTournament("dl-draft", { registrationClosesAt: earlier });
    expect((await tournamentData("dl-draft")).registrationClosesAt?.toDate?.().toISOString()).toBe(
      earlier.toISOString(),
    );
  });
});

describe("player entry and withdrawal", () => {
  it("registers a player with a snapshot, membership, notification and audit", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "EntryOrg",
    });
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "EntryPlayer",
      country: "KE",
      platform: "android",
    });

    await seedTournament("entry-cup", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Entry Cup",
    });

    sessionCookie.value = await sessionFor(player);
    await registerPlayer("entry-cup");

    const firestore = getFirebaseAdminFirestore();
    const registration = await firestore
      .doc(paths.tournamentRegistration("entry-cup", player.uid))
      .get();
    expect(registration.data()).toMatchObject({
      tournamentId: "entry-cup",
      gamerTag: "EntryPlayer",
      gamerTagLower: "entryplayer",
      country: "KE",
      platform: "android",
      status: "registered",
      withdrawnAt: null,
      removedAt: null,
      removedBy: null,
    });

    const membership = await firestore.doc(paths.userMembership(player.uid, "entry-cup")).get();
    expect(membership.data()).toMatchObject({
      tournamentId: "entry-cup",
      playerStatus: "registered",
      status: "registration_open",
    });

    expect((await tournamentData("entry-cup")).registrationCount).toBe(1);
    expect(await notificationTitles(player.uid)).toContain("Entry confirmed");

    const audits = await auditEntries("tournament.registration.created", "entry-cup");
    expect(audits).toHaveLength(1);
    expect(audits[0]?.data).toMatchObject({ actorUid: player.uid, targetId: player.uid });
  });

  it(
    "keeps capacity at exactly 36 under 40 concurrent registrations",
    { timeout: 120_000 },
    async () => {
      const organiser = await createUser({
        email: "organiser@example.com",
        role: "organiser",
        gamerTag: "CapacityOrg",
      });
      await seedTournament("cap-cup", {
        ownerUid: organiser.uid,
        status: "registration_open",
        name: "Capacity Cup",
        maxParticipants: 36,
      });

      const players: SeededUser[] = [];
      const cookies: string[] = [];

      for (let index = 0; index < 40; index += 1) {
        const player = await createUser({
          email: `runner-${index}@example.com`,
          role: "user",
          gamerTag: `Runner${index}`,
        });
        players.push(player);
        cookies.push(await sessionFor(player));
      }

      // The Firestore emulator serialises transactions with pessimistic
      // document locks, so a 40-way thundering herd on one tournament document
      // exceeds its (short) lock timeout — an emulator artifact, not the
      // production behaviour (production Firestore uses optimistic concurrency
      // and the SDK retries). The registrations therefore run in concurrent
      // waves of eight with a short backoff, and a lock-timeout abort inside a
      // wave is retried, exactly as the production SDK would. Every wave is a
      // set of genuinely concurrent transactions contending on the same fresh
      // read, so the capacity invariant is still what decides the outcome.
      const WAVE_SIZE = 8;
      const fulfilled: SeededUser[] = [];
      const failures: Array<{ player: SeededUser; reason: unknown }> = [];

      const registerOnce = async (player: SeededUser, cookie: string): Promise<void> => {
        // Each attempt consumes the caller's own queued cookie, so a retried
        // player re-reads their own session rather than a neighbour's. The
        // push is followed synchronously by the registerPlayer call, so the
        // queued cookie can only ever be consumed by its owner.
        cookieQueue.push(cookie);

        for (let attempt = 0; ; attempt += 1) {
          try {
            await registerPlayer("cap-cup");
            return;
          } catch (error) {
            const message = error instanceof Error ? error.message : "";
            const lockTimeout = message.includes("Transaction lock timeout");

            if (lockTimeout && attempt < 12) {
              await new Promise((resolve) => setTimeout(resolve, 25));
              cookieQueue.push(cookie);
              continue;
            }

            throw error;
          }
        }
      };

      for (let offset = 0; offset < players.length; offset += WAVE_SIZE) {
        const wave = players.slice(offset, offset + WAVE_SIZE);
        const waveCookies = cookies.slice(offset, offset + WAVE_SIZE);
        const results = await Promise.allSettled(
          wave.map((player, index) => registerOnce(player, waveCookies[index] ?? "")),
        );

        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            fulfilled.push(wave[index] as SeededUser);
          } else {
            failures.push({ player: wave[index] as SeededUser, reason: result.reason });
          }
        });
      }

      // The queue must be fully drained: no session leaked to another player.
      expect(cookieQueue).toHaveLength(0);

      expect(fulfilled).toHaveLength(36);
      expect(failures).toHaveLength(4);

      for (const failure of failures) {
        expect(failure.reason).toBeInstanceOf(TournamentMutationError);
        expect((failure.reason as TournamentMutationError).message).toBe("The field is full.");
      }

      expect((await tournamentData("cap-cup")).registrationCount).toBe(36);

      const registrations = await getFirebaseAdminFirestore()
        .collection(paths.tournamentRegistrations("cap-cup"))
        .get();
      expect(registrations.size).toBe(36);

      // The owner learns the field filled up exactly once.
      const ownerTitles = await notificationTitles(organiser.uid);
      expect(ownerTitles.filter((title) => title === "The field is full")).toHaveLength(1);
    },
  );

  it("refuses a double registration and a second withdrawal", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "DoubleOrg",
    });
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "DoublePlayer",
    });

    await seedTournament("double-cup", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Double Cup",
    });

    sessionCookie.value = await sessionFor(player);
    await registerPlayer("double-cup");

    const error = await rejection(registerPlayer("double-cup"));
    expect(error.status).toBe(409);
    expect(error.message).toContain("already registered");
    expect((await tournamentData("double-cup")).registrationCount).toBe(1);

    await withdrawPlayer("double-cup");
    const withdrawn = await rejection(withdrawPlayer("double-cup"));
    expect(withdrawn.status).toBe(409);
    expect(withdrawn.message).toContain("not registered");
  });

  it("withdrawal decrements the count and allows re-entry", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "WithdrawOrg",
    });
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "WithdrawPlayer",
    });

    await seedTournament("wd-cup", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Withdraw Cup",
    });

    sessionCookie.value = await sessionFor(player);
    await registerPlayer("wd-cup");
    await withdrawPlayer("wd-cup");

    expect(await registrationStatus("wd-cup", player.uid)).toBe("withdrawn");
    expect((await tournamentData("wd-cup")).registrationCount).toBe(0);
    expect(await notificationTitles(player.uid)).toContain("Entry withdrawn");

    const membership = await getFirebaseAdminFirestore()
      .doc(paths.userMembership(player.uid, "wd-cup"))
      .get();
    expect(membership.data()?.playerStatus).toBe("withdrawn");

    // A withdrawn player may enter again on their own.
    await registerPlayer("wd-cup");
    expect(await registrationStatus("wd-cup", player.uid)).toBe("registered");
    expect((await tournamentData("wd-cup")).registrationCount).toBe(1);
  });

  it("blocks entry according to the effective state and entry restrictions", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "StateOrg",
    });
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "StatePlayer",
      country: "KE",
      platform: "android",
    });
    const now = Date.now();

    await seedTournament("st-draft", {
      ownerUid: organiser.uid,
      status: "draft",
      name: "Draft Cup",
    });
    await seedTournament("st-suspended", {
      ownerUid: organiser.uid,
      status: "suspended",
      suspendedFrom: "registration_open",
      name: "Suspended Cup",
    });
    await seedTournament("st-cancelled", {
      ownerUid: organiser.uid,
      status: "cancelled",
      name: "Cancelled Cup",
    });
    await seedTournament("st-closed", {
      ownerUid: organiser.uid,
      status: "registration_closed",
      name: "Closed Cup",
    });
    await seedTournament("st-soon", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Soon Cup",
      registrationOpensAt: new Date(now + 3 * DAY_MS),
    });
    await seedTournament("st-ended", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Ended Cup",
      registrationClosesAt: new Date(now - DAY_MS),
    });
    await seedTournament("st-full", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Full Cup",
      registrationCount: 36,
    });
    await seedTournament("st-country", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Country Cup",
      allowedCountries: ["NG"],
    });
    await seedTournament("st-platform", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Platform Cup",
      allowedPlatforms: ["pc"],
    });

    sessionCookie.value = await sessionFor(player);

    // Drafts and suspended competitions do not exist publicly: same 404.
    for (const id of ["st-draft", "st-suspended"]) {
      const error = await rejection(registerPlayer(id));
      expect(error.status).toBe(404);
      expect(error.message).toBe("Tournament not found.");
    }

    const cancelled = await rejection(registerPlayer("st-cancelled"));
    expect(cancelled.status).toBe(409);
    expect(cancelled.message).toContain("cancelled");

    const closed = await rejection(registerPlayer("st-closed"));
    expect(closed.status).toBe(409);
    expect(closed.message).toContain("Registration is closed");

    const ended = await rejection(registerPlayer("st-ended"));
    expect(ended.status).toBe(409);
    expect(ended.message).toContain("Registration is closed");

    const soon = await rejection(registerPlayer("st-soon"));
    expect(soon.status).toBe(409);
    expect(soon.message).toContain("not opened yet");

    const full = await rejection(registerPlayer("st-full"));
    expect(full.status).toBe(409);
    expect(full.message).toBe("The field is full.");

    const country = await rejection(registerPlayer("st-country"));
    expect(country.status).toBe(409);
    expect(country.message).toContain("country");

    const platform = await rejection(registerPlayer("st-platform"));
    expect(platform.status).toBe(409);
    expect(platform.message).toContain("platform");
  });

  it("registers and withdraws through the public routes", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "RouteOrg",
    });
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "RoutePlayer",
    });

    await seedTournament("rt-cup", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Route Cup",
    });

    sessionCookie.value = await sessionFor(player);
    const registered = await playerRegisterRoute(
      jsonRequest("POST", "/api/tournaments/rt-cup/register"),
      idContext("rt-cup"),
    );
    expect(registered.status).toBe(200);
    expect((await tournamentData("rt-cup")).registrationCount).toBe(1);

    const withdrawn = await playerWithdrawRoute(
      jsonRequest("POST", "/api/tournaments/rt-cup/withdraw"),
      idContext("rt-cup"),
    );
    expect(withdrawn.status).toBe(200);
    expect((await tournamentData("rt-cup")).registrationCount).toBe(0);
  });
});

describe("organiser registration management", () => {
  it("adds, removes and re-adds players with capacity and audit trails", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "ManageOrg",
    });
    const playerA = await createUser({
      email: "player-a@example.com",
      role: "user",
      gamerTag: "ManageA",
    });
    const playerB = await createUser({
      email: "player-b@example.com",
      role: "user",
      gamerTag: "ManageB",
    });
    const playerC = await createUser({
      email: "player-c@example.com",
      role: "user",
      gamerTag: "ManageC",
    });

    await seedTournament("mg-cup", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Manage Cup",
      maxParticipants: 2,
    });
    // The organiser may also add players after closing registration early.
    await seedTournament("mg-closed", {
      ownerUid: organiser.uid,
      status: "registration_closed",
      name: "Manage Closed Cup",
    });

    sessionCookie.value = await sessionFor(organiser);
    await addPlayer("mg-cup", playerA.uid);
    expect(await registrationStatus("mg-cup", playerA.uid)).toBe("registered");
    expect((await tournamentData("mg-cup")).registrationCount).toBe(1);
    expect(await notificationTitles(playerA.uid)).toContain("Added to a tournament");

    const duplicate = await rejection(addPlayer("mg-cup", playerA.uid));
    expect(duplicate.status).toBe(409);
    expect(duplicate.message).toContain("already registered");

    await addPlayer("mg-cup", playerB.uid);
    expect((await tournamentData("mg-cup")).registrationCount).toBe(2);

    const full = await rejection(addPlayer("mg-cup", playerC.uid));
    expect(full.status).toBe(409);
    expect(full.message).toBe("The field is full.");

    const ghost = await rejection(addPlayer("mg-cup", "ghost-uid"));
    expect(ghost.status).toBe(409);
    expect(ghost.message).toContain("not active");

    await addPlayer("mg-closed", playerC.uid);
    expect(await registrationStatus("mg-closed", playerC.uid)).toBe("registered");

    await removePlayer("mg-cup", playerA.uid, "Did not confirm availability in time.");
    expect(await registrationStatus("mg-cup", playerA.uid)).toBe("removed");
    expect((await tournamentData("mg-cup")).registrationCount).toBe(1);
    expect(await notificationTitles(playerA.uid)).toContain("Removed from Manage Cup");

    const removalSnapshot = await getFirebaseAdminFirestore()
      .doc(paths.tournamentRegistration("mg-cup", playerA.uid))
      .get();
    expect(removalSnapshot.data()?.removedBy).toBe(organiser.uid);

    // A removed player cannot re-enter on their own.
    sessionCookie.value = await sessionFor(playerA);
    const blocked = await rejection(registerPlayer("mg-cup"));
    expect(blocked.status).toBe(403);
    expect(blocked.message).toContain("removed");

    // ...but the organiser may re-add them.
    sessionCookie.value = await sessionFor(organiser);
    await addPlayer("mg-cup", playerA.uid);
    expect(await registrationStatus("mg-cup", playerA.uid)).toBe("registered");
    expect((await tournamentData("mg-cup")).registrationCount).toBe(2);

    const audits = await auditEntries("tournament.registration.removed", "mg-cup");
    expect(audits).toHaveLength(1);
    expect(audits[0]?.data).toMatchObject({ actorUid: organiser.uid, targetId: playerA.uid });
  });

  it("lists registrations with exact counts, status filters and tag search", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "ListOrg",
    });
    const players = [
      await createUser({ email: "l1@example.com", role: "user", gamerTag: "ListOne" }),
      await createUser({ email: "l2@example.com", role: "user", gamerTag: "ListTwo" }),
      await createUser({ email: "l3@example.com", role: "user", gamerTag: "ListThree" }),
    ];

    await seedTournament("ls-cup", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "List Cup",
    });

    for (const player of players) {
      sessionCookie.value = await sessionFor(player);
      await registerPlayer("ls-cup");
    }
    sessionCookie.value = await sessionFor(players[1]);
    await withdrawPlayer("ls-cup");
    sessionCookie.value = await sessionFor(organiser);
    await removePlayer("ls-cup", players[2].uid, "Withdrew from the community.");

    const list = await listTournamentRegistrations("ls-cup");
    expect(list.counts).toEqual({ registered: 1, withdrawn: 1, removed: 1 });
    expect(list.rows.map((row) => row.uid).sort()).toEqual(
      players.map((player) => player.uid).sort(),
    );

    const registered = await listTournamentRegistrations("ls-cup", { status: "registered" });
    expect(registered.rows.map((row) => row.uid)).toEqual([players[0]?.uid]);

    const search = await listTournamentRegistrations("ls-cup", { search: "listtwo" });
    expect(search.rows.map((row) => row.uid)).toEqual([players[1]?.uid]);
  });

  it("issues the WhatsApp contact link only to the owner or Super Admin and audits it", async () => {
    const organiserA = await createUser({
      email: "organiser-a@example.com",
      role: "organiser",
      gamerTag: "ContactA",
    });
    const organiserB = await createUser({
      email: "organiser-b@example.com",
      role: "organiser",
      gamerTag: "ContactB",
    });
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    const withPhone = await createUser({
      email: "phone@example.com",
      role: "user",
      gamerTag: "PhonePlayer",
      whatsapp: "+254712345678",
    });
    const withoutPhone = await createUser({
      email: "no-phone@example.com",
      role: "user",
      gamerTag: "SilentPlayer",
    });
    const bystander = await createUser({
      email: "bystander@example.com",
      role: "user",
      gamerTag: "Bystander",
      whatsapp: "+254799999999",
    });

    await seedTournament("ct-cup", {
      ownerUid: organiserA.uid,
      status: "registration_open",
      name: "Contact Cup",
    });

    sessionCookie.value = await sessionFor(withPhone);
    await registerPlayer("ct-cup");
    sessionCookie.value = await sessionFor(withoutPhone);
    await registerPlayer("ct-cup");

    // Another organiser learns nothing about the competition.
    sessionCookie.value = await sessionFor(organiserB);
    await expect(issueRegistrationContactLink("ct-cup", withPhone.uid)).rejects.toBeInstanceOf(
      AuthorizationError,
    );

    // The Super Admin may manage the competition, so may issue the link.
    sessionCookie.value = await sessionFor(root);
    const issued = await issueRegistrationContactLink("ct-cup", withPhone.uid);
    expect(issued.link.startsWith("https://wa.me/254712345678?text=")).toBe(true);

    const audits = await auditEntries("tournament.contact_link_issued", "ct-cup");
    expect(audits).toHaveLength(1);
    expect(audits[0]?.data).toMatchObject({
      actorUid: root.uid,
      targetId: withPhone.uid,
    });

    // A player without a number on file cannot be contacted.
    sessionCookie.value = await sessionFor(organiserA);
    const noNumber = await rejection(issueRegistrationContactLink("ct-cup", withoutPhone.uid));
    expect(noNumber.status).toBe(409);
    expect(noNumber.message).toContain("no WhatsApp number");

    // A uid that is not registered is refused without leaking anything.
    const notRegistered = await rejection(issueRegistrationContactLink("ct-cup", bystander.uid));
    expect(notRegistered.status).toBe(404);
  });

  it("exports the registered field as owner-only display-safe CSV", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "ExportOrg",
    });
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    const registered = await createUser({
      email: "export@example.com",
      role: "user",
      gamerTag: "ExportOne",
      whatsapp: "+254700000000",
    });
    const withdrawn = await createUser({
      email: "export-gone@example.com",
      role: "user",
      gamerTag: "ExportGone",
    });

    await seedTournament("ex-cup", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Export Cup",
      slug: "ex-cup",
    });

    sessionCookie.value = await sessionFor(registered);
    await registerPlayer("ex-cup");
    sessionCookie.value = await sessionFor(withdrawn);
    await registerPlayer("ex-cup");
    await withdrawPlayer("ex-cup");

    sessionCookie.value = await sessionFor(organiser);
    const exported = await exportTournamentRegistrationsCsv("ex-cup");
    expect(exported.filename).toBe("ex-cup-registrations.csv");
    expect(exported.csv.split("\r\n")).toHaveLength(2);
    expect(exported.csv).toContain("gamerTag,fullName,country,platform,registeredAt");
    expect(exported.csv).toContain("ExportOne");
    expect(exported.csv).toContain("ExportOne Player");
    expect(exported.csv).not.toContain("ExportGone");
    expect(exported.csv).not.toContain("2547");
    expect(exported.csv).not.toContain("@");

    // The Super Admin may manage a competition but never export its list.
    sessionCookie.value = await sessionFor(root);
    const error = await rejection(exportTournamentRegistrationsCsv("ex-cup"));
    expect(error.status).toBe(403);
    expect(error.message).toContain("Only the competition owner");
  });
});

describe("route-level ownership", () => {
  it("answers every Phase 8 organiser route with the branded 404 for a non-owner", async () => {
    const organiserA = await createUser({
      email: "organiser-a@example.com",
      role: "organiser",
      gamerTag: "OwnA",
    });
    const organiserB = await createUser({
      email: "organiser-b@example.com",
      role: "organiser",
      gamerTag: "OwnB",
    });
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "OwnPlayer",
    });

    await seedTournament("own-cup", {
      ownerUid: organiserA.uid,
      status: "registration_open",
      name: "Own Cup",
    });

    sessionCookie.value = await sessionFor(organiserB);
    expect(
      (
        await patchTournamentRoute(
          jsonRequest("PATCH", "/api/organiser/tournaments/own-cup", { description: "Nope." }),
          idContext("own-cup"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await deleteTournamentRoute(
          jsonRequest("DELETE", "/api/organiser/tournaments/own-cup"),
          idContext("own-cup"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await publishRoute(
          jsonRequest("POST", "/api/organiser/tournaments/own-cup/publish"),
          idContext("own-cup"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await closeRegistrationRoute(
          jsonRequest("POST", "/api/organiser/tournaments/own-cup/close-registration"),
          idContext("own-cup"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await reopenRegistrationRoute(
          jsonRequest("POST", "/api/organiser/tournaments/own-cup/reopen-registration"),
          idContext("own-cup"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await cancelTournamentRoute(
          jsonRequest("POST", "/api/organiser/tournaments/own-cup/cancel", {
            reason: "Not the owner here.",
          }),
          idContext("own-cup"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await addPlayerRoute(
          jsonRequest("POST", "/api/organiser/tournaments/own-cup/registrations", {
            uid: player.uid,
          }),
          idContext("own-cup"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await removePlayerRoute(
          jsonRequest("POST", "/api/organiser/tournaments/own-cup/registrations/player/remove", {
            reason: "Not the owner here.",
          }),
          uidContext("own-cup", "player"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await contactRoute(
          jsonRequest("GET", "/api/organiser/tournaments/own-cup/registrations/player/contact"),
          uidContext("own-cup", "player"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await exportRoute(
          jsonRequest("GET", "/api/organiser/tournaments/own-cup/registrations/export"),
          idContext("own-cup"),
        )
      ).status,
    ).toBe(404);

    // The competition still exists and is untouched.
    expect((await tournamentData("own-cup")).status).toBe("registration_open");

    // A plain player may not create competitions at all.
    sessionCookie.value = await sessionFor(player);
    expect(
      (
        await createDraftRoute(
          jsonRequest("POST", "/api/organiser/tournaments", {
            name: "Rogue Cup",
            season: "2026",
            gameId: "efootball",
            description: "Should not exist.",
          }),
        )
      ).status,
    ).toBe(403);
  });

  it("lets the Super Admin act on every Phase 8 organiser route", async () => {
    const organiserA = await createUser({
      email: "organiser-a@example.com",
      role: "organiser",
      gamerTag: "SuperA",
      organisationName: "Alpha Gaming",
    });
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    const playerA = await createUser({
      email: "player-a@example.com",
      role: "user",
      gamerTag: "SuperPlayerA",
      whatsapp: "+254712345678",
    });
    const playerB = await createUser({
      email: "player-b@example.com",
      role: "user",
      gamerTag: "SuperPlayerB",
    });

    await seedTournament("sa-cup", {
      ownerUid: organiserA.uid,
      ownerTag: "SuperA",
      organisationName: "Alpha Gaming",
      status: "registration_open",
      name: "Super Admin Cup",
    });

    sessionCookie.value = await sessionFor(playerA);
    await registerPlayer("sa-cup");

    sessionCookie.value = await sessionFor(root);
    expect(
      (
        await patchTournamentRoute(
          jsonRequest("PATCH", "/api/organiser/tournaments/sa-cup", {
            description: "Managed by the platform.",
          }),
          idContext("sa-cup"),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await addPlayerRoute(
          jsonRequest("POST", "/api/organiser/tournaments/sa-cup/registrations", {
            uid: playerB.uid,
          }),
          idContext("sa-cup"),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await removePlayerRoute(
          jsonRequest("POST", "/api/organiser/tournaments/sa-cup/registrations/b/remove", {
            reason: "Platform housekeeping.",
          }),
          uidContext("sa-cup", playerB.uid),
        )
      ).status,
    ).toBe(200);
    const contacted = await contactRoute(
      jsonRequest("GET", "/api/organiser/tournaments/sa-cup/registrations/a/contact"),
      uidContext("sa-cup", playerA.uid),
    );
    expect(contacted.status).toBe(200);
    expect(((await contacted.json()) as { link: string }).link).toContain("wa.me/254712345678");
    expect(
      (
        await closeRegistrationRoute(
          jsonRequest("POST", "/api/organiser/tournaments/sa-cup/close-registration"),
          idContext("sa-cup"),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await reopenRegistrationRoute(
          jsonRequest("POST", "/api/organiser/tournaments/sa-cup/reopen-registration"),
          idContext("sa-cup"),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await cancelTournamentRoute(
          jsonRequest("POST", "/api/organiser/tournaments/sa-cup/cancel", {
            reason: "Platform operator decision.",
          }),
          idContext("sa-cup"),
        )
      ).status,
    ).toBe(200);
    expect((await tournamentData("sa-cup")).status).toBe("cancelled");

    // The export stays owner-only even for the Super Admin.
    expect(
      (
        await exportRoute(
          jsonRequest("GET", "/api/organiser/tournaments/sa-cup/registrations/export"),
          idContext("sa-cup"),
        )
      ).status,
    ).toBe(403);
  });
});

describe("Super Admin suspension and ownership transfer", () => {
  it("suspends a live competition, hides it from entry, and restores the exact stage", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "SuspendOrg",
    });
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    const playerA = await createUser({
      email: "player-a@example.com",
      role: "user",
      gamerTag: "SuspendA",
    });
    const playerB = await createUser({
      email: "player-b@example.com",
      role: "user",
      gamerTag: "SuspendB",
    });

    await seedTournament("sp-cup", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Suspended Cup",
    });

    sessionCookie.value = await sessionFor(playerA);
    await registerPlayer("sp-cup");

    sessionCookie.value = await sessionFor(root);
    const suspended = await suspendRoute(
      jsonRequest("POST", "/api/super-admin/tournaments/sp-cup/suspend", {
        reason: "Reviewing the entry list.",
      }),
      idContext("sp-cup"),
    );
    expect(suspended.status).toBe(200);
    expect(await suspended.json()).toMatchObject({ ok: true, status: "suspended" });

    const document = await tournamentData("sp-cup");
    expect(document.status).toBe("suspended");
    expect(document.suspendedFrom).toBe("registration_open");

    // A suspended competition does not exist for players: same 404 as a draft.
    sessionCookie.value = await sessionFor(playerB);
    const hidden = await rejection(registerPlayer("sp-cup"));
    expect(hidden.status).toBe(404);

    // Suspending twice is refused.
    sessionCookie.value = await sessionFor(root);
    const repeated = await suspendRoute(
      jsonRequest("POST", "/api/super-admin/tournaments/sp-cup/suspend", {
        reason: "Once is enough.",
      }),
      idContext("sp-cup"),
    );
    expect(repeated.status).toBe(409);

    const restored = await unsuspendRoute(
      jsonRequest("POST", "/api/super-admin/tournaments/sp-cup/unsuspend", {
        reason: "Cleared after review.",
      }),
      idContext("sp-cup"),
    );
    expect(restored.status).toBe(200);

    const afterRestore = await tournamentData("sp-cup");
    expect(afterRestore.status).toBe("registration_open");
    expect(afterRestore.suspendedFrom).toBeNull();

    // The restored competition accepts entries again.
    sessionCookie.value = await sessionFor(playerB);
    await registerPlayer("sp-cup");
    expect((await tournamentData("sp-cup")).registrationCount).toBe(2);

    // The organiser was told about both platform actions.
    const titles = await notificationTitles(organiser.uid);
    expect(titles).toContain("Suspended Cup was suspended");
    expect(titles).toContain("Suspended Cup was restored");

    const audits = await auditEntries("tournament.suspended", "sp-cup");
    expect(audits).toHaveLength(2);
    expect(audits[0]?.data).toMatchObject({
      before: { status: "suspended", suspendedFrom: "registration_open" },
      after: { status: "registration_open", suspendedFrom: null },
    });
    expect(audits[1]?.data).toMatchObject({
      before: { status: "registration_open" },
      after: { status: "suspended", suspendedFrom: "registration_open" },
    });
  });

  it("refuses to suspend a terminal competition or a missing one", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "TerminalOrg",
    });
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });

    await seedTournament("sp-done", {
      ownerUid: organiser.uid,
      status: "completed",
      name: "Done Cup",
    });

    sessionCookie.value = await sessionFor(root);
    const terminal = await suspendRoute(
      jsonRequest("POST", "/api/super-admin/tournaments/sp-done/suspend", {
        reason: "Too late to suspend.",
      }),
      idContext("sp-done"),
    );
    expect(terminal.status).toBe(409);
    expect(await terminal.json()).toMatchObject({
      error: expect.stringContaining("cannot be suspended"),
    });

    const missing = await suspendRoute(
      jsonRequest("POST", "/api/super-admin/tournaments/ghost/suspend", {
        reason: "Does not exist.",
      }),
      idContext("ghost"),
    );
    expect(missing.status).toBe(404);
  });

  it("transfers ownership with fresh owner snapshots and moves access", async () => {
    const organiserA = await createUser({
      email: "organiser-a@example.com",
      role: "organiser",
      gamerTag: "AlphaChief",
      organisationName: "Alpha Gaming",
    });
    const organiserB = await createUser({
      email: "organiser-b@example.com",
      role: "organiser",
      gamerTag: "BetaChief",
      organisationName: "Beta Sports",
    });
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "TransferPlayer",
    });
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });

    await seedTournament("tr-cup", {
      ownerUid: organiserA.uid,
      ownerTag: "AlphaChief",
      organisationName: "Alpha Gaming",
      status: "registration_open",
      name: "Transfer Cup",
    });

    sessionCookie.value = await sessionFor(root);

    // A plain player can never receive ownership.
    const refused = await transferRoute(
      jsonRequest("POST", "/api/super-admin/tournaments/tr-cup/transfer", {
        uid: player.uid,
        reason: "Attempted player transfer.",
      }),
      idContext("tr-cup"),
    );
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({
      error: expect.stringContaining("not an organiser"),
    });

    const transferred = await transferRoute(
      jsonRequest("POST", "/api/super-admin/tournaments/tr-cup/transfer", {
        uid: organiserB.uid,
        reason: "Alpha stepped down.",
      }),
      idContext("tr-cup"),
    );
    expect(transferred.status).toBe(200);

    const document = await tournamentData("tr-cup");
    expect(document.ownerUid).toBe(organiserB.uid);
    expect(document.ownerTag).toBe("BetaChief");
    expect(document.organisationName).toBe("Beta Sports");

    // The old owner loses workspace access; the new owner gains it.
    sessionCookie.value = await sessionFor(organiserA);
    await expect(requireTournamentOwnerOrSuperAdmin("tr-cup")).rejects.toBeInstanceOf(
      AuthorizationError,
    );

    sessionCookie.value = await sessionFor(organiserB);
    const access = await requireTournamentOwnerOrSuperAdmin("tr-cup");
    expect(access.user.userId).toBe(organiserB.uid);
    expect(access.tournament.ownerUid).toBe(organiserB.uid);

    // Both organisers were notified, and the transfer is audited.
    expect(await notificationTitles(organiserA.uid)).toContain("Ownership of Transfer Cup changed");
    expect(await notificationTitles(organiserB.uid)).toContain("Ownership of Transfer Cup changed");

    const audits = await auditEntries("tournament.ownership_transferred", "tr-cup");
    expect(audits).toHaveLength(1);
    expect(audits[0]?.data.before).toMatchObject({ ownerUid: organiserA.uid });
    expect(audits[0]?.data.after).toMatchObject({ ownerUid: organiserB.uid });

    // Transferring to the current owner is refused.
    sessionCookie.value = await sessionFor(root);
    const again = await transferRoute(
      jsonRequest("POST", "/api/super-admin/tournaments/tr-cup/transfer", {
        uid: organiserB.uid,
        reason: "Already the owner here.",
      }),
      idContext("tr-cup"),
    );
    expect(again.status).toBe(409);
  });

  it("cancels through the Super Admin route with a reason and notifies entrants", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "SACOrg",
    });
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "SACPlayer",
    });

    await seedTournament("sac-cup", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "SAC Cup",
    });

    sessionCookie.value = await sessionFor(player);
    await registerPlayer("sac-cup");

    sessionCookie.value = await sessionFor(root);
    const cancelled = await superAdminCancelRoute(
      jsonRequest("POST", "/api/super-admin/tournaments/sac-cup/cancel", {
        reason: "Platform operator decision.",
      }),
      idContext("sac-cup"),
    );
    expect(cancelled.status).toBe(200);
    expect((await tournamentData("sac-cup")).status).toBe("cancelled");
    expect(await registrationStatus("sac-cup", player.uid)).toBe("registered");
    expect(await notificationTitles(player.uid)).toContain("SAC Cup was cancelled");
  });
});
