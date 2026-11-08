// GCC - emulator-backed integration tests for registration and role timing.
//
// Run with `npm run test:integration` (starts Firestore + Auth emulators) or:
//   npx firebase emulators:exec --only firestore,auth \
//     "vitest run --config vitest.integration.config.ts"
//
// These tests use the real Firebase Admin SDK against the emulator. They never
// touch production, and they never require real credentials.
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { RegistrationError, registerPlayer } from "@/lib/auth/registration";
import { syncSessionRole } from "@/lib/auth/role-sync";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { normalizeGamerTag } from "@/lib/validation/gamer-tag";
import type { RegistrationInput } from "@/lib/validation/registration";
import { EMPTY_PROFILE_STATS } from "@/types/domain";

const PASSWORD = "correct horse battery";
const SUPER_ADMIN_EMAIL = "owner@example.com";

function input(overrides: Partial<RegistrationInput> = {}): RegistrationInput {
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

  const collections = [paths.gamerTags(), paths.users(), paths.publicProfiles()];

  for (const collection of collections) {
    const snapshot = await firestore.collection(collection).get();
    if (snapshot.empty) {
      continue;
    }

    const batch = firestore.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

async function authUserExists(email: string): Promise<boolean> {
  try {
    await getFirebaseAdminAuth().getUserByEmail(email);
    return true;
  } catch {
    return false;
  }
}

beforeEach(clearEmulator);

afterAll(async () => {
  await clearEmulator();
});

describe("registerPlayer", () => {
  it("creates the auth user, private profile, public profile and tag reservation atomically", async () => {
    const result = await registerPlayer(input());
    const auth = getFirebaseAdminAuth();
    const firestore = getFirebaseAdminFirestore();

    const authUser = await auth.getUser(result.uid);
    expect(authUser.email).toBe("striker@example.com");
    expect(authUser.emailVerified).toBe(false);
    expect(authUser.displayName).toBe("Striker_9");
    // Registration NEVER sets a role claim; the session exchange derives it.
    expect(authUser.customClaims?.role).toBeUndefined();

    const user = (await firestore.doc(paths.user(result.uid)).get()).data();
    expect(user).toMatchObject({
      fullName: "Amani Otieno",
      gamerTag: "Striker_9",
      gamerTagLower: "striker_9",
      email: "striker@example.com",
      whatsappE164: "+254712345678",
      country: "KE",
      preferredGame: "efootball",
      platform: "android",
      role: "user",
      status: "active",
    });

    const publicProfile = (await firestore.doc(paths.publicProfile(result.uid)).get()).data();
    expect(publicProfile).toMatchObject({
      gamerTag: "Striker_9",
      gamerTagLower: "striker_9",
      stats: EMPTY_PROFILE_STATS,
    });
    // Contact data must never reach the public document.
    expect(publicProfile).not.toHaveProperty("email");
    expect(publicProfile).not.toHaveProperty("whatsappE164");

    const reservation = (
      await firestore.doc(paths.gamerTag(normalizeGamerTag(result.gamerTag))).get()
    ).data();
    expect(reservation?.uid).toBe(result.uid);
  });

  it("rejects a duplicate gamer tag case-insensitively", async () => {
    await registerPlayer(input({ gamerTag: "Striker_9", email: "first@example.com" }));

    await expect(
      registerPlayer(input({ gamerTag: "STRIKER_9", email: "second@example.com" })),
    ).rejects.toMatchObject({ code: "gamer-tag-taken" });

    expect(await authUserExists("second@example.com")).toBe(false);
  });

  it("allows only one of two concurrent registrations for the same tag and rolls the loser back", async () => {
    const results = await Promise.allSettled([
      registerPlayer(input({ gamerTag: "RaceTag", email: "race-one@example.com" })),
      registerPlayer(input({ gamerTag: "racetag", email: "race-two@example.com" })),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter(
      (result) => result.status === "rejected",
    ) as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(RegistrationError);
    expect(rejected[0].reason.code).toBe("gamer-tag-taken");

    const winnerEmail =
      results[0].status === "fulfilled" ? "race-one@example.com" : "race-two@example.com";
    const loserEmail =
      results[0].status === "fulfilled" ? "race-two@example.com" : "race-one@example.com";

    expect(await authUserExists(winnerEmail)).toBe(true);
    // The failed transaction must not leave an orphan Auth account behind.
    expect(await authUserExists(loserEmail)).toBe(false);

    const firestore = getFirebaseAdminFirestore();
    const reservation = await firestore.doc(paths.gamerTag("racetag")).get();
    expect(reservation.exists).toBe(true);
  });

  it("reports an existing email without reserving the new tag", async () => {
    await registerPlayer(input({ gamerTag: "FirstTag", email: "same@example.com" }));

    await expect(
      registerPlayer(input({ gamerTag: "SecondTag", email: "same@example.com" })),
    ).rejects.toMatchObject({ code: "email-in-use" });

    const firestore = getFirebaseAdminFirestore();
    const reservation = await firestore.doc(paths.gamerTag("secondtag")).get();
    expect(reservation.exists).toBe(false);
  });

  it("rejects an invalid WhatsApp number before creating an account", async () => {
    await expect(
      registerPlayer(
        input({ gamerTag: "BadPhone", email: "bad-phone@example.com", whatsapp: "123" }),
      ),
    ).rejects.toMatchObject({ code: "invalid-whatsapp" });

    expect(await authUserExists("bad-phone@example.com")).toBe(false);
  });

  it("stores no WhatsApp number when it is omitted", async () => {
    const result = await registerPlayer(
      input({ gamerTag: "NoPhone", email: "no-phone@example.com", whatsapp: undefined }),
    );
    const user = (await getFirebaseAdminFirestore().doc(paths.user(result.uid)).get()).data();

    expect(user?.whatsappE164).toBeNull();
  });
});

describe("syncSessionRole", () => {
  it("does not elevate an unverified account that owns the configured owner email", async () => {
    const auth = getFirebaseAdminAuth();
    const user = await auth.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: PASSWORD,
      emailVerified: false,
    });

    const result = await syncSessionRole(user.uid);

    expect(result.role).toBe("user");
    expect(result.refreshRequired).toBe(false);

    const stored = await auth.getUser(user.uid);
    expect(stored.customClaims?.role).toBeUndefined();
  });

  it("grants super_admin only once the owner email is verified", async () => {
    const auth = getFirebaseAdminAuth();
    const user = await auth.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: PASSWORD,
      emailVerified: true,
    });

    const result = await syncSessionRole(user.uid);

    expect(result.role).toBe("super_admin");
    expect(result.refreshRequired).toBe(true);
    expect(result.revoked).toBe(false);

    const stored = await auth.getUser(user.uid);
    expect(stored.customClaims?.role).toBe("super_admin");
  });

  it("strips a stale super_admin claim when the account email changes", async () => {
    const auth = getFirebaseAdminAuth();
    const user = await auth.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: PASSWORD,
      emailVerified: true,
    });
    await auth.setCustomUserClaims(user.uid, { role: "super_admin" });
    await auth.updateUser(user.uid, { email: "former-owner@example.com" });

    const result = await syncSessionRole(user.uid);

    expect(result.role).toBe("user");
    expect(result.refreshRequired).toBe(true);
    expect(result.revoked).toBe(true);

    const stored = await auth.getUser(user.uid);
    expect(stored.customClaims?.role).toBe("user");
  });

  it("never elevates an ordinary verified player", async () => {
    const auth = getFirebaseAdminAuth();
    const user = await auth.createUser({
      email: "player@example.com",
      password: PASSWORD,
      emailVerified: true,
    });

    const result = await syncSessionRole(user.uid);

    expect(result.role).toBe("user");
    expect(result.refreshRequired).toBe(false);
    expect(result.revoked).toBe(false);
  });
});
