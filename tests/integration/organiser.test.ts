// GCC - emulator-backed integration tests for the Phase 7 organiser workspace.
//
// These tests exercise the real session guard, the real Firestore documents and
// the real organiser endpoints against the Auth and Firestore emulators. The
// workspace layout maps every guard failure to the branded 404, so ownership
// is verified here at the guard level: a non-owner and a missing id must both
// throw exactly the errors the layout converts to notFound().
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Route handlers and page guards read the session through next/headers.
// Outside a Next.js request there is no cookie store, so the test supplies one.
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

import { PATCH as updateOrganiserProfileRoute } from "@/app/api/organiser/profile/route";
import {
  AuthorizationError,
  NotFoundError,
  requireUser,
  requireTournamentOwnerOrSuperAdmin,
} from "@/lib/auth/guards";
import { requirePageRole } from "@/lib/auth/page-access";
import { getPublicTournamentsByOwner } from "@/lib/data/public-tournaments";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { ensureOrganiserProfile, getOrganiserProfile } from "@/lib/organiser/profile";
import { getOrganiserOverview } from "@/lib/organiser/overview";
import { listOrganiserTournaments } from "@/lib/organiser/tournaments";
import type { AuditLogDocument, TournamentStatus } from "@/types/domain";

const PASSWORD = "correct horse battery";
const SUPER_ADMIN_EMAIL = "owner@example.com";
const SUPER_ADMIN_UID = "integration-super-admin";

interface SeededUser {
  readonly uid: string;
  readonly email: string;
}

async function clearEmulator(): Promise<void> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();

  const users = await auth.listUsers(1000);
  if (users.users.length > 0) {
    await auth.deleteUsers(users.users.map((user) => user.uid));
  }

  // Tournaments own registration subcollections in Phase 8, so they are
  // removed recursively before the rest of the top-level collections.
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
  await Promise.all([
    firestore.doc(paths.user(record.uid)).set({
      fullName: `${options.gamerTag} Player`,
      gamerTag: options.gamerTag,
      gamerTagLower: options.gamerTag.toLowerCase(),
      email: options.email,
      whatsappE164: null,
      country: "KE",
      preferredGame: "efootball",
      platform: "android",
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
      country: "KE",
      preferredGame: "efootball",
      platform: "android",
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

function jsonRequest(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function auditEntries(): Promise<Array<{ id: string; data: AuditLogDocument }>> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.auditLogs())
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((document) => ({
    id: document.id,
    data: document.data() as AuditLogDocument,
  }));
}

interface TournamentSeed {
  readonly ownerUid: string;
  readonly ownerTag?: string;
  readonly organisationName?: string;
  readonly status: TournamentStatus;
  readonly name: string;
  readonly slug?: string;
  readonly startsAt?: Date | null;
  readonly updatedAt?: Date;
  readonly registrationCount?: number;
  readonly maxParticipants?: number;
  readonly registrationOpensAt?: Date | null;
  readonly registrationClosesAt?: Date | null;
  readonly allowedPlatforms?: readonly string[] | null;
  readonly allowedCountries?: readonly string[] | null;
  readonly suspendedFrom?: TournamentStatus | null;
}

/**
 * Writes a real Phase 8 tournament document the way the creation flow does.
 * Owner snapshots are copied at creation so public surfaces never need a join.
 */
async function createTournament(tournamentId: string, seed: TournamentSeed): Promise<void> {
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
    description: "Integration test competition.",
    gameId: "efootball",
    formatId: "ucl-league-phase-36",
    coverImageUrl: null,
    coverImagePublicId: null,
    logoUrl: null,
    logoPublicId: null,
    rules: "Fair play above everything.",
    matchDurationMinutes: 10,
    timezone: "Africa/Nairobi",
    registrationOpensAt: new Date(now.getTime() - 7 * 86_400_000),
    registrationClosesAt:
      seed.registrationClosesAt === undefined ? null : seed.registrationClosesAt,
    startsAt:
      seed.startsAt === undefined ? new Date(now.getTime() + 7 * 86_400_000) : seed.startsAt,
    maxParticipants: seed.maxParticipants ?? 36,
    registrationCount: seed.registrationCount ?? 0,
    status: seed.status,
    suspendedFrom: seed.suspendedFrom ?? null,
    season: "2026",
    allowedPlatforms: seed.allowedPlatforms ?? null,
    allowedCountries: seed.allowedCountries ?? null,
    createdAt: now,
    updatedAt: seed.updatedAt ?? now,
  });

  // The creation flow reserves every slug in the same transaction.
  await firestore.doc(paths.tournamentSlug(slug)).set({
    tournamentId,
    name: seed.name,
    createdAt: now,
  });
}

beforeEach(async () => {
  sessionCookie.value = undefined;
  await clearEmulator();
});

afterAll(async () => {
  await clearEmulator();
});

describe("tournament workspace access", () => {
  it("grants the owner and the Super Admin, and denies another organiser, a plain user and a missing id", async () => {
    const organiserA = await createUser({
      email: "organiser-a@example.com",
      role: "organiser",
      gamerTag: "OrganiserA",
    });
    const organiserB = await createUser({
      email: "organiser-b@example.com",
      role: "organiser",
      gamerTag: "OrganiserB",
    });
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "Player",
    });
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    await createTournament("ws-owned", {
      ownerUid: organiserA.uid,
      status: "registration_open",
      name: "Guard Cup",
    });

    sessionCookie.value = await sessionFor(organiserA);
    const owner = await requireTournamentOwnerOrSuperAdmin("ws-owned");
    expect(owner.user.userId).toBe(organiserA.uid);
    expect(owner.tournament.ownerUid).toBe(organiserA.uid);
    expect(owner.tournament.name).toBe("Guard Cup");

    // Another organiser and a plain user hit the same 403 the layout turns
    // into the branded 404, so neither learns that the competition exists.
    sessionCookie.value = await sessionFor(organiserB);
    await expect(requireTournamentOwnerOrSuperAdmin("ws-owned")).rejects.toBeInstanceOf(
      AuthorizationError,
    );

    sessionCookie.value = await sessionFor(player);
    await expect(requireTournamentOwnerOrSuperAdmin("ws-owned")).rejects.toBeInstanceOf(
      AuthorizationError,
    );

    sessionCookie.value = await sessionFor(root);
    const admin = await requireTournamentOwnerOrSuperAdmin("ws-owned");
    expect(admin.user.isSuperAdmin).toBe(true);
    expect(admin.tournament.name).toBe("Guard Cup");

    await expect(requireTournamentOwnerOrSuperAdmin("does-not-exist")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("redirects unauthenticated and wrong-role visitors away from organiser pages", async () => {
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "Player",
    });

    // Unauthenticated: sent to sign-in, with the requested path preserved.
    const anonymous = await requirePageRole("organiser", "/organiser").catch(
      (error: unknown) => error,
    );

    expect(anonymous).toBeInstanceOf(Error);
    expect((anonymous as { digest?: string }).digest).toContain("NEXT_REDIRECT");
    expect((anonymous as { digest?: string }).digest).toContain("/login?next=%2Forganiser");

    // Signed in as a plain participant: sent to their own workspace.
    sessionCookie.value = await sessionFor(player);
    const redirect = await requirePageRole("organiser", "/organiser").catch(
      (error: unknown) => error,
    );

    expect(redirect).toBeInstanceOf(Error);
    expect((redirect as { digest?: string }).digest).toContain("NEXT_REDIRECT");
    expect((redirect as { digest?: string }).digest).toContain("/dashboard");
  });
});

describe("organiser dashboard overview", () => {
  it("counts slots, statuses, registrations and attention items from real documents", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "Organiser",
    });

    await createTournament("ov-open", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Open Cup",
      registrationCount: 4,
      registrationClosesAt: new Date(Date.now() + 12 * 3_600_000),
    });
    await createTournament("ov-full-open", {
      ownerUid: organiser.uid,
      status: "registration_open",
      name: "Full Open Cup",
      registrationCount: 36,
    });
    await createTournament("ov-closed-full", {
      ownerUid: organiser.uid,
      status: "registration_closed",
      name: "Closed Full Cup",
      registrationCount: 36,
    });
    await createTournament("ov-draft", {
      ownerUid: organiser.uid,
      status: "draft",
      name: "Draft Cup",
    });
    await createTournament("ov-suspended", {
      ownerUid: organiser.uid,
      status: "suspended",
      name: "Suspended Cup",
    });
    await createTournament("ov-done", {
      ownerUid: organiser.uid,
      status: "completed",
      name: "Done Cup",
      registrationCount: 10,
    });
    await createTournament("ov-cancelled", {
      ownerUid: organiser.uid,
      status: "cancelled",
      name: "Cancelled Cup",
    });

    sessionCookie.value = await sessionFor(organiser);
    const user = await requireUser();
    const overview = await getOrganiserOverview(user);

    // Registration-open through knockout occupy a slot: three here.
    expect(overview.totalTournaments).toBe(7);
    expect(overview.activeSlots).toBe(3);
    expect(overview.totalRegistrations).toBe(86);
    expect(overview.statusCounts).toMatchObject({
      draft: 1,
      registration_open: 2,
      registration_closed: 1,
      suspended: 1,
      completed: 1,
      cancelled: 1,
      archived: 0,
      pots_confirmed: 0,
      fixtures_published: 0,
      league_phase: 0,
      knockout: 0,
    });

    // platformSettings is absent, so the documented default applies.
    expect(overview.maxActiveSlots).toBe(3);
    expect(overview.exemptFromSlotLimit).toBe(false);

    const attentionKinds = overview.attention.map((item) => item.kind).sort();
    expect(attentionKinds).toEqual(["closing-soon", "full-open", "full-unconfirmed", "suspended"]);

    const closing = overview.attention.find((item) => item.kind === "closing-soon");
    expect(closing?.tournamentName).toBe("Open Cup");

    // No privileged actions were recorded against these competitions.
    expect(overview.recentAudit).toEqual([]);
  });

  it("exempts the Super Admin from the slot limit", async () => {
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });

    sessionCookie.value = await sessionFor(root);
    const user = await requireUser();
    const overview = await getOrganiserOverview(user);

    expect(overview.exemptFromSlotLimit).toBe(true);
    expect(overview.totalTournaments).toBe(0);
    expect(overview.activeSlots).toBe(0);
  });
});

describe("organiser tournament list", () => {
  it("stays owner-scoped, filters by status and name, and pages one cursor at a time", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "Organiser",
    });
    const other = await createUser({
      email: "other@example.com",
      role: "organiser",
      gamerTag: "Other",
    });

    const names = ["Cup One", "Cup Two", "Cup Three", "Cup Four", "Cup Five", "Cup Six"];
    for (const [index, name] of names.entries()) {
      await createTournament(`list-${index}`, {
        ownerUid: organiser.uid,
        status: index === 5 ? "draft" : "registration_open",
        name,
        updatedAt: new Date(Date.UTC(2026, 0, 1 + index)),
      });
    }
    await createTournament("list-other", {
      ownerUid: other.uid,
      status: "registration_open",
      name: "Someone Elses Cup",
    });

    const first = await listOrganiserTournaments(organiser.uid, { pageSize: 5 });
    expect(first.total).toBe(6);
    expect(first.rows).toHaveLength(5);
    expect(first.hasMore).toBe(true);
    // Most recently updated first; the other organiser's cup is never listed.
    expect(first.rows.map((row) => row.name)).toEqual([
      "Cup Six",
      "Cup Five",
      "Cup Four",
      "Cup Three",
      "Cup Two",
    ]);

    const second = await listOrganiserTournaments(organiser.uid, {
      pageSize: 5,
      after: first.lastId,
    });
    expect(second.rows.map((row) => row.name)).toEqual(["Cup One"]);
    expect(second.hasMore).toBe(false);

    const back = await listOrganiserTournaments(organiser.uid, {
      pageSize: 5,
      before: second.firstId,
    });
    expect(back.rows.map((row) => row.name)).toEqual(first.rows.map((row) => row.name));

    const drafts = await listOrganiserTournaments(organiser.uid, { status: "draft" });
    expect(drafts.rows.map((row) => row.name)).toEqual(["Cup Six"]);

    const search = await listOrganiserTournaments(organiser.uid, { search: "Cup Fi" });
    expect(search.rows.map((row) => row.name)).toEqual(["Cup Five"]);
  });
});

describe("public organiser page data", () => {
  it("lists only publicly visible competitions and pages one cursor at a time", async () => {
    const organiser = await createUser({
      email: "public-owner@example.com",
      role: "organiser",
      gamerTag: "PublicOwner",
    });

    for (let index = 0; index < 10; index += 1) {
      await createTournament(`pub-${index}`, {
        ownerUid: organiser.uid,
        status: index % 2 === 0 ? "registration_open" : "completed",
        name: `Public Cup ${index}`,
        startsAt: new Date(Date.UTC(2026, 0, 1 + index)),
        updatedAt: new Date(Date.UTC(2026, 0, 1 + index)),
      });
    }
    await createTournament("pub-draft", {
      ownerUid: organiser.uid,
      status: "draft",
      name: "Draft Cup",
      startsAt: new Date(Date.UTC(2026, 0, 20)),
      updatedAt: new Date(Date.UTC(2026, 0, 20)),
    });
    await createTournament("pub-cancelled", {
      ownerUid: organiser.uid,
      status: "cancelled",
      name: "Cancelled Cup",
      startsAt: new Date(Date.UTC(2026, 0, 21)),
      updatedAt: new Date(Date.UTC(2026, 0, 21)),
    });

    const empty = await getPublicTournamentsByOwner("no-such-organiser");
    expect(empty.rows).toEqual([]);
    expect(empty.hasMore).toBe(false);

    const first = await getPublicTournamentsByOwner(organiser.uid, null);
    // Cancelled competitions are excluded like drafts; ADR-044 keeps them as
    // direct-link notice pages only. The cancelled cup (latest updatedAt)
    // would otherwise sort first, so its absence proves the exclusion.
    expect(first.rows.map((row) => row.slug)).toEqual([
      "public-cup-9",
      "public-cup-8",
      "public-cup-7",
      "public-cup-6",
      "public-cup-5",
      "public-cup-4",
      "public-cup-3",
      "public-cup-2",
      "public-cup-1",
    ]);
    expect(first.rows.map((row) => row.slug)).not.toContain("cancelled-cup");
    expect(first.hasMore).toBe(true);
    expect(first.rows.every((row) => row.ownerUid === organiser.uid)).toBe(true);

    const second = await getPublicTournamentsByOwner(organiser.uid, first.lastId);
    expect(second.rows.map((row) => row.slug)).toEqual(["public-cup-0"]);
    expect(second.hasMore).toBe(false);

    // An unknown cursor degrades to an honest empty page rather than crashing.
    const unknown = await getPublicTournamentsByOwner(organiser.uid, "no-such-tournament");
    expect(unknown.rows).toEqual([]);
  });
});

describe("organiser profile bootstrap", () => {
  it("prefills from the latest approved application and falls back to the public gamer tag", async () => {
    const withApplications = await createUser({
      email: "applications@example.com",
      role: "organiser",
      gamerTag: "AppOrg",
    });
    const tagged = await createUser({
      email: "tagged@example.com",
      role: "organiser",
      gamerTag: "Tagged",
    });
    const firestore = getFirebaseAdminFirestore();
    const now = new Date();

    await firestore
      .collection(paths.adminApplications())
      .doc("app-old")
      .set({
        uid: withApplications.uid,
        communityName: "Old Community",
        status: "approved",
        createdAt: new Date(now.getTime() - 86_400_000),
        updatedAt: new Date(now.getTime() - 86_400_000),
      });
    await firestore.collection(paths.adminApplications()).doc("app-new").set({
      uid: withApplications.uid,
      communityName: "New Community",
      status: "approved",
      createdAt: now,
      updatedAt: now,
    });
    await firestore
      .collection(paths.adminApplications())
      .doc("app-pending")
      .set({
        uid: withApplications.uid,
        communityName: "Pending Community",
        status: "pending",
        createdAt: new Date(now.getTime() + 1_000),
        updatedAt: new Date(now.getTime() + 1_000),
      });

    const profile = await ensureOrganiserProfile(withApplications.uid);
    expect(profile?.organisationName).toBe("New Community");

    // Idempotent: a second call returns the same document untouched.
    expect((await ensureOrganiserProfile(withApplications.uid))?.organisationName).toBe(
      "New Community",
    );

    // No applications: the public gamer tag is the honest fallback.
    expect((await ensureOrganiserProfile(tagged.uid))?.organisationName).toBe("Tagged");

    // Neither source exists: nothing is invented. A fresh organiser with no
    // approved application and no public profile gets no document at all.
    const bare = await createUser({
      email: "bare@example.com",
      role: "organiser",
      gamerTag: "Bare",
    });
    await firestore.doc(paths.publicProfile(bare.uid)).delete();
    expect(await ensureOrganiserProfile(bare.uid)).toBeNull();
    expect((await firestore.doc(paths.organiserProfile(bare.uid)).get()).exists).toBe(false);
  });
});

describe("organiser profile endpoint", () => {
  it("saves the profile through the strict endpoint, audits it and serves the public read", async () => {
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "ProfileOrg",
    });
    sessionCookie.value = await sessionFor(organiser);

    const saved = await updateOrganiserProfileRoute(
      jsonRequest("PATCH", "/api/organiser/profile", {
        organisationName: "Profile Community",
        bio: "We run monthly cups.",
        links: [{ label: "Site", url: "https://community.example" }],
      }),
    );
    expect(saved.status).toBe(200);

    const stored = await getOrganiserProfile(organiser.uid);
    expect(stored).toMatchObject({
      uid: organiser.uid,
      organisationName: "Profile Community",
      bio: "We run monthly cups.",
      logoUrl: null,
    });
    expect(stored?.links).toEqual([{ label: "Site", url: "https://community.example" }]);
    expect(stored?.createdAt).toBeInstanceOf(Date);

    const entry = (await auditEntries()).find(
      (candidate) => candidate.data.action === "organiser_profile.updated",
    );
    expect(entry?.data).toMatchObject({
      actorUid: organiser.uid,
      targetType: "organiserProfile",
      targetId: organiser.uid,
    });
  });

  it("rejects players, missing sessions, cross-origin requests and invalid payloads", async () => {
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "Player",
    });

    const unauthenticated = await updateOrganiserProfileRoute(
      jsonRequest("PATCH", "/api/organiser/profile", { organisationName: "No Session" }),
    );
    expect(unauthenticated.status).toBe(401);

    sessionCookie.value = await sessionFor(player);
    const forbidden = await updateOrganiserProfileRoute(
      jsonRequest("PATCH", "/api/organiser/profile", { organisationName: "Not An Organiser" }),
    );
    expect(forbidden.status).toBe(403);

    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "Organiser",
    });
    sessionCookie.value = await sessionFor(organiser);

    const crossOrigin = await updateOrganiserProfileRoute(
      jsonRequest(
        "PATCH",
        "/api/organiser/profile",
        { organisationName: "Evil" },
        {
          origin: "https://evil.example",
        },
      ),
    );
    expect(crossOrigin.status).toBe(403);

    const insecureLink = await updateOrganiserProfileRoute(
      jsonRequest("PATCH", "/api/organiser/profile", {
        organisationName: "Valid Name",
        links: [{ label: "Insecure", url: "http://community.example" }],
      }),
    );
    expect(insecureLink.status).toBe(400);
    expect(await insecureLink.json()).toMatchObject({
      fieldErrors: { links: expect.stringContaining("https") },
    });

    // Nothing above was persisted.
    expect(await getOrganiserProfile(organiser.uid)).toBeNull();
  });
});
