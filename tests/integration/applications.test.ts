// GCC - emulator-backed integration tests for organiser applications.
//
// These tests use the real route handlers, session guard, Firebase Auth and
// Firestore. They cover submission limits, the rejection cooldown, the approval
// claim and rollback path, notification transitions and owner-only read state.
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sessionCookie, roleFailure } = vi.hoisted(() => ({
  sessionCookie: { value: undefined as string | undefined },
  roleFailure: { fail: false },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "gcc_session" && sessionCookie.value
        ? { name, value: sessionCookie.value }
        : undefined,
  }),
}));

vi.mock("@/lib/auth/management", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/management")>();

  return {
    ...actual,
    setUserRole: async (...args: Parameters<typeof actual.setUserRole>) => {
      if (roleFailure.fail) {
        throw new Error("Simulated custom-claim failure.");
      }

      return actual.setUserRole(...args);
    },
  };
});

import { POST as submitApplication } from "@/app/api/admin-applications/route";
import { POST as withdrawApplication } from "@/app/api/admin-applications/[id]/withdraw/route";
import { POST as markNotificationsRead } from "@/app/api/notifications/read/route";
import { POST as approveApplication } from "@/app/api/super-admin/applications/[id]/approve/route";
import { POST as rejectApplication } from "@/app/api/super-admin/applications/[id]/reject/route";
import { POST as changeRole } from "@/app/api/super-admin/users/[uid]/role/route";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { createNotification } from "@/lib/notifications";
import { requirePageRole } from "@/lib/auth/page-access";
import type { AdminApplicationDocument } from "@/types/domain";

const PASSWORD = "correct horse battery";
const SUPER_ADMIN_EMAIL = "owner@example.com";

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

  await firestore.recursiveDelete(firestore.collection(paths.users()));

  for (const collection of [
    paths.publicProfiles(),
    paths.gamerTags(),
    paths.adminApplications(),
    paths.applicationStates(),
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
  readonly emailVerified?: boolean;
}): Promise<SeededUser> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();
  const record = await auth.createUser({
    email: options.email,
    password: PASSWORD,
    emailVerified: options.emailVerified ?? true,
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
): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function applicationBody(overrides: Record<string, unknown> = {}) {
  return {
    communityName: "Lagos Elite FC",
    communityType: "online_community",
    communityLink: "https://example.com/community",
    expectedPlayers: "36-72",
    gamesPlanned: ["efootball", "ea-sports-fc"],
    experience:
      "I have organised three online leagues with more than forty players and handled fixtures, results and disputes.",
    motivation:
      "I want to build a reliable weekly competition for my community with clear rules and a permanent record of results.",
    agreesToRules: true,
    ...overrides,
  };
}

async function createSuperAdmin(): Promise<SeededUser> {
  return createUser({
    email: SUPER_ADMIN_EMAIL,
    role: "super_admin",
    gamerTag: "Owner",
  });
}

async function submitAs(user: SeededUser, overrides: Record<string, unknown> = {}) {
  sessionCookie.value = await sessionFor(user);
  return submitApplication(
    jsonRequest("POST", "/api/admin-applications", applicationBody(overrides)),
  );
}

async function applicationIdFrom(response: Response): Promise<string> {
  const payload = (await response.json()) as { id: string };
  return payload.id;
}

async function readApplication(id: string): Promise<AdminApplicationDocument> {
  const snapshot = await getFirebaseAdminFirestore().doc(paths.adminApplication(id)).get();
  return snapshot.data() as AdminApplicationDocument;
}

async function notificationsFor(uid: string) {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.userNotifications(uid))
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((document) => ({
    id: document.id,
    data: document.data() as {
      type: string;
      title: string;
      body: string;
      read: boolean;
    },
  }));
}

beforeEach(async () => {
  sessionCookie.value = undefined;
  roleFailure.fail = false;
  await clearEmulator();
});

afterAll(async () => {
  await clearEmulator();
});

describe("organiser application submission", () => {
  it("only lets a verified participant submit, and notifies the Super Admin", async () => {
    const owner = await createSuperAdmin();
    const unverified = await createUser({
      email: "unverified@example.com",
      role: "user",
      gamerTag: "Unverified",
      emailVerified: false,
    });
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "Organiser",
    });
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "Player",
    });

    expect((await submitAs(unverified)).status).toBe(403);
    expect((await submitAs(organiser)).status).toBe(403);

    const response = await submitAs(player);
    expect(response.status).toBe(201);
    const application = await readApplication(await applicationIdFrom(response));

    expect(application).toMatchObject({
      uid: player.uid,
      gamerTag: "Player",
      email: player.email,
      communityName: "Lagos Elite FC",
      communityType: "online_community",
      expectedPlayers: "36-72",
      gamesPlanned: ["efootball", "ea-sports-fc"],
      agreesToRules: true,
      status: "pending",
      reviewedBy: null,
    });

    const ownerNotifications = await notificationsFor(owner.uid);
    expect(ownerNotifications).toHaveLength(1);
    expect(ownerNotifications[0]?.data.title).toBe("New organiser application");
  });

  it("refuses a second pending application", async () => {
    const owner = await createSuperAdmin();
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "Player",
    });

    expect((await submitAs(player)).status).toBe(201);
    const duplicate = await submitAs(player);

    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error).toContain("already have a pending application");
    expect(await notificationsFor(owner.uid)).toHaveLength(1);
  });

  it("enforces the reject cooldown and exposes the reapply instant", async () => {
    const owner = await createSuperAdmin();
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "Player",
    });

    const stored = await submitAs(player);
    const id = await applicationIdFrom(stored);

    sessionCookie.value = await sessionFor(owner);
    const rejected = await rejectApplication(
      jsonRequest("POST", `/api/super-admin/applications/${id}/reject`, {
        note: "Add more detail about how you will handle disputes.",
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(rejected.status).toBe(200);

    const retry = await submitAs(player);
    expect(retry.status).toBe(409);
    const payload = (await retry.json()) as { reapplyAt?: string };
    expect(payload.reapplyAt).toBeTruthy();
    expect(new Date(payload.reapplyAt ?? 0).getTime()).toBeGreaterThan(Date.now());
  });

  it("lets the applicant withdraw a pending application", async () => {
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "Player",
    });
    const stored = await submitAs(player);
    const id = await applicationIdFrom(stored);

    const response = await withdrawApplication(
      jsonRequest("POST", `/api/admin-applications/${id}/withdraw`),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(200);
    expect((await readApplication(id)).status).toBe("withdrawn");
  });
});

describe("application review", () => {
  it("rejects non-Super-Admin review attempts", async () => {
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "Player",
    });
    const id = await applicationIdFrom(await submitAs(player));

    sessionCookie.value = await sessionFor(player);

    const approveResponse = await approveApplication(
      jsonRequest("POST", `/api/super-admin/applications/${id}/approve`, {}),
      { params: Promise.resolve({ id }) },
    );
    const rejectResponse = await rejectApplication(
      jsonRequest("POST", `/api/super-admin/applications/${id}/reject`, {
        note: "This should never be accepted.",
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(approveResponse.status).toBe(403);
    expect(rejectResponse.status).toBe(403);
  });

  it("approves once, grants the organiser claim, revokes tokens and is idempotent", async () => {
    const owner = await createSuperAdmin();
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "Player",
    });
    const id = await applicationIdFrom(await submitAs(player));

    sessionCookie.value = await sessionFor(owner);
    const approved = await approveApplication(
      jsonRequest("POST", `/api/super-admin/applications/${id}/approve`, {
        note: "Welcome aboard.",
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({ ok: true, alreadyReviewed: false });

    const application = await readApplication(id);
    expect(application.status).toBe("approved");
    expect(application.reviewedBy).toBe(owner.uid);
    expect(application.reviewNote).toBe("Welcome aboard.");

    const authUser = await getFirebaseAdminAuth().getUser(player.uid);
    expect(authUser.customClaims?.role).toBe("organiser");
    // Refresh tokens (and therefore existing session cookies) are revoked so
    // the new claim takes effect on the next sign-in. The emulator reports the
    // revocation timestamp rather than rejecting an already-issued cookie.
    expect(authUser.tokensValidAfterTime).toBeTruthy();
    const user = (await getFirebaseAdminFirestore().doc(paths.user(player.uid)).get()).data();
    expect(user?.role).toBe("organiser");

    const repeat = await approveApplication(
      jsonRequest("POST", `/api/super-admin/applications/${id}/approve`, {}),
      { params: Promise.resolve({ id }) },
    );
    expect(repeat.status).toBe(200);
    expect(await repeat.json()).toMatchObject({ alreadyReviewed: true });

    const approvedNotifications = (await notificationsFor(player.uid)).filter(
      (entry) => entry.data.title === "Organiser application approved",
    );
    expect(approvedNotifications).toHaveLength(1);
  });

  it("rolls the application back to pending when the claim fails", async () => {
    const owner = await createSuperAdmin();
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "Player",
    });
    const id = await applicationIdFrom(await submitAs(player));

    sessionCookie.value = await sessionFor(owner);
    roleFailure.fail = true;

    const response = await approveApplication(
      jsonRequest("POST", `/api/super-admin/applications/${id}/approve`, {}),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain("left pending");

    const application = await readApplication(id);
    expect(application.status).toBe("pending");
    expect(application.reviewedBy).toBeNull();

    const state = (
      await getFirebaseAdminFirestore().doc(paths.applicationState(player.uid)).get()
    ).data();
    expect(state?.status).toBe("pending");
    expect(state?.currentApplicationId).toBe(id);

    const authUser = await getFirebaseAdminAuth().getUser(player.uid);
    expect(authUser.customClaims?.role).toBe("user");
  });

  it("rejects a pending application with a required note and keeps the applicant a participant", async () => {
    const owner = await createSuperAdmin();
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "Player",
    });
    const id = await applicationIdFrom(await submitAs(player));

    sessionCookie.value = await sessionFor(owner);
    const bad = await rejectApplication(
      jsonRequest("POST", `/api/super-admin/applications/${id}/reject`, { note: "Too short" }),
      { params: Promise.resolve({ id }) },
    );
    expect(bad.status).toBe(400);

    const response = await rejectApplication(
      jsonRequest("POST", `/api/super-admin/applications/${id}/reject`, {
        note: "Please explain how you will handle disputed results.",
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(200);
    expect((await readApplication(id)).status).toBe("rejected");

    const authUser = await getFirebaseAdminAuth().getUser(player.uid);
    expect(authUser.customClaims?.role).toBe("user");

    const notifications = await notificationsFor(player.uid);
    expect(notifications[0]?.data.body).toContain("disputed results");

    const approveAgain = await approveApplication(
      jsonRequest("POST", `/api/super-admin/applications/${id}/approve`, {}),
      { params: Promise.resolve({ id }) },
    );
    expect(approveAgain.status).toBe(409);

    // The rejected applicant is still a participant and cannot enter the
    // organiser route group.
    sessionCookie.value = await sessionFor(player);
    let redirectDigest: string | undefined;

    try {
      await requirePageRole("organiser", "/organiser");
    } catch (error) {
      redirectDigest = (error as { digest?: string }).digest;
    }

    expect(redirectDigest).toContain("/dashboard");
  });

  it("marks the latest approved application revoked when the organiser role is removed", async () => {
    const owner = await createSuperAdmin();
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "Player",
    });
    const id = await applicationIdFrom(await submitAs(player));

    sessionCookie.value = await sessionFor(owner);
    await approveApplication(
      jsonRequest("POST", `/api/super-admin/applications/${id}/approve`, {}),
      {
        params: Promise.resolve({ id }),
      },
    );

    const response = await changeRole(
      jsonRequest("POST", `/api/super-admin/users/${player.uid}/role`, {
        reason: "Repeated failure to enter results.",
      }),
      { params: Promise.resolve({ uid: player.uid }) },
    );

    expect(response.status).toBe(200);
    expect((await readApplication(id)).status).toBe("revoked");

    const notifications = await notificationsFor(player.uid);
    expect(
      notifications.some((entry) => entry.data.title === "Organiser permissions revoked"),
    ).toBe(true);
  });
});

describe("notification read state", () => {
  it("marks only the caller's notifications and supports all", async () => {
    const first = await createUser({
      email: "first@example.com",
      role: "user",
      gamerTag: "First",
    });
    const second = await createUser({
      email: "second@example.com",
      role: "user",
      gamerTag: "Second",
    });

    const firstId = await createNotification(first.uid, {
      type: "system",
      title: "First message",
      body: "One.",
    });
    await createNotification(first.uid, {
      type: "system",
      title: "Second message",
      body: "Two.",
    });
    const secondId = await createNotification(second.uid, {
      type: "system",
      title: "Other user",
      body: "Three.",
    });

    sessionCookie.value = await sessionFor(first);
    const single = await markNotificationsRead(
      jsonRequest("POST", "/api/notifications/read", { ids: [firstId, secondId] }),
    );
    expect(single.status).toBe(200);
    expect(await single.json()).toMatchObject({ ok: true, updated: 1 });

    const all = await markNotificationsRead(
      jsonRequest("POST", "/api/notifications/read", { all: true }),
    );
    expect(all.status).toBe(200);

    const firstNotifications = await notificationsFor(first.uid);
    expect(firstNotifications.every((entry) => entry.data.read)).toBe(true);

    const secondNotifications = await notificationsFor(second.uid);
    expect(secondNotifications[0]?.data.read).toBe(false);
  });

  it("rejects malformed or oversized read requests", async () => {
    const user = await createUser({
      email: "user@example.com",
      role: "user",
      gamerTag: "User",
    });
    sessionCookie.value = await sessionFor(user);

    expect(
      (
        await markNotificationsRead(
          jsonRequest("POST", "/api/notifications/read", {
            ids: Array.from({ length: 51 }, (_, index) => `id-${index}`),
          }),
        )
      ).status,
    ).toBe(400);

    expect(
      (
        await markNotificationsRead(
          jsonRequest("POST", "/api/notifications/read", { ids: ["one"], all: true }),
        )
      ).status,
    ).toBe(400);
  });
});
