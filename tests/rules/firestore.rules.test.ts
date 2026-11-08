// GCC — Firestore Security Rules tests.
//
// The emulator suite requires Java 11+ and the Firebase CLI. Run:
//   npm run test:rules
//
// These tests intentionally use direct document reads rather than broad
// collection queries: rules that call get() are easiest to reason about
// against a known document, and the write tests cover every collection.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const rules = readFileSync(
  fileURLToPath(new URL("../../firestore.rules", import.meta.url)),
  "utf8",
);

let testEnv: RulesTestEnvironment;

function firestoreFor(context: RulesTestContext): Firestore {
  // The rules-unit-testing type surface is the compat Firestore type, but it
  // returns a modular client instance compatible with firebase/firestore.
  return context.firestore() as unknown as Firestore;
}

function user(uid: string, role: "user" | "organiser" | "super_admin" = "user"): Firestore {
  return firestoreFor(
    testEnv.authenticatedContext(uid, {
      email: `${uid}@example.com`,
      email_verified: true,
      role,
    }),
  );
}

function anonymous(): Firestore {
  return firestoreFor(testEnv.unauthenticatedContext());
}

const now = Timestamp.now();

async function seed(): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = firestoreFor(context);

    await Promise.all([
      setDoc(doc(db, "users/alice"), {
        fullName: "Alice Player",
        gamerTag: "Alice",
        gamerTagLower: "alice",
        email: "alice@example.com",
        whatsappE164: "+2348012345678",
        country: "NG",
        preferredGame: "efootball",
        platform: "android",
        photoUrl: null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "users/bob"), {
        fullName: "Bob Player",
        gamerTag: "Bob",
        gamerTagLower: "bob",
        email: "bob@example.com",
        whatsappE164: "+2348012345679",
        country: "NG",
        preferredGame: "efootball",
        platform: "android",
        photoUrl: null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "users/alice/notifications/n1"), {
        type: "system",
        title: "Welcome",
        body: "Hello",
        link: null,
        read: false,
        createdAt: now,
      }),
      setDoc(doc(db, "publicProfiles/alice"), {
        gamerTag: "Alice",
        gamerTagLower: "alice",
        country: "NG",
        preferredGame: "efootball",
        platform: "android",
        community: "UON Esports Club",
        favouriteClub: "Arsenal",
        photoUrl: null,
        avatarUrl: null,
        avatarPublicId: null,
        stats: {
          overall: {
            tournaments: 1,
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
      setDoc(doc(db, "gamerTags/alice"), { uid: "alice", createdAt: now }),
      setDoc(doc(db, "adminApplications/app1"), {
        uid: "alice",
        communityName: "Alice Community",
        status: "pending",
        createdAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "adminApplications/app2"), {
        uid: "bob",
        communityName: "Bob Community",
        status: "pending",
        createdAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "tournaments/public"), {
        ownerUid: "organiser-a",
        slug: "public-cup",
        name: "Public Cup",
        status: "registration_open",
        startsAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "tournaments/draft"), {
        ownerUid: "organiser-a",
        slug: "draft-cup",
        name: "Draft Cup",
        status: "draft",
        startsAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "tournaments/other-draft"), {
        ownerUid: "organiser-b",
        slug: "other-draft-cup",
        name: "Other Draft Cup",
        status: "draft",
        startsAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "tournaments/suspended"), {
        ownerUid: "organiser-a",
        slug: "suspended-cup",
        name: "Suspended Cup",
        status: "suspended",
        startsAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "tournaments/published"), {
        ownerUid: "organiser-a",
        slug: "published-cup",
        name: "Published Cup",
        status: "league_phase",
        startsAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "users/alice/memberships/public"), {
        tournamentId: "public",
        slug: "public-cup",
        name: "Public Cup",
        gameId: "efootball",
        status: "registration_open",
        registeredAt: now,
      }),
      setDoc(doc(db, "publicProfiles/alice/history/public"), {
        tournamentName: "Public Cup",
        slug: "public-cup",
        season: "2026",
        gameId: "efootball",
        finalPosition: 1,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        wonTitle: false,
        completedAt: now,
      }),
      setDoc(doc(db, "tournaments/public/registrations/alice"), {
        tournamentId: "public",
        gamerTag: "Alice",
        country: "NG",
        photoUrl: null,
        status: "registered",
        registeredAt: now,
      }),
      setDoc(doc(db, "tournaments/draft/registrations/alice"), {
        tournamentId: "draft",
        gamerTag: "Alice",
        country: "NG",
        photoUrl: null,
        status: "registered",
        registeredAt: now,
      }),
      setDoc(doc(db, "tournaments/suspended/registrations/alice"), {
        tournamentId: "suspended",
        gamerTag: "Alice",
        country: "NG",
        photoUrl: null,
        status: "registered",
        registeredAt: now,
      }),
      setDoc(doc(db, "tournaments/public/draw/current"), {
        pots: { "1": ["alice"], "2": [], "3": [], "4": [] },
        method: "manual",
        shuffleSeed: null,
        confirmedAt: now,
        confirmedBy: "organiser-a",
      }),
      setDoc(doc(db, "tournaments/public/draw/unconfirmed"), {
        pots: { "1": ["alice"], "2": [], "3": [], "4": [] },
        method: "manual",
        shuffleSeed: null,
        confirmedAt: null,
        confirmedBy: null,
      }),
      setDoc(doc(db, "tournaments/public/fixtureDrafts/current"), {
        generatedBy: "organiser-a",
        generatedAt: now,
        fixtures: [],
        validation: { valid: true, issues: [] },
      }),
      setDoc(doc(db, "tournaments/public/matches/m1"), {
        tournamentId: "public",
        stage: "league",
        matchday: 1,
        homeUid: "alice",
        awayUid: "bob",
        homeTag: "Alice",
        awayTag: "Bob",
        participants: ["alice", "bob"],
        status: "scheduled",
        scheduledAt: now,
        result: null,
        updatedAt: now,
      }),
      setDoc(doc(db, "tournaments/published/matches/p1"), {
        tournamentId: "published",
        stage: "league",
        matchday: 1,
        homeUid: "alice",
        awayUid: "bob",
        homeTag: "Alice",
        awayTag: "Bob",
        participants: ["alice", "bob"],
        status: "scheduled",
        scheduledAt: now,
        result: null,
        updatedAt: now,
      }),
      setDoc(doc(db, "tournaments/draft/matches/d1"), {
        tournamentId: "draft",
        stage: "league",
        matchday: 1,
        homeUid: "alice",
        awayUid: "bob",
        homeTag: "Alice",
        awayTag: "Bob",
        participants: ["alice", "bob"],
        status: "scheduled",
        scheduledAt: now,
        result: null,
        updatedAt: now,
      }),
      setDoc(doc(db, "tournaments/suspended/matches/s1"), {
        tournamentId: "suspended",
        stage: "league",
        matchday: 1,
        homeUid: "alice",
        awayUid: "bob",
        homeTag: "Alice",
        awayTag: "Bob",
        participants: ["alice", "bob"],
        status: "scheduled",
        scheduledAt: now,
        result: null,
        updatedAt: now,
      }),
      setDoc(doc(db, "tournaments/public/resultReports/r1"), {
        matchId: "m1",
        reportedBy: "alice",
        reportedByTag: "Alice",
        reason: "The score recorded for this match looks incorrect.",
        status: "open",
        adminNote: null,
        resolvedBy: null,
        resolvedAt: null,
        createdAt: now,
      }),
      setDoc(doc(db, "tournaments/public/standings/alice"), {
        gamerTag: "Alice",
        MP: 0,
        W: 0,
        D: 0,
        L: 0,
        GF: 0,
        GA: 0,
        GD: 0,
        Pts: 0,
        position: 1,
        qualificationBand: "round-of-16",
      }),
      setDoc(doc(db, "tournaments/public/knockoutTies/t1"), {
        round: "r16",
        seeds: { home: 1, away: 16 },
        legs: [],
        aggregate: { homeGoals: 0, awayGoals: 0 },
        winnerUid: null,
        status: "scheduled",
      }),
      setDoc(doc(db, "tournaments/public/announcements/a1"), {
        title: "Kick-off",
        body: "Welcome",
        authorUid: "organiser-a",
        publishedAt: now,
      }),
      setDoc(doc(db, "announcements/platform-a1"), {
        title: "Platform news",
        body: "Hello",
        authorUid: "root",
        publishedAt: now,
      }),
      setDoc(doc(db, "hallOfFame/h1"), {
        tournamentId: "public",
        season: "2026",
        championUid: "alice",
        championTag: "Alice",
        finalistUid: "bob",
        finalistTag: "Bob",
        thirdPlace: null,
        stats: {
          played: 1,
          wins: 1,
          draws: 0,
          losses: 0,
          goalsFor: 1,
          goalsAgainst: 0,
        },
      }),
      setDoc(doc(db, "auditLogs/log1"), {
        actorUid: "root",
        actorRole: "super_admin",
        action: "test",
        targetType: "test",
        targetId: "test",
        tournamentId: null,
        before: null,
        after: null,
        reason: null,
        createdAt: now,
      }),
      setDoc(doc(db, "rateLimits/key"), {
        key: "key",
        count: 1,
        windowStart: 0,
        expiresAt: 1,
        updatedAt: 0,
      }),
      setDoc(doc(db, "platformStats/summary"), {
        totalUsers: 2,
        totalTournaments: 2,
        totalMatches: 1,
        activeTournaments: 1,
        updatedAt: now,
      }),
    ]);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "gcc-rules-test",
    firestore: {
      rules,
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("private collections", () => {
  it("denies anonymous reads of private collections", async () => {
    const db = anonymous();

    for (const path of [
      "users/alice",
      "gamerTags/alice",
      "auditLogs/log1",
      "rateLimits/key",
      "adminApplications/app1",
    ]) {
      await assertFails(getDoc(doc(db, path)));
    }
  });

  it("lets a user read only their own private profile, notifications and memberships", async () => {
    const alice = user("alice");

    await assertSucceeds(getDoc(doc(alice, "users/alice")));
    await assertSucceeds(getDoc(doc(alice, "users/alice/notifications/n1")));
    await assertSucceeds(getDoc(doc(alice, "users/alice/memberships/public")));
    await assertFails(getDoc(doc(alice, "users/bob")));
    await assertFails(getDoc(doc(alice, "users/bob/notifications/n1")));
    await assertFails(getDoc(doc(alice, "users/bob/memberships/public")));
  });

  it("lets an applicant and the Super Admin read an admin application, but not another user", async () => {
    await assertSucceeds(getDoc(doc(user("alice"), "adminApplications/app1")));
    await assertFails(getDoc(doc(user("bob"), "adminApplications/app1")));
    await assertSucceeds(getDoc(doc(user("root", "super_admin"), "adminApplications/app1")));
  });
});

describe("public reads", () => {
  it("lets anyone read public profiles, their public history, platform announcements and the Hall of Fame", async () => {
    const db = anonymous();

    await assertSucceeds(getDoc(doc(db, "publicProfiles/alice")));
    await assertSucceeds(getDoc(doc(db, "publicProfiles/alice/history/public")));
    await assertSucceeds(getDoc(doc(db, "announcements/platform-a1")));
    await assertSucceeds(getDoc(doc(db, "hallOfFame/h1")));
  });

  it("lets the public read non-draft tournaments and their public subcollections", async () => {
    const db = anonymous();

    await assertSucceeds(getDoc(doc(db, "tournaments/public")));
    await assertSucceeds(getDoc(doc(db, "tournaments/published")));
    await assertSucceeds(getDoc(doc(db, "tournaments/public/registrations/alice")));
    await assertSucceeds(getDoc(doc(db, "tournaments/public/draw/current")));
    await assertSucceeds(getDoc(doc(db, "tournaments/public/standings/alice")));
    await assertSucceeds(getDoc(doc(db, "tournaments/published/matches/m1")));
    await assertSucceeds(getDoc(doc(db, "tournaments/public/knockoutTies/t1")));
    await assertSucceeds(getDoc(doc(db, "tournaments/public/announcements/a1")));
  });

  it("hides draft and suspended tournaments and their subcollections", async () => {
    const db = anonymous();

    await assertFails(getDoc(doc(db, "tournaments/draft")));
    await assertFails(getDoc(doc(db, "tournaments/suspended")));
    await assertFails(getDoc(doc(db, "tournaments/public/fixtureDrafts/current")));
    await assertFails(getDoc(doc(db, "tournaments/public/resultReports/r1")));
  });

  it("does not expose an unconfirmed draw but exposes a confirmed one", async () => {
    const db = anonymous();

    await assertFails(getDoc(doc(db, "tournaments/public/draw/unconfirmed")));
    await assertSucceeds(getDoc(doc(db, "tournaments/public/draw/current")));
  });
});

describe("organiser ownership", () => {
  it("lets an organiser read their own draft, but not another organiser's draft", async () => {
    const organiserA = user("organiser-a", "organiser");

    await assertSucceeds(getDoc(doc(organiserA, "tournaments/draft")));
    await assertSucceeds(getDoc(doc(organiserA, "tournaments/draft/fixtureDrafts/current")));
    await assertFails(getDoc(doc(organiserA, "tournaments/other-draft")));
    await assertFails(getDoc(doc(organiserA, "tournaments/other-draft/fixtureDrafts/current")));
  });
});

describe("result reports", () => {
  it("is readable only by the reporter, the owner and the Super Admin", async () => {
    await assertSucceeds(getDoc(doc(user("alice"), "tournaments/public/resultReports/r1")));
    await assertFails(getDoc(doc(user("bob"), "tournaments/public/resultReports/r1")));
    await assertFails(getDoc(doc(user("carol"), "tournaments/public/resultReports/r1")));
    await assertSucceeds(
      getDoc(doc(user("organiser-a", "organiser"), "tournaments/public/resultReports/r1")),
    );
    await assertSucceeds(
      getDoc(doc(user("root", "super_admin"), "tournaments/public/resultReports/r1")),
    );
  });
});

describe("collection-group player history", () => {
  it("lets a player query matches for a published tournament", async () => {
    const db = user("alice");
    const history = query(
      collectionGroup(db, "matches"),
      where("tournamentId", "==", "published"),
      where("participants", "array-contains", "alice"),
      orderBy("updatedAt", "desc"),
    );

    await assertSucceeds(getDocs(history));
  });

  it("does not leak draft or suspended tournament matches through collection-group queries", async () => {
    const db = user("alice");

    const broad = query(
      collectionGroup(db, "matches"),
      where("participants", "array-contains", "alice"),
      orderBy("updatedAt", "desc"),
    );
    await assertFails(getDocs(broad));

    for (const tournamentId of ["draft", "suspended"]) {
      const hidden = query(
        collectionGroup(db, "matches"),
        where("tournamentId", "==", tournamentId),
        where("participants", "array-contains", "alice"),
      );
      await assertFails(getDocs(hidden));
    }
  });

  it("lets a player query registrations for public tournaments only", async () => {
    const published = query(
      collectionGroup(user("alice"), "registrations"),
      where("tournamentId", "==", "public"),
    );
    await assertSucceeds(getDocs(published));

    const draft = query(
      collectionGroup(user("alice"), "registrations"),
      where("tournamentId", "==", "draft"),
    );
    await assertFails(getDocs(draft));
  });
});

describe("audit and platform operations", () => {
  it("lets the Super Admin read audit logs and platform stats, and denies organisers", async () => {
    const root = user("root", "super_admin");
    const organiser = user("organiser-a", "organiser");

    await assertSucceeds(getDoc(doc(root, "auditLogs/log1")));
    await assertSucceeds(getDoc(doc(root, "platformStats/summary")));
    await assertFails(getDoc(doc(organiser, "auditLogs/log1")));
    await assertFails(getDoc(doc(organiser, "platformStats/summary")));
  });
});

describe("client writes", () => {
  it("denies every client write for users, organisers and Super Admins", async () => {
    const writePaths = [
      "users/alice",
      "users/alice/notifications/n1",
      "users/alice/memberships/public",
      "publicProfiles/alice",
      "publicProfiles/alice/history/public",
      "gamerTags/alice",
      "adminApplications/app1",
      "tournaments/public",
      "tournaments/public/registrations/alice",
      "tournaments/public/draw/current",
      "tournaments/public/fixtureDrafts/current",
      "tournaments/public/matches/m1",
      "tournaments/public/resultReports/r1",
      "tournaments/public/standings/alice",
      "tournaments/public/knockoutTies/t1",
      "tournaments/public/announcements/a1",
      "announcements/platform-a1",
      "hallOfFame/h1",
      "auditLogs/log1",
      "rateLimits/key",
      "platformStats/summary",
    ];

    for (const db of [
      user("alice"),
      user("organiser-a", "organiser"),
      user("root", "super_admin"),
    ]) {
      for (const path of writePaths) {
        await assertFails(setDoc(doc(db, path), { clientWrite: true }));
      }

      await assertFails(deleteDoc(doc(db, "tournaments/public")));
    }
  });
});
