// GCC - emulator-backed integration tests for the local test-player seeder.
//
// These tests use the real registration services against the Auth/Firestore
// emulators. They never touch production and never use the developer's real
// `.seed/` directory (GCC_SEED_DIR points at a temporary folder).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { registerPlayer } from "@/lib/auth/registration";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { registerPlayerForUser } from "@/lib/tournament/registrations";
import { normalizeGamerTag } from "@/lib/validation/gamer-tag";

import { readManifest, TEST_EMAIL_DOMAIN } from "../../scripts/dev/seed/manifest";
import { cleanupSeed, seedPlayers, type SeedIo } from "../../scripts/dev/seed/service";

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID!;
const DAY_MS = 24 * 60 * 60 * 1000;

let seedDir = "";

interface TestIo extends SeedIo {
  readonly output: string[];
}

function testIo(answers: readonly string[] = [PROJECT_ID]): TestIo {
  const output: string[] = [];
  let index = 0;

  return {
    output,
    info: (message) => output.push(message),
    warn: (message) => output.push(message),
    confirm: async () => {
      const answer = answers[Math.min(index, answers.length - 1)] ?? "";
      index += 1;
      return answer;
    },
  };
}

async function clearEmulator(): Promise<void> {
  const auth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();
  const users = await auth.listUsers(1000);

  if (users.users.length > 0) {
    await auth.deleteUsers(users.users.map((user) => user.uid));
  }

  const collections = await firestore.listCollections();

  for (const collection of collections) {
    await firestore.recursiveDelete(collection);
  }
}

async function seedTournament(options: {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status?: "registration_open" | "pots_confirmed";
}): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const now = new Date();

  await firestore.doc(paths.tournament(options.id)).set({
    ownerUid: "organiser-uid",
    ownerTag: "Chief",
    organisationName: "Nairobi Esports",
    slug: options.slug,
    name: options.name,
    nameLower: options.name.toLowerCase(),
    description: "Seed integration test competition.",
    gameId: "efootball",
    formatId: "ucl-league-phase-36",
    coverImageUrl: null,
    coverImagePublicId: null,
    logoUrl: null,
    logoPublicId: null,
    rules: "Fair play above everything.",
    matchDurationMinutes: 10,
    timezone: "Africa/Nairobi",
    registrationOpensAt: new Date(now.getTime() - 7 * DAY_MS),
    registrationClosesAt: new Date(now.getTime() + 7 * DAY_MS),
    startsAt: new Date(now.getTime() + 14 * DAY_MS),
    maxParticipants: 36,
    registrationCount: 0,
    status: options.status ?? "registration_open",
    suspendedFrom: null,
    season: "2026",
    allowedPlatforms: null,
    allowedCountries: null,
    createdAt: now,
    updatedAt: now,
  });

  await firestore.doc(paths.tournamentSlug(options.slug)).set({
    tournamentId: options.id,
    name: options.name,
    createdAt: now,
  });
}

/** Two ordinary (non-test) players registered through the production service. */
async function seedTwoRealPlayers(tournamentId: string): Promise<void> {
  for (const index of [1, 2]) {
    const player = await registerPlayer({
      fullName: `Real Player ${index}`,
      gamerTag: `RealPlayer_${index}`,
      email: `real${index}@example.com`,
      password: "real-player-password",
      whatsapp: "+254712345678",
      country: "KE",
      preferredGame: "efootball",
      platform: "android",
      acceptTerms: true,
    });

    await registerPlayerForUser(
      {
        userId: player.uid,
        email: player.email,
        role: "user",
        isSuperAdmin: false,
      },
      tournamentId,
    );
  }
}

async function tournamentCount(tournamentId: string): Promise<number> {
  const snapshot = await getFirebaseAdminFirestore().doc(paths.tournament(tournamentId)).get();
  return Number(snapshot.data()?.registrationCount ?? 0);
}

async function registrationUids(tournamentId: string): Promise<string[]> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(paths.tournamentRegistrations(tournamentId))
    .get();

  return snapshot.docs.map((document) => document.id).sort();
}

beforeEach(async () => {
  if (seedDir) {
    rmSync(seedDir, { recursive: true, force: true });
  }

  seedDir = mkdtempSync(join(tmpdir(), "gcc-seed-test-"));
  process.env.GCC_SEED_DIR = seedDir;
  await clearEmulator();
});

afterAll(async () => {
  delete process.env.GCC_SEED_DIR;

  if (seedDir) {
    rmSync(seedDir, { recursive: true, force: true });
  }
});

describe("dev:seed players", () => {
  it("fills a 36-player field, re-runs as a no-op and cleans back to the two existing entries", async () => {
    const tournamentId = "seed-cup";
    const slug = "seed-cup";
    await seedTournament({ id: tournamentId, slug, name: "Seed Cup" });
    await seedTwoRealPlayers(tournamentId);

    expect(await tournamentCount(tournamentId)).toBe(2);

    const first = await seedPlayers({ slug, fill: true }, testIo());
    const manifest = readManifest();

    expect(first.noop).toBe(false);
    expect(first.created).toBe(34);
    expect(first.registeredTotal).toBe(36);
    expect(await tournamentCount(tournamentId)).toBe(36);
    expect(await registrationUids(tournamentId)).toHaveLength(36);
    expect(manifest?.accounts).toHaveLength(34);
    expect(manifest?.projectId).toBe(PROJECT_ID);

    const accounts = manifest?.accounts ?? [];
    const auth = getFirebaseAdminAuth();
    const firestore = getFirebaseAdminFirestore();
    const authUsers = await auth.getUsers(accounts.map((account) => ({ uid: account.uid })));

    expect(authUsers.users).toHaveLength(34);

    for (const account of accounts) {
      expect(account.email.endsWith(`@${TEST_EMAIL_DOMAIN}`)).toBe(true);
      expect(account.password.length).toBeGreaterThanOrEqual(12);

      const [user, profile, tag, registration] = await Promise.all([
        firestore.doc(paths.user(account.uid)).get(),
        firestore.doc(paths.publicProfile(account.uid)).get(),
        firestore.doc(paths.gamerTag(normalizeGamerTag(account.gamerTag))).get(),
        firestore.doc(paths.tournamentRegistration(tournamentId, account.uid)).get(),
      ]);

      expect(user.exists).toBe(true);
      expect(profile.exists).toBe(true);
      expect(tag.data()?.uid).toBe(account.uid);
      expect(registration.data()?.status).toBe("registered");
      expect(user.data()?.whatsappE164).toMatch(/^\+447700900\d{3}$/);
      expect(user.data()?.photoUrl).toBeNull();
    }

    // A second run only reuses the manifest: no new accounts, no new entries.
    const second = await seedPlayers({ slug, fill: true }, testIo());
    expect(second.noop).toBe(true);
    expect(second.created).toBe(0);
    expect(await tournamentCount(tournamentId)).toBe(36);
    expect(readManifest()?.accounts).toHaveLength(34);

    // Dry-run cleanup never writes.
    const dry = await cleanupSeed({ slug, deleteTournament: false, execute: false }, testIo());

    expect(dry.dryRun).toBe(true);
    expect(await tournamentCount(tournamentId)).toBe(36);
    expect(await registrationUids(tournamentId)).toHaveLength(36);

    // Execute: remove the 34 test registrations and every test account.
    const cleaned = await cleanupSeed(
      { slug, deleteTournament: false, execute: true },
      testIo([PROJECT_ID]),
    );

    expect(cleaned.removedRegistrations).toBe(34);
    expect(cleaned.deletedAccounts).toBe(34);
    expect(await tournamentCount(tournamentId)).toBe(2);
    expect(await registrationUids(tournamentId)).toHaveLength(2);
    expect(readManifest()?.accounts).toHaveLength(0);

    const remainingAuth = await auth.listUsers(1000);
    expect(remainingAuth.users.map((user) => user.email).sort()).toEqual([
      "real1@example.com",
      "real2@example.com",
    ]);

    const firstAccount = accounts[0]!;
    const gone = await Promise.all([
      firestore.doc(paths.user(firstAccount.uid)).get(),
      firestore.doc(paths.publicProfile(firstAccount.uid)).get(),
      firestore.doc(paths.gamerTag(normalizeGamerTag(firstAccount.gamerTag))).get(),
    ]);

    expect(gone.every((snapshot) => !snapshot.exists)).toBe(true);
  }, 120_000);

  it("refuses partial cleanup of a progressed tournament and only allows full deletion", async () => {
    const tournamentId = "advanced-cup";
    const slug = "advanced-cup";
    await seedTournament({ id: tournamentId, slug, name: "Advanced Cup" });
    await seedTwoRealPlayers(tournamentId);

    const seeded = await seedPlayers({ slug, fill: true }, testIo());
    expect(seeded.created).toBe(34);

    // Progress the tournament: pot confirmation plus a draw document.
    await getFirebaseAdminFirestore().doc(paths.tournament(tournamentId)).update({
      status: "pots_confirmed",
    });
    await getFirebaseAdminFirestore().doc(paths.tournamentDrawCurrent(tournamentId)).set({
      pots: [],
      createdAt: new Date(),
    });

    const manifestBefore = readManifest();
    const before = await registrationUids(tournamentId);

    await expect(
      cleanupSeed({ slug, deleteTournament: false, execute: true }, testIo()),
    ).rejects.toThrow(/progressed|delete-tournament/);

    expect(await registrationUids(tournamentId)).toEqual(before);
    expect(readManifest()?.accounts).toHaveLength(manifestBefore?.accounts.length ?? -1);
    expect((await getFirebaseAdminAuth().listUsers(1000)).users.length).toBe(36);

    // Full deletion is the only allowed path and needs the slug confirmation.
    const deleted = await cleanupSeed(
      { slug, deleteTournament: true, execute: true },
      testIo([PROJECT_ID, slug]),
    );

    expect(deleted.deletedTournaments).toBe(1);
    expect(deleted.deletedAccounts).toBe(34);

    const firestore = getFirebaseAdminFirestore();
    const [tournament, slugReservation] = await Promise.all([
      firestore.doc(paths.tournament(tournamentId)).get(),
      firestore.doc(paths.tournamentSlug(slug)).get(),
    ]);

    expect(tournament.exists).toBe(false);
    expect(slugReservation.exists).toBe(false);
    expect(await registrationUids(tournamentId)).toHaveLength(0);

    const remainingAuth = await getFirebaseAdminAuth().listUsers(1000);
    expect(remainingAuth.users.map((user) => user.email).sort()).toEqual([
      "real1@example.com",
      "real2@example.com",
    ]);
  }, 120_000);

  it("refuses to seed unless registration is effectively open", async () => {
    const tournamentId = "closed-cup";
    const slug = "closed-cup";
    await seedTournament({
      id: tournamentId,
      slug,
      name: "Closed Cup",
      status: "pots_confirmed",
    });

    await expect(seedPlayers({ slug, fill: true }, testIo())).rejects.toThrow(
      /Registration is not open/,
    );

    expect(await registrationUids(tournamentId)).toHaveLength(0);
    expect(readManifest()).toBeNull();
  });
});
