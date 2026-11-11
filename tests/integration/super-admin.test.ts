// GCC - emulator-backed integration tests for the Phase 5 Super Admin console.
//
// These tests exercise the real route handlers, the real session guard, the
// Firebase Auth emulator and Firestore. They verify that privilege is enforced
// server-side, that account status changes touch Auth and both profile
// documents, that every write is audited and that maintenance mode blocks
// non-Super-Admin writes.
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Route handlers read the session through next/headers. Outside a Next.js
// request there is no cookie store, so the test supplies one.
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

import {
  DELETE as deleteAnnouncement,
  PATCH as patchAnnouncement,
} from "@/app/api/super-admin/announcements/[id]/route";
import { POST as publishAnnouncement } from "@/app/api/super-admin/announcements/[id]/publish/route";
import { POST as unpublishAnnouncement } from "@/app/api/super-admin/announcements/[id]/unpublish/route";
import { POST as createAnnouncement } from "@/app/api/super-admin/announcements/route";
import { POST as refreshAnalytics } from "@/app/api/super-admin/analytics/refresh/route";
import { PATCH as updateSettings } from "@/app/api/super-admin/settings/route";
import { POST as revealContact } from "@/app/api/super-admin/users/[uid]/contact/route";
import { POST as changeRole } from "@/app/api/super-admin/users/[uid]/role/route";
import { POST as changeStatus } from "@/app/api/super-admin/users/[uid]/status/route";
import { PATCH as updateProfile } from "@/app/api/profile/route";
import { POST as registerRoute } from "@/app/api/auth/register/route";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import type { AuditLogDocument } from "@/types/domain";

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

  for (const collection of [
    paths.users(),
    paths.publicProfiles(),
    paths.gamerTags(),
    paths.adminApplications(),
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
  readonly whatsappE164?: string | null;
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
      whatsappE164: options.whatsappE164 ?? null,
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

beforeEach(async () => {
  sessionCookie.value = undefined;
  await clearEmulator();
});

afterAll(async () => {
  await clearEmulator();
});

describe("Super Admin route protection", () => {
  it("returns 403 for every /api/super-admin route when a participant is signed in", async () => {
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "Player",
    });
    const target = await createUser({
      email: "target@example.com",
      role: "user",
      gamerTag: "Target",
      whatsappE164: "+254712345678",
    });
    sessionCookie.value = await sessionFor(player);

    const context = (uid: string) => ({ params: Promise.resolve({ uid }) });
    const announcementContext = { params: Promise.resolve({ id: "announcement-1" }) };

    const calls = [
      () =>
        updateSettings(
          jsonRequest("PATCH", "/api/super-admin/settings", {
            maintenanceMode: false,
            maintenanceMessage: "",
            registrationsOpen: true,
            maxActiveTournamentsPerOrganiser: 3,
            applicationCooldownDays: 7,
          }),
        ),
      () =>
        changeStatus(
          jsonRequest("POST", `/api/super-admin/users/${target.uid}/status`, {
            status: "suspended",
            reason: "route protection test",
          }),
          context(target.uid),
        ),
      () =>
        changeRole(
          jsonRequest("POST", `/api/super-admin/users/${target.uid}/role`, {
            reason: "route protection test",
          }),
          context(target.uid),
        ),
      () =>
        revealContact(
          jsonRequest("POST", `/api/super-admin/users/${target.uid}/contact`),
          context(target.uid),
        ),
      () =>
        createAnnouncement(
          jsonRequest("POST", "/api/super-admin/announcements", {
            title: "Test announcement",
            body: "This should never be created.",
            severity: "info",
            pinned: false,
            expiresAt: null,
            publishNow: true,
          }),
        ),
      () =>
        patchAnnouncement(
          jsonRequest("PATCH", "/api/super-admin/announcements/announcement-1", {
            title: "Edit",
            body: "This should never be saved.",
            severity: "info",
            pinned: false,
            expiresAt: null,
          }),
          announcementContext,
        ),
      () =>
        publishAnnouncement(
          jsonRequest("POST", "/api/super-admin/announcements/announcement-1/publish"),
          announcementContext,
        ),
      () =>
        unpublishAnnouncement(
          jsonRequest("POST", "/api/super-admin/announcements/announcement-1/unpublish"),
          announcementContext,
        ),
      () =>
        deleteAnnouncement(
          jsonRequest("DELETE", "/api/super-admin/announcements/announcement-1"),
          announcementContext,
        ),
      () => refreshAnalytics(jsonRequest("POST", "/api/super-admin/analytics/refresh")),
    ];

    for (const call of calls) {
      const response = await call();
      expect(response.status).toBe(403);
    }
  });

  it("returns 401 when there is no session", async () => {
    const target = await createUser({
      email: "target@example.com",
      role: "user",
      gamerTag: "Target",
    });

    const response = await changeStatus(
      jsonRequest("POST", `/api/super-admin/users/${target.uid}/status`, {
        status: "suspended",
        reason: "route protection test",
      }),
      { params: Promise.resolve({ uid: target.uid }) },
    );

    expect(response.status).toBe(401);
  });
});

describe("account status", () => {
  it("disables Auth, mirrors status to both profiles and audits the change", async () => {
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    const target = await createUser({
      email: "target@example.com",
      role: "user",
      gamerTag: "Target",
      whatsappE164: "+254712345678",
    });
    sessionCookie.value = await sessionFor(root);

    const response = await changeStatus(
      jsonRequest("POST", `/api/super-admin/users/${target.uid}/status`, {
        status: "suspended",
        reason: "Repeated abusive messages",
      }),
      { params: Promise.resolve({ uid: target.uid }) },
    );

    expect(response.status).toBe(200);

    const authUser = await getFirebaseAdminAuth().getUser(target.uid);
    expect(authUser.disabled).toBe(true);

    const firestore = getFirebaseAdminFirestore();
    const user = (await firestore.doc(paths.user(target.uid)).get()).data();
    const publicProfile = (await firestore.doc(paths.publicProfile(target.uid)).get()).data();
    expect(user?.status).toBe("suspended");
    expect(publicProfile?.status).toBe("suspended");

    const entries = await auditEntries();
    const statusEntry = entries.find((entry) => entry.data.action === "user.status.set");
    expect(statusEntry?.data).toMatchObject({
      actorUid: root.uid,
      targetType: "user",
      targetId: target.uid,
      reason: "Repeated abusive messages",
      before: { status: "active", disabled: false },
      after: { status: "suspended", disabled: true },
    });
  });

  it("refuses to change the acting Super Admin and another Super Admin", async () => {
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    const otherSuper = await createUser({
      email: "other-super@example.com",
      role: "super_admin",
      gamerTag: "OtherOwner",
    });
    sessionCookie.value = await sessionFor(root);

    const self = await changeStatus(
      jsonRequest("POST", `/api/super-admin/users/${root.uid}/status`, {
        status: "banned",
        reason: "Should never happen",
      }),
      { params: Promise.resolve({ uid: root.uid }) },
    );
    expect(self.status).toBe(403);

    const other = await changeStatus(
      jsonRequest("POST", `/api/super-admin/users/${otherSuper.uid}/status`, {
        status: "banned",
        reason: "Should never happen",
      }),
      { params: Promise.resolve({ uid: otherSuper.uid }) },
    );
    expect(other.status).toBe(403);
  });
});

describe("role changes", () => {
  it("revokes organiser privileges, mirrors users.role and audits the reason", async () => {
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    const organiser = await createUser({
      email: "organiser@example.com",
      role: "organiser",
      gamerTag: "Organiser",
    });
    sessionCookie.value = await sessionFor(root);

    const response = await changeRole(
      jsonRequest("POST", `/api/super-admin/users/${organiser.uid}/role`, {
        reason: "Community closed",
      }),
      { params: Promise.resolve({ uid: organiser.uid }) },
    );

    expect(response.status).toBe(200);

    const authUser = await getFirebaseAdminAuth().getUser(organiser.uid);
    expect(authUser.customClaims?.role).toBe("user");

    const user = (await getFirebaseAdminFirestore().doc(paths.user(organiser.uid)).get()).data();
    expect(user?.role).toBe("user");

    const entry = (await auditEntries()).find(
      (candidate) => candidate.data.action === "user.role.set",
    );
    expect(entry?.data).toMatchObject({
      targetId: organiser.uid,
      reason: "Community closed",
      before: { role: "organiser" },
      after: { role: "user" },
    });
  });

  it("cannot be used to change a Super Admin", async () => {
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    sessionCookie.value = await sessionFor(root);

    const response = await changeRole(
      jsonRequest("POST", `/api/super-admin/users/${root.uid}/role`, {
        reason: "Should never happen",
      }),
      { params: Promise.resolve({ uid: root.uid }) },
    );

    expect(response.status).not.toBe(200);
  });
});

describe("contact reveal", () => {
  it("returns the number and audits the reveal without storing the number", async () => {
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    const target = await createUser({
      email: "target@example.com",
      role: "user",
      gamerTag: "Target",
      whatsappE164: "+254712345678",
    });
    sessionCookie.value = await sessionFor(root);

    const response = await revealContact(
      jsonRequest("POST", `/api/super-admin/users/${target.uid}/contact`),
      { params: Promise.resolve({ uid: target.uid }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ whatsapp: "+254712345678" });

    const entry = (await auditEntries()).find(
      (candidate) => candidate.data.action === "user.contact_revealed",
    );
    expect(entry?.data).toMatchObject({
      targetId: target.uid,
      after: { contactRevealed: true },
    });
    expect(JSON.stringify(entry?.data)).not.toContain("+254712345678");
  });
});

describe("settings and maintenance mode", () => {
  it("saves settings, audits the change and blocks non-Super-Admin writes", async () => {
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    const player = await createUser({
      email: "player@example.com",
      role: "user",
      gamerTag: "Player",
    });

    const playerCookie = await sessionFor(player);
    sessionCookie.value = await sessionFor(root);

    const enable = await updateSettings(
      jsonRequest("PATCH", "/api/super-admin/settings", {
        maintenanceMode: true,
        maintenanceMessage: "Back at 18:00 UTC while we deploy.",
        registrationsOpen: true,
        maxActiveTournamentsPerOrganiser: 3,
        applicationCooldownDays: 7,
        reason: "Deploying the Phase 5 console",
      }),
    );
    expect(enable.status).toBe(200);

    const stored = (
      await getFirebaseAdminFirestore().doc(paths.platformSettingsMain()).get()
    ).data();
    expect(stored).toMatchObject({
      maintenanceMode: true,
      maintenanceMessage: "Back at 18:00 UTC while we deploy.",
      updatedBy: root.uid,
    });

    const entry = (await auditEntries()).find(
      (candidate) => candidate.data.action === "platform.settings.updated",
    );
    expect(entry?.data).toMatchObject({
      targetType: "platformSettings",
      targetId: "main",
      reason: "Deploying the Phase 5 console",
    });

    // A signed-in participant is blocked with the configured message.
    sessionCookie.value = playerCookie;
    const blockedProfile = await updateProfile(
      jsonRequest("PATCH", "/api/profile", { community: "Blocked" }),
    );
    expect(blockedProfile.status).toBe(503);
    expect(await blockedProfile.json()).toMatchObject({
      error: "Back at 18:00 UTC while we deploy.",
    });

    const blockedRegistration = await registerRoute(
      jsonRequest(
        "POST",
        "/api/auth/register",
        {
          fullName: "Blocked Player",
          gamerTag: "BlockedPlayer",
          email: "blocked@example.com",
          password: "correct horse battery",
          whatsapp: "0712345678",
          country: "KE",
          preferredGame: "efootball",
          platform: "android",
          acceptTerms: true,
        },
        { "x-forwarded-for": "203.0.113.10" },
      ),
    );
    expect(blockedRegistration.status).toBe(503);

    // The Super Admin is never blocked by their own maintenance switch.
    sessionCookie.value = await sessionFor(root);
    const allowed = await updateSettings(
      jsonRequest("PATCH", "/api/super-admin/settings", {
        maintenanceMode: false,
        maintenanceMessage: "",
        registrationsOpen: true,
        maxActiveTournamentsPerOrganiser: 3,
        applicationCooldownDays: 7,
        reason: "Console verification finished",
      }),
    );
    expect(allowed.status).toBe(200);
  });
});

describe("announcements", () => {
  it("creates, edits, publishes, unpublishes and soft-deletes with audit entries", async () => {
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    sessionCookie.value = await sessionFor(root);

    const created = await createAnnouncement(
      jsonRequest("POST", "/api/super-admin/announcements", {
        title: "Registration window",
        body: "Registrations for the new season open on Monday.",
        severity: "important",
        pinned: true,
        expiresAt: null,
        publishNow: false,
      }),
    );
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const context = { params: Promise.resolve({ id }) };

    const published = await publishAnnouncement(
      jsonRequest("POST", `/api/super-admin/announcements/${id}/publish`),
      context,
    );
    expect(published.status).toBe(200);

    const edited = await patchAnnouncement(
      jsonRequest("PATCH", `/api/super-admin/announcements/${id}`, {
        title: "Registration window updated",
        body: "Registrations open on Tuesday instead.",
        severity: "info",
        pinned: false,
        expiresAt: null,
      }),
      context,
    );
    expect(edited.status).toBe(200);

    const unpublished = await unpublishAnnouncement(
      jsonRequest("POST", `/api/super-admin/announcements/${id}/unpublish`),
      context,
    );
    expect(unpublished.status).toBe(200);

    const deleted = await deleteAnnouncement(
      jsonRequest("DELETE", `/api/super-admin/announcements/${id}`),
      context,
    );
    expect(deleted.status).toBe(200);

    const document = (await getFirebaseAdminFirestore().doc(paths.announcement(id)).get()).data();
    expect(document?.deletedAt).not.toBeNull();
    expect(document?.publishedAt).toBeNull();

    const actions = (await auditEntries()).map((entry) => entry.data.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "announcement.created",
        "announcement.published",
        "announcement.updated",
        "announcement.unpublished",
        "announcement.deleted",
      ]),
    );
  });
});

describe("analytics", () => {
  it("refreshes and caches the summary document", async () => {
    const root = await createUser({
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      gamerTag: "Owner",
    });
    sessionCookie.value = await sessionFor(root);

    const response = await refreshAnalytics(
      jsonRequest("POST", "/api/super-admin/analytics/refresh"),
    );

    expect(response.status).toBe(200);

    const summary = (
      await getFirebaseAdminFirestore().doc(paths.platformStatsSummary()).get()
    ).data();
    expect(summary).toBeDefined();
    expect(summary?.totalUsers).toBeGreaterThanOrEqual(1);
  });
});
