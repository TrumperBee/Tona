// GCC - emulator-backed integration tests for self-service account deletion.
//
// Exercises the real route, the real session guard, the Firebase Auth emulator
// and Firestore. These tests verify that deletion removes identity data, keeps
// the sporting record, refuses privileged/active-organiser accounts, and that a
// suspended account loses access on the next request.
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

import { DELETE as deleteAccount } from "@/app/api/profile/account/route";
import { getCurrentUser } from "@/lib/auth/guards";
import { registerPlayer } from "@/lib/auth/registration";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { EMPTY_PROFILE_STATS } from "@/types/domain";
import type { RegistrationInput } from "@/lib/validation/registration";

const PASSWORD = "correct horse battery";
const SUPER_ADMIN_EMAIL = "owner@example.com";
const SUPER_ADMIN_UID = "integration-super-admin";

function playerInput(overrides: Partial<RegistrationInput> = {}): RegistrationInput {
  return {
    fullName: "Amani Otieno",
    gamerTag: "Striker_9",
    email: "striker@example.com",
    password: PASSWORD,
    whatsapp: "0712345678",
    country: "KE",
    preferredGame: "efootball",
    platform: "android",
    acceptTerms: true,
    ...overrides,
  };
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
    paths.tournaments(),
    paths.auditLogs(),
    paths.platformSettings(),
    paths.rateLimits(),
  ]) {
    const snapshot = await firestore.collection(collection).get();

    for (const document of snapshot.docs) {
      await firestore.recursiveDelete(document.ref);
    }
  }

  sessionCookie.value = undefined;
}

async function authUserExists(uid: string): Promise<boolean> {
  try {
    await getFirebaseAdminAuth().getUser(uid);
    return true;
  } catch {
    return false;
  }
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

async function useFreshSession(email: string): Promise<void> {
  const idToken = await signInIdToken(email);
  sessionCookie.value = await getFirebaseAdminAuth().createSessionCookie(idToken, {
    expiresIn: 60 * 60 * 1000,
  });
}

function deleteRequest(origin?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/profile/account", {
    method: "DELETE",
    headers: origin ? { origin } : {},
  });
}

async function seedCompetitionHistory(uid: string, gamerTag: string): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const now = new Date();

  await Promise.all([
    firestore.doc(paths.tournament("cup-1")).set({
      name: "Season Cup",
      ownerUid: "another-owner",
      status: "registration_open",
      createdAt: now,
    }),
    firestore.doc(paths.userMembership(uid, "cup-1")).set({
      tournamentId: "cup-1",
      status: "registered",
      registeredAt: now,
    }),
    firestore.doc(paths.tournamentRegistration("cup-1", uid)).set({
      gamerTag,
      gamerTagLower: gamerTag.toLowerCase(),
      country: "KE",
      platform: "android",
      avatarUrl: "https://cdn.example.invalid/avatar.jpg",
      status: "registered",
      registeredAt: now,
    }),
    firestore.doc(paths.publicProfileHistoryEntry(uid, "cup-1")).set({
      tournamentId: "cup-1",
      tournamentName: "Season Cup",
      gamerTag,
      position: 3,
      createdAt: now,
    }),
  ]);
}

async function seedPinnedSuperAdmin(): Promise<void> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();
  const record = await auth.createUser({
    uid: SUPER_ADMIN_UID,
    email: SUPER_ADMIN_EMAIL,
    password: PASSWORD,
    displayName: "Owner",
  });
  await auth.setCustomUserClaims(record.uid, { role: "super_admin" });

  const now = new Date();
  await Promise.all([
    firestore.doc(paths.user(record.uid)).set({
      fullName: "GCC Owner",
      gamerTag: "Owner",
      gamerTagLower: "owner",
      email: SUPER_ADMIN_EMAIL,
      whatsappE164: "+254700000000",
      country: "KE",
      preferredGame: "efootball",
      platform: "android",
      community: null,
      favouriteClub: null,
      photoUrl: null,
      avatarUrl: null,
      avatarPublicId: null,
      role: "super_admin",
      status: "active",
      createdAt: now,
      updatedAt: now,
    }),
    firestore.doc(paths.publicProfile(record.uid)).set({
      gamerTag: "Owner",
      gamerTagLower: "owner",
      country: "KE",
      preferredGame: "efootball",
      platform: "android",
      community: null,
      favouriteClub: null,
      photoUrl: null,
      avatarUrl: null,
      avatarPublicId: null,
      status: "active",
      stats: EMPTY_PROFILE_STATS,
    }),
  ]);
}

beforeEach(clearEmulator);

afterAll(clearEmulator);

describe("DELETE /api/profile/account", () => {
  it("removes identity data, anonymises the public profile and registrations, and keeps history", async () => {
    const { uid } = await registerPlayer(playerInput());
    const firestore = getFirebaseAdminFirestore();
    await seedCompetitionHistory(uid, "Striker_9");
    await firestore.doc(paths.user(uid)).update({
      avatarUrl: "https://cdn.example.invalid/avatar.jpg",
      avatarPublicId: `gcc/avatars/${uid}`,
    });
    await useFreshSession("striker@example.com");

    const response = await deleteAccount(deleteRequest("http://localhost:3000"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      deleted: true,
      signedOut: true,
      uid,
      previousGamerTag: "Striker_9",
    });
    expect(response.cookies.get("gcc_session")?.value).toBe("");
    expect(await authUserExists(uid)).toBe(false);

    const privateData = (await firestore.doc(paths.user(uid)).get()).data();
    expect(privateData).toMatchObject({
      deleted: true,
      email: null,
      fullName: null,
      whatsappE164: null,
      community: null,
      favouriteClub: null,
      photoUrl: null,
      avatarUrl: null,
      avatarPublicId: null,
      gamerTag: "Striker_9",
    });

    const publicData = (await firestore.doc(paths.publicProfile(uid)).get()).data();
    expect(publicData).toMatchObject({
      deleted: true,
      gamerTag: "Deleted player",
      gamerTagLower: "deleted player",
      avatarUrl: null,
      community: null,
      favouriteClub: null,
      status: "active",
      stats: EMPTY_PROFILE_STATS,
    });

    const registration = (
      await firestore.doc(paths.tournamentRegistration("cup-1", uid)).get()
    ).data();
    expect(registration).toMatchObject({
      gamerTag: "Deleted player",
      gamerTagLower: "deleted player",
      avatarUrl: null,
      status: "registered",
    });

    // History and the tag reservation are intentionally untouched.
    expect(
      (await firestore.doc(paths.publicProfileHistoryEntry(uid, "cup-1")).get()).data()?.gamerTag,
    ).toBe("Striker_9");
    const reservation = await firestore.doc(paths.gamerTag("striker_9")).get();
    expect(reservation.exists).toBe(true);
    expect(reservation.data()?.uid).toBe(uid);

    const logs = await firestore
      .collection(paths.auditLogs())
      .where("action", "==", "user.account.deleted")
      .get();
    expect(logs.size).toBe(1);
    expect(logs.docs[0].data()).toMatchObject({ actorUid: uid, actorRole: "user", targetId: uid });
    expect(JSON.stringify(logs.docs[0].data())).not.toContain("striker@example.com");
  });

  it("blocks the configured Super Admin", async () => {
    await seedPinnedSuperAdmin();
    await useFreshSession(SUPER_ADMIN_EMAIL);

    const response = await deleteAccount(deleteRequest("http://localhost:3000"));

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("configured Super Admin account");
    expect(await authUserExists(SUPER_ADMIN_UID)).toBe(true);
  });

  it("blocks an organiser who still owns an active tournament", async () => {
    const { uid } = await registerPlayer(playerInput());
    await getFirebaseAdminAuth().setCustomUserClaims(uid, { role: "organiser" });
    await getFirebaseAdminFirestore().doc(paths.tournament("live-cup")).set({
      name: "Live Cup",
      ownerUid: uid,
      status: "fixtures_published",
    });
    await useFreshSession("striker@example.com");

    const response = await deleteAccount(deleteRequest("http://localhost:3000"));

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("active tournaments");
    expect(await authUserExists(uid)).toBe(true);
  });

  it("limits repeated deletion attempts per user with a Retry-After header", async () => {
    await seedPinnedSuperAdmin();
    await useFreshSession(SUPER_ADMIN_EMAIL);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const blocked = await deleteAccount(deleteRequest("http://localhost:3000"));
      expect(blocked.status).toBe(403);
    }

    const limited = await deleteAccount(deleteRequest("http://localhost:3000"));
    expect(limited.status).toBe(429);
    const retryAfter = limited.headers.get("Retry-After");
    expect(retryAfter).toMatch(/^\d+$/);
    expect(Number(retryAfter)).toBeGreaterThan(0);
    expect(await authUserExists(SUPER_ADMIN_UID)).toBe(true);
  });

  it("rejects cross-origin and missing sessions without deleting anything", async () => {
    const { uid } = await registerPlayer(playerInput());
    await useFreshSession("striker@example.com");

    const crossOrigin = await deleteAccount(deleteRequest("https://attacker.invalid"));
    expect(crossOrigin.status).toBe(403);

    sessionCookie.value = undefined;
    const anonymous = await deleteAccount(deleteRequest("http://localhost:3000"));
    expect(anonymous.status).toBe(401);
    expect(await authUserExists(uid)).toBe(true);
  });

  it("drops a suspended account's access on the very next request", async () => {
    const { uid } = await registerPlayer(playerInput());
    await useFreshSession("striker@example.com");

    expect(await getCurrentUser()).toMatchObject({ userId: uid, role: "user" });

    await getFirebaseAdminFirestore().doc(paths.user(uid)).update({ status: "suspended" });

    expect(await getCurrentUser()).toBeNull();
    const response = await deleteAccount(deleteRequest("http://localhost:3000"));
    expect(response.status).toBe(401);
    expect(await authUserExists(uid)).toBe(true);
  });
});
