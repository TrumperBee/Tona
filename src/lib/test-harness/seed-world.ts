import "server-only";

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

import { assertHarnessSafeForRuntime } from "@/lib/test-harness";
import { writePlatformSettings } from "@/lib/platform/settings";

export const QA_PASSWORD = "Passw0rd!123";
export const QA_TOURNAMENT_ID = "qa-tournament";
export const QA_TOURNAMENT_SLUG = "qa-tournament";
export const QA_REG_TOURNAMENT_ID = "qa-reg-tournament";
export const QA_REG_TOURNAMENT_SLUG = "qa-reg-tournament";

export type SeedUser = {
  uid: string;
  email: string;
  password: string;
  fullName: string;
  gamerTag: string;
  gamerTagLower: string;
  role: "super_admin" | "organiser" | "user";
  country: string;
  preferredGame: "efootball";
  platform: "playstation" | "xbox";
};

export function getQaUsers() {
  const superAdminEmail = (
    process.env.SUPER_ADMIN_EMAIL ?? "superadmin@gcc-test.example"
  ).toLowerCase();
  const superAdminUid = process.env.SUPER_ADMIN_UID ?? "e2e-super-admin";
  const users: SeedUser[] = [
    {
      uid: superAdminUid,
      email: superAdminEmail,
      password: QA_PASSWORD,
      fullName: "QA Super Admin",
      gamerTag: "QASuperAdmin",
      gamerTagLower: "qasuperadmin",
      role: "super_admin",
      country: "KE",
      preferredGame: "efootball",
      platform: "playstation",
    },
    {
      uid: "e2e-organiser",
      email: "organiser@gcc-test.example",
      password: QA_PASSWORD,
      fullName: "QA Organiser",
      gamerTag: "QAOrganiser",
      gamerTagLower: "qaorganiser",
      role: "organiser",
      country: "KE",
      preferredGame: "efootball",
      platform: "playstation",
    },
    {
      uid: "e2e-player",
      email: "player@gcc-test.example",
      password: QA_PASSWORD,
      fullName: "QA Player",
      gamerTag: "QAPlayer",
      gamerTagLower: "qaplayer",
      role: "user",
      country: "KE",
      preferredGame: "efootball",
      platform: "playstation",
    },
    {
      uid: "e2e-player2",
      email: "player2@gcc-test.example",
      password: QA_PASSWORD,
      fullName: "QA Player Two",
      gamerTag: "QAPlayerTwo",
      gamerTagLower: "qaplayertwo",
      role: "user",
      country: "KE",
      preferredGame: "efootball",
      platform: "xbox",
    },
  ];
  return { users, superAdminUid, superAdminEmail };
}

function assertSeedSafe() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? "";
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "";
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST ?? "";
  if (!authHost || !firestoreHost) {
    throw new Error(
      "Refusing qa:seed: FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST are required.",
    );
  }
  if (!projectId.startsWith("demo-")) {
    throw new Error(
      `Refusing qa:seed: FIREBASE_ADMIN_PROJECT_ID must start with demo-. Got "${projectId}".`,
    );
  }
  if (process.env.GCC_E2E === "1") {
    assertHarnessSafeForRuntime();
  }
}

export async function seedQaWorld() {
  assertSeedSafe();
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
  const app = getApps()[0] ?? initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const { users, superAdminUid } = getQaUsers();

  async function clearAll() {
    let nextPageToken: string | undefined;
    do {
      const res = await auth.listUsers(1000, nextPageToken);
      if (res.users.length) await auth.deleteUsers(res.users.map((u) => u.uid));
      nextPageToken = res.pageToken;
    } while (nextPageToken);
    const collections = await db.listCollections();
    for (const col of collections) {
      const docs = await col.listDocuments();
      for (const doc of docs) await db.recursiveDelete(doc);
    }
  }

  async function seedUser(u: SeedUser) {
    try {
      await auth.deleteUser(u.uid);
    } catch {}
    await auth.createUser({
      uid: u.uid,
      email: u.email,
      password: u.password,
      displayName: u.gamerTag,
      emailVerified: true,
    });
    await auth.setCustomUserClaims(u.uid, { role: u.role });
    const now = FieldValue.serverTimestamp();
    await db.doc(`users/${u.uid}`).set({
      fullName: u.fullName,
      gamerTag: u.gamerTag,
      gamerTagLower: u.gamerTagLower,
      country: u.country,
      preferredGame: u.preferredGame,
      platform: u.platform,
      community: null,
      favouriteClub: null,
      photoUrl: null,
      avatarUrl: null,
      avatarPublicId: null,
      email: u.email,
      whatsappE164: null,
      role: u.role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await db.doc(`publicProfiles/${u.uid}`).set({
      gamerTag: u.gamerTag,
      gamerTagLower: u.gamerTagLower,
      country: u.country,
      preferredGame: u.preferredGame,
      platform: u.platform,
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
          winRate: 0,
        },
        byGame: {},
      },
    });
    await db
      .doc(`gamerTags/${u.gamerTagLower}`)
      .set({ uid: u.uid, gamerTag: u.gamerTag, createdAt: now });
  }

  await clearAll();
  for (const u of users) await seedUser(u);

  // Use platform settings service (server write path) for deterministic baseline.
  await writePlatformSettings(
    {
      maintenanceMode: false,
      maintenanceMessage: "",
      registrationsOpen: true,
      maxActiveTournamentsPerOrganiser: 3,
      applicationCooldownDays: 7,
      emailAnnouncements: false,
    },
    superAdminUid,
  );

  const organiser = users.find((u) => u.role === "organiser")!;
  const player = users.find((u) => u.uid === "e2e-player")!;
  const player2 = users.find((u) => u.uid === "e2e-player2")!;
  const now = new Date();
  const regOpens = new Date(now.getTime() - 7 * 86400000);
  const regCloses = new Date(now.getTime() + 7 * 86400000);
  const startsAt = new Date(now.getTime() + 10 * 86400000);

  // Tournament for result-entry smoke: fixtures published / league-ready with scheduled match.
  await db.doc(`tournaments/${QA_TOURNAMENT_ID}`).set({
    ownerUid: organiser.uid,
    ownerTag: organiser.gamerTag,
    organisationName: "QA Organisation",
    slug: QA_TOURNAMENT_SLUG,
    name: "QA Tournament",
    nameLower: "qa tournament",
    description: "Deterministic QA world tournament for E2E smoke tests.",
    gameId: "efootball",
    formatId: "ucl-league-phase-36",
    coverImageUrl: null,
    coverImagePublicId: null,
    logoUrl: null,
    logoPublicId: null,
    rules: "Play fair. Report scores honestly.",
    matchDurationMinutes: 10,
    timezone: "Africa/Nairobi",
    registrationOpensAt: Timestamp.fromDate(regOpens),
    registrationClosesAt: Timestamp.fromDate(new Date(now.getTime() - 86400000)),
    startsAt: Timestamp.fromDate(startsAt),
    maxParticipants: 36,
    registrationCount: 2,
    status: "fixtures_published",
    suspendedFrom: null,
    season: "2026",
    allowedPlatforms: null,
    allowedCountries: null,
    tiebreakerProfile: "uefa",
    standingsUpdatedAt: null,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });
  await db.doc(`tournamentSlugs/${QA_TOURNAMENT_SLUG}`).set({
    tournamentId: QA_TOURNAMENT_ID,
    name: "QA Tournament",
    createdAt: Timestamp.fromDate(now),
  });

  // Registration docs for the two seeded players in fixtures-published tournament.
  for (const p of [player, player2]) {
    await db.doc(`tournaments/${QA_TOURNAMENT_ID}/registrations/${p.uid}`).set({
      tournamentId: QA_TOURNAMENT_ID,
      uid: p.uid,
      gamerTag: p.gamerTag,
      gamerTagLower: p.gamerTagLower,
      country: p.country,
      preferredGame: p.preferredGame,
      platform: p.platform,
      status: "registered",
      registeredAt: Timestamp.fromDate(now),
      withdrawnAt: null,
      updatedAt: Timestamp.fromDate(now),
    });
  }

  // Deterministic scheduled league match for organiser result-entry smoke.
  await db.doc(`tournaments/${QA_TOURNAMENT_ID}/matches/m1`).set({
    tournamentId: QA_TOURNAMENT_ID,
    stage: "league",
    matchday: 1,
    homeUid: player.uid,
    awayUid: player2.uid,
    homeTag: player.gamerTag,
    awayTag: player2.gamerTag,
    participants: [player.uid, player2.uid],
    status: "scheduled",
    scheduledAt: Timestamp.fromDate(now),
    result: null,
    updatedAt: Timestamp.fromDate(now),
  });
  await db.doc(`tournaments/${QA_TOURNAMENT_ID}/matchdays/1`).set({
    number: 1,
    startsOn: Timestamp.fromDate(now),
    endsOn: Timestamp.fromDate(new Date(now.getTime() + 86400000)),
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });

  // Second tournament open for registration/withdraw smoke.
  await db.doc(`tournaments/${QA_REG_TOURNAMENT_ID}`).set({
    ownerUid: organiser.uid,
    ownerTag: organiser.gamerTag,
    organisationName: "QA Organisation",
    slug: QA_REG_TOURNAMENT_SLUG,
    name: "QA Registration Tournament",
    nameLower: "qa registration tournament",
    description: "Deterministic registration-open tournament for E2E smoke tests.",
    gameId: "efootball",
    formatId: "ucl-league-phase-36",
    coverImageUrl: null,
    coverImagePublicId: null,
    logoUrl: null,
    logoPublicId: null,
    rules: "Play fair. Report scores honestly.",
    matchDurationMinutes: 10,
    timezone: "Africa/Nairobi",
    registrationOpensAt: Timestamp.fromDate(regOpens),
    registrationClosesAt: Timestamp.fromDate(regCloses),
    startsAt: Timestamp.fromDate(startsAt),
    maxParticipants: 36,
    registrationCount: 0,
    status: "registration_open",
    suspendedFrom: null,
    season: "2026",
    allowedPlatforms: null,
    allowedCountries: null,
    tiebreakerProfile: "uefa",
    standingsUpdatedAt: null,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });
  await db.doc(`tournamentSlugs/${QA_REG_TOURNAMENT_SLUG}`).set({
    tournamentId: QA_REG_TOURNAMENT_ID,
    name: "QA Registration Tournament",
    createdAt: Timestamp.fromDate(now),
  });

  return {
    users: users.map(({ password, ...u }) => ({ ...u, password })),
    tournamentId: QA_TOURNAMENT_ID,
    slug: QA_TOURNAMENT_SLUG,
    registrationTournamentId: QA_REG_TOURNAMENT_ID,
    registrationTournamentSlug: QA_REG_TOURNAMENT_SLUG,
  };
}
