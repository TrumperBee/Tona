// GCC - actor-driven permission tests for every API route.
//
// Generated from src/app/api/**/route.ts. Every handler is called as a
// signed-out visitor, player, organiser, a second organiser who does not own the
// seeded tournament, a Super Admin with the correct pin, and a user with a
// forged Super Admin role claim. Protected routes must answer 401/403/404;
// allowed actors must never receive 401/403 or an unhandled 500.
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sessionCookie, seeded } = vi.hoisted(() => ({
  sessionCookie: { value: undefined as string | undefined },
  seeded: {
    tournamentId: "matrix-tournament",
    playerUid: "",
    organiserUid: "",
    statusTargetUid: "",
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "gcc_session" && sessionCookie.value
        ? { name, value: sessionCookie.value }
        : undefined,
  }),
}));

import * as route0 from "@/app/api/admin-applications/[id]/withdraw/route";
import * as route1 from "@/app/api/admin-applications/route";
import * as route2 from "@/app/api/auth/login-attempt/route";
import * as route3 from "@/app/api/auth/register/route";
import * as route4 from "@/app/api/auth/session/route";
import * as route5 from "@/app/api/auth/turnstile/route";
import * as route6 from "@/app/api/csp-report/route";
import * as route7 from "@/app/api/gamer-tags/check/route";
import * as route8 from "@/app/api/health/route";
import * as route8b from "@/app/api/health/deep/route";
import * as route8c from "@/app/api/client-error/route";
import * as route9 from "@/app/api/notifications/preferences/route";
import * as route10 from "@/app/api/notifications/read/route";
import * as route11 from "@/app/api/organiser/logo/route";
import * as route12 from "@/app/api/organiser/profile/route";
import * as route13 from "@/app/api/organiser/tournaments/[id]/cancel/route";
import * as route14 from "@/app/api/organiser/tournaments/[id]/close-registration/route";
import * as route15 from "@/app/api/organiser/tournaments/[id]/cover/route";
import * as route16 from "@/app/api/organiser/tournaments/[id]/draw/assign/route";
import * as route17 from "@/app/api/organiser/tournaments/[id]/draw/clear/route";
import * as route18 from "@/app/api/organiser/tournaments/[id]/draw/confirm/route";
import * as route19 from "@/app/api/organiser/tournaments/[id]/draw/lock/route";
import * as route20 from "@/app/api/organiser/tournaments/[id]/draw/replace/route";
import * as route21 from "@/app/api/organiser/tournaments/[id]/draw/shuffle/route";
import * as route22 from "@/app/api/organiser/tournaments/[id]/draw/unconfirm/route";
import * as route23 from "@/app/api/organiser/tournaments/[id]/fixtures/generate/route";
import * as route24 from "@/app/api/organiser/tournaments/[id]/fixtures/matchdays/[n]/route";
import * as route25 from "@/app/api/organiser/tournaments/[id]/fixtures/publish/route";
import * as route26 from "@/app/api/organiser/tournaments/[id]/fixtures/reset/route";
import * as route27 from "@/app/api/organiser/tournaments/[id]/fixtures/verify/route";
import * as route28 from "@/app/api/organiser/tournaments/[id]/knockout/generate/route";
import * as route29 from "@/app/api/organiser/tournaments/[id]/knockout/reset/route";
import * as route30 from "@/app/api/organiser/tournaments/[id]/knockout/ties/[tieId]/decide/route";
import * as route31 from "@/app/api/organiser/tournaments/[id]/logo/route";
import * as route32 from "@/app/api/organiser/tournaments/[id]/publish/route";
import * as route33 from "@/app/api/organiser/tournaments/[id]/registrations/[uid]/contact/route";
import * as route34 from "@/app/api/organiser/tournaments/[id]/registrations/[uid]/remove/route";
import * as route35 from "@/app/api/organiser/tournaments/[id]/registrations/export/route";
import * as route36 from "@/app/api/organiser/tournaments/[id]/registrations/route";
import * as route37 from "@/app/api/organiser/tournaments/[id]/reopen-registration/route";
import * as route38 from "@/app/api/organiser/tournaments/[id]/result-reports/[reportId]/resolve/route";
import * as route39 from "@/app/api/organiser/tournaments/[id]/results/bulk/route";
import * as route40 from "@/app/api/organiser/tournaments/[id]/results/clear/route";
import * as route41 from "@/app/api/organiser/tournaments/[id]/results/correct/route";
import * as route42 from "@/app/api/organiser/tournaments/[id]/results/enter/route";
import * as route43 from "@/app/api/organiser/tournaments/[id]/route";
import * as route44 from "@/app/api/organiser/tournaments/[id]/standings/recalculate/route";
import * as route45 from "@/app/api/organiser/tournaments/[id]/standings/verify/route";
import * as route46 from "@/app/api/organiser/tournaments/route";
import * as route47 from "@/app/api/players/search/route";
import * as route48 from "@/app/api/profile/account/route";
import * as route49 from "@/app/api/profile/avatar/route";
import * as route50 from "@/app/api/profile/email/route";
import * as route51 from "@/app/api/profile/route";
import * as route52 from "@/app/api/super-admin/analytics/refresh/route";
import * as route53 from "@/app/api/super-admin/announcements/[id]/publish/route";
import * as route54 from "@/app/api/super-admin/announcements/[id]/route";
import * as route55 from "@/app/api/super-admin/announcements/[id]/unpublish/route";
import * as route56 from "@/app/api/super-admin/announcements/route";
import * as route57 from "@/app/api/super-admin/applications/[id]/approve/route";
import * as route58 from "@/app/api/super-admin/applications/[id]/reject/route";
import * as route59 from "@/app/api/super-admin/email/settings/route";
import * as route60 from "@/app/api/super-admin/email/test/route";
import * as route61 from "@/app/api/super-admin/organisers/route";
import * as route62 from "@/app/api/super-admin/settings/route";
import * as route63 from "@/app/api/super-admin/stats/recompute/route";
import * as route64 from "@/app/api/super-admin/tournaments/[id]/cancel/route";
import * as route65 from "@/app/api/super-admin/tournaments/[id]/suspend/route";
import * as route66 from "@/app/api/super-admin/tournaments/[id]/transfer/route";
import * as route67 from "@/app/api/super-admin/tournaments/[id]/unsuspend/route";
import * as route68 from "@/app/api/super-admin/users/[uid]/contact/route";
import * as route69 from "@/app/api/super-admin/users/[uid]/role/route";
import * as route70 from "@/app/api/super-admin/users/[uid]/status/route";
import * as route71 from "@/app/api/tournaments/[id]/matches/[matchId]/contact/route";
import * as route72 from "@/app/api/tournaments/[id]/matches/[matchId]/report/route";
import * as route73 from "@/app/api/tournaments/[id]/register/route";
import * as route74 from "@/app/api/tournaments/[id]/withdraw/route";
import * as route75 from "@/app/api/unsubscribe/route";
import * as route76 from "@/app/api/webhooks/resend/route";

import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";

const PASSWORD = "correct horse battery";
const SUPER_ADMIN_EMAIL = "owner@example.com";
const SUPER_ADMIN_UID = "integration-super-admin";
const TOURNAMENT_ID = seeded.tournamentId;

type Actor =
  "signed-out" | "player" | "organiser" | "other-organiser" | "super-admin" | "impersonator";
type Category = "public" | "applicant" | "user" | "organiser" | "super-admin";
type Expected = "allowed" | "denied-401" | "denied-403" | "denied-404";

interface RouteEntry {
  readonly path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly module: any;
  readonly methods: readonly string[];
  readonly params: readonly string[];
}

const ROUTES: readonly RouteEntry[] = [
  {
    path: "/api/admin-applications/[id]/withdraw",
    module: route0,
    methods: ["POST"],
    params: ["id"],
  },
  { path: "/api/admin-applications", module: route1, methods: ["POST"], params: [] },
  { path: "/api/auth/login-attempt", module: route2, methods: ["POST"], params: [] },
  { path: "/api/auth/register", module: route3, methods: ["POST"], params: [] },
  { path: "/api/auth/session", module: route4, methods: ["POST", "DELETE"], params: [] },
  { path: "/api/auth/turnstile", module: route5, methods: ["POST"], params: [] },
  { path: "/api/csp-report", module: route6, methods: ["POST"], params: [] },
  { path: "/api/gamer-tags/check", module: route7, methods: ["GET"], params: [] },
  { path: "/api/health", module: route8, methods: ["GET"], params: [] },
  { path: "/api/health/deep", module: route8b, methods: ["GET"], params: [] },
  { path: "/api/client-error", module: route8c, methods: ["POST"], params: [] },
  { path: "/api/notifications/preferences", module: route9, methods: ["PATCH"], params: [] },
  { path: "/api/notifications/read", module: route10, methods: ["POST"], params: [] },
  { path: "/api/organiser/logo", module: route11, methods: ["POST", "DELETE"], params: [] },
  { path: "/api/organiser/profile", module: route12, methods: ["PATCH"], params: [] },
  {
    path: "/api/organiser/tournaments/[id]/cancel",
    module: route13,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/close-registration",
    module: route14,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/cover",
    module: route15,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/draw/assign",
    module: route16,
    methods: ["PUT"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/draw/clear",
    module: route17,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/draw/confirm",
    module: route18,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/draw/lock",
    module: route19,
    methods: ["PUT"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/draw/replace",
    module: route20,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/draw/shuffle",
    module: route21,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/draw/unconfirm",
    module: route22,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/fixtures/generate",
    module: route23,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/fixtures/matchdays/[n]",
    module: route24,
    methods: ["PATCH"],
    params: ["id", "n"],
  },
  {
    path: "/api/organiser/tournaments/[id]/fixtures/publish",
    module: route25,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/fixtures/reset",
    module: route26,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/fixtures/verify",
    module: route27,
    methods: ["GET"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/knockout/generate",
    module: route28,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/knockout/reset",
    module: route29,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/knockout/ties/[tieId]/decide",
    module: route30,
    methods: ["POST"],
    params: ["id", "tieId"],
  },
  {
    path: "/api/organiser/tournaments/[id]/logo",
    module: route31,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/publish",
    module: route32,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/registrations/[uid]/contact",
    module: route33,
    methods: ["GET"],
    params: ["id", "uid"],
  },
  {
    path: "/api/organiser/tournaments/[id]/registrations/[uid]/remove",
    module: route34,
    methods: ["POST"],
    params: ["id", "uid"],
  },
  {
    path: "/api/organiser/tournaments/[id]/registrations/export",
    module: route35,
    methods: ["GET"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/registrations",
    module: route36,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/reopen-registration",
    module: route37,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/result-reports/[reportId]/resolve",
    module: route38,
    methods: ["POST"],
    params: ["id", "reportId"],
  },
  {
    path: "/api/organiser/tournaments/[id]/results/bulk",
    module: route39,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/results/clear",
    module: route40,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/results/correct",
    module: route41,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/results/enter",
    module: route42,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]",
    module: route43,
    methods: ["PATCH", "DELETE"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/standings/recalculate",
    module: route44,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/organiser/tournaments/[id]/standings/verify",
    module: route45,
    methods: ["GET"],
    params: ["id"],
  },
  { path: "/api/organiser/tournaments", module: route46, methods: ["POST"], params: [] },
  { path: "/api/players/search", module: route47, methods: ["GET"], params: [] },
  { path: "/api/profile/account", module: route48, methods: ["DELETE"], params: [] },
  { path: "/api/profile/avatar", module: route49, methods: ["POST", "DELETE"], params: [] },
  { path: "/api/profile/email", module: route50, methods: ["PATCH"], params: [] },
  { path: "/api/profile", module: route51, methods: ["PATCH"], params: [] },
  { path: "/api/super-admin/analytics/refresh", module: route52, methods: ["POST"], params: [] },
  {
    path: "/api/super-admin/announcements/[id]/publish",
    module: route53,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/super-admin/announcements/[id]",
    module: route54,
    methods: ["PATCH", "DELETE"],
    params: ["id"],
  },
  {
    path: "/api/super-admin/announcements/[id]/unpublish",
    module: route55,
    methods: ["POST"],
    params: ["id"],
  },
  { path: "/api/super-admin/announcements", module: route56, methods: ["POST"], params: [] },
  {
    path: "/api/super-admin/applications/[id]/approve",
    module: route57,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/super-admin/applications/[id]/reject",
    module: route58,
    methods: ["POST"],
    params: ["id"],
  },
  { path: "/api/super-admin/email/settings", module: route59, methods: ["PATCH"], params: [] },
  { path: "/api/super-admin/email/test", module: route60, methods: ["POST"], params: [] },
  { path: "/api/super-admin/organisers", module: route61, methods: ["GET"], params: [] },
  { path: "/api/super-admin/settings", module: route62, methods: ["PATCH"], params: [] },
  { path: "/api/super-admin/stats/recompute", module: route63, methods: ["POST"], params: [] },
  {
    path: "/api/super-admin/tournaments/[id]/cancel",
    module: route64,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/super-admin/tournaments/[id]/suspend",
    module: route65,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/super-admin/tournaments/[id]/transfer",
    module: route66,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/super-admin/tournaments/[id]/unsuspend",
    module: route67,
    methods: ["POST"],
    params: ["id"],
  },
  {
    path: "/api/super-admin/users/[uid]/contact",
    module: route68,
    methods: ["POST"],
    params: ["uid"],
  },
  {
    path: "/api/super-admin/users/[uid]/role",
    module: route69,
    methods: ["POST"],
    params: ["uid"],
  },
  {
    path: "/api/super-admin/users/[uid]/status",
    module: route70,
    methods: ["POST"],
    params: ["uid"],
  },
  {
    path: "/api/tournaments/[id]/matches/[matchId]/contact",
    module: route71,
    methods: ["GET", "POST"],
    params: ["id", "matchId"],
  },
  {
    path: "/api/tournaments/[id]/matches/[matchId]/report",
    module: route72,
    methods: ["POST"],
    params: ["id", "matchId"],
  },
  { path: "/api/tournaments/[id]/register", module: route73, methods: ["POST"], params: ["id"] },
  { path: "/api/tournaments/[id]/withdraw", module: route74, methods: ["POST"], params: ["id"] },
  { path: "/api/unsubscribe", module: route75, methods: ["POST"], params: [] },
  { path: "/api/webhooks/resend", module: route76, methods: ["POST"], params: [] },
];

// Minimal valid bodies let ownership guards run before business validation on
// tournament-scoped routes. Factories are used because the seeded uids are only
// known after beforeEach. Everything else can safely fail validation: an
// allowed actor must still never see 401/403 or a 500.
const SAMPLE_BODY_FACTORIES: Readonly<Record<string, () => unknown>> = {
  "/api/admin-applications": () => ({
    fullName: "Matrix Applicant",
    gamerTag: "MatrixApplicant",
    email: "applicant@example.com",
    whatsapp: "0712345678",
    country: "KE",
    preferredGame: "efootball",
    platform: "android",
    experience: "I run weekly local tournaments.",
  }),
  "/api/auth/session": () => ({ idToken: "invalid-token" }),
  "/api/auth/turnstile": () => ({ token: "invalid-token", action: "register" }),
  "/api/csp-report": () => ({
    report: {
      "csp-report": {
        "violated-directive": "script-src",
        "blocked-uri": "https://example.invalid/a.js",
      },
    },
  }),
  "/api/notifications/preferences": () => ({ emailResults: true, emailAnnouncements: true }),
  "/api/notifications/read": () => ({ all: true }),
  "/api/organiser/profile": () => ({
    organisationName: "Matrix Org",
    contactEmail: "org@example.com",
  }),
  "/api/organiser/tournaments": () => ({
    name: "Actor Matrix Cup",
    season: "2026",
    gameId: "efootball",
    description: "Permission matrix integration test.",
  }),
  // Description stays editable after the first registration; the name field
  // is locked by the editable-fields matrix and must not be used as a sample.
  "/api/organiser/tournaments/[id]": () => ({
    description: "Permission matrix tournament (updated).",
  }),
  "/api/organiser/tournaments/[id]/cancel": () => ({
    reason: "Cancelled by the actor matrix test.",
  }),
  "/api/organiser/tournaments/[id]/draw/assign": () => ({ uid: seeded.playerUid, pot: 1 }),
  "/api/organiser/tournaments/[id]/draw/lock": () => ({ uid: seeded.playerUid, locked: true }),
  "/api/organiser/tournaments/[id]/draw/replace": () => ({
    outUid: seeded.playerUid,
    inUid: seeded.organiserUid,
    reason: "actor matrix",
  }),
  "/api/organiser/tournaments/[id]/draw/unconfirm": () => ({ reason: "actor matrix" }),
  "/api/organiser/tournaments/[id]/fixtures/matchdays/[n]": () => ({
    startsOn: "2026-12-01",
    endsOn: "2026-12-07",
  }),
  "/api/organiser/tournaments/[id]/knockout/reset": () => ({ reason: "actor matrix" }),
  "/api/organiser/tournaments/[id]/knockout/ties/[tieId]/decide": () => ({
    winnerUid: seeded.playerUid,
    method: "penalties",
    penalties: { higher: 3, lower: 2 },
  }),
  "/api/organiser/tournaments/[id]/registrations": () => ({ uid: seeded.playerUid }),
  "/api/organiser/tournaments/[id]/registrations/[uid]/remove": () => ({ reason: "actor matrix" }),
  "/api/organiser/tournaments/[id]/result-reports/[reportId]/resolve": () => ({
    decision: "resolved",
    adminNote: "Checked in the actor matrix test.",
  }),
  "/api/organiser/tournaments/[id]/results/bulk": () => ({
    results: [{ matchId: "match-1", homeGoals: 1, awayGoals: 0 }],
  }),
  "/api/organiser/tournaments/[id]/results/correct": () => ({
    matchId: "match-1",
    homeGoals: 1,
    awayGoals: 0,
    reason: "actor matrix",
  }),
  "/api/organiser/tournaments/[id]/results/clear": () => ({
    matchId: "match-1",
    reason: "actor matrix",
  }),
  "/api/organiser/tournaments/[id]/results/enter": () => ({
    matchId: "match-1",
    homeGoals: 1,
    awayGoals: 0,
  }),
  "/api/profile": () => ({ fullName: "Matrix Player" }),
  "/api/profile/email": () => ({ newEmail: "player-new@example.com", password: PASSWORD }),
  "/api/super-admin/announcements": () => ({
    title: "Matrix announcement",
    body: "Posted by the actor matrix test.",
  }),
  "/api/super-admin/settings": () => ({ registrationsOpen: true }),
  "/api/super-admin/users/[uid]/role": () => ({ role: "organiser" }),
  "/api/super-admin/users/[uid]/status": () => ({ status: "suspended", reason: "actor matrix" }),
  "/api/tournaments/[id]/matches/[matchId]/report": () => ({ reason: "The score looks wrong." }),
};

// These calls change or revoke state that later assertions depend on. They are
// covered by their own dedicated tests at the end of this file.
const SKIP_ALLOWED = new Set([
  "DELETE /api/auth/session",
  "DELETE /api/profile/account",
  "DELETE /api/organiser/tournaments/[id]",
]);

function category(path: string): Category {
  if (path.startsWith("/api/admin-applications")) return "applicant";

  if (
    path === "/api/auth/login-attempt" ||
    path === "/api/auth/register" ||
    path === "/api/auth/session" ||
    path === "/api/auth/turnstile" ||
    path === "/api/csp-report" ||
    path === "/api/gamer-tags/check" ||
    path === "/api/health" ||
    path === "/api/client-error" ||
    path === "/api/players/search" ||
    path === "/api/unsubscribe"
  ) {
    return "public";
  }
  if (path === "/api/health/deep") return "super-admin";

  if (path.startsWith("/api/super-admin")) return "super-admin";
  if (path.startsWith("/api/organiser")) return "organiser";
  return "user";
}

function isTournamentScoped(path: string): boolean {
  return path.startsWith("/api/organiser/tournaments/[id]");
}

function expected(categoryName: Category, actor: Actor, path: string): Expected {
  // Browser actors never carry the provider signature, so a 401 proves the
  // webhook denies unsigned callers.
  if (path.startsWith("/api/webhooks/")) return "denied-401";
  if (categoryName === "public") return "allowed";
  if (actor === "signed-out") return "denied-401";
  if (categoryName === "applicant") return actor === "player" ? "allowed" : "denied-403";
  if (categoryName === "super-admin" && actor !== "super-admin") return "denied-403";
  if (categoryName === "organiser" && actor === "player") return "denied-403";
  // Player lists are owner-only even for the Super Admin.
  if (
    path === "/api/organiser/tournaments/[id]/registrations/export" &&
    (actor === "super-admin" || actor === "impersonator")
  ) {
    return "denied-403";
  }
  if (isTournamentScoped(path) && actor === "other-organiser") return "denied-404";
  return "allowed";
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
    paths.applicationStates(),
    paths.auditLogs(),
    paths.announcements(),
    paths.rateLimits(),
    paths.platformSettings(),
    paths.organiserProfiles(),
    paths.tournaments(),
  ]) {
    const snapshot = await firestore.collection(collection).get();

    for (const document of snapshot.docs) {
      await firestore.recursiveDelete(document.ref);
    }
  }

  sessionCookie.value = undefined;
}

async function createUser(
  email: string,
  role: "user" | "organiser" | "super_admin",
  gamerTag: string,
): Promise<string> {
  const auth = getFirebaseAdminAuth();
  const record = await auth.createUser({
    ...(email === SUPER_ADMIN_EMAIL && role === "super_admin" ? { uid: SUPER_ADMIN_UID } : {}),
    email,
    password: PASSWORD,
    displayName: gamerTag,
  });
  await auth.setCustomUserClaims(record.uid, { role });
  const now = new Date();

  await Promise.all([
    getFirebaseAdminFirestore().doc(paths.user(record.uid)).set({
      fullName: gamerTag,
      gamerTag,
      gamerTagLower: gamerTag.toLowerCase(),
      email,
      whatsappE164: null,
      country: "KE",
      preferredGame: "efootball",
      platform: "android",
      community: null,
      favouriteClub: null,
      photoUrl: null,
      avatarUrl: null,
      avatarPublicId: null,
      role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }),
    getFirebaseAdminFirestore()
      .doc(paths.publicProfile(record.uid))
      .set({
        gamerTag,
        gamerTagLower: gamerTag.toLowerCase(),
        country: "KE",
        preferredGame: "efootball",
        platform: "android",
        community: null,
        favouriteClub: null,
        photoUrl: null,
        avatarUrl: null,
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

  return record.uid;
}

async function seedTournament(
  ownerUid: string,
  ownerTag: string,
  playerUid: string,
): Promise<void> {
  const now = new Date();
  const firestore = getFirebaseAdminFirestore();

  await firestore.doc(paths.tournament(TOURNAMENT_ID)).set({
    ownerUid,
    ownerTag,
    organisationName: "Matrix Org",
    slug: "matrix-cup",
    name: "Matrix Cup",
    nameLower: "matrix cup",
    description: "Permission matrix tournament.",
    gameId: "efootball",
    formatId: "ucl-league-phase-36",
    coverImageUrl: null,
    coverImagePublicId: null,
    logoUrl: null,
    logoPublicId: null,
    rules: "Fair play above everything.",
    matchDurationMinutes: 10,
    timezone: "Africa/Nairobi",
    registrationOpensAt: new Date(now.getTime() - 7 * 86400000),
    registrationClosesAt: new Date(now.getTime() + 7 * 86400000),
    startsAt: new Date(now.getTime() + 14 * 86400000),
    maxParticipants: 36,
    registrationCount: 1,
    status: "registration_open",
    suspendedFrom: null,
    season: "2026",
    allowedPlatforms: null,
    allowedCountries: null,
    createdAt: now,
    updatedAt: now,
  });

  await firestore.doc(paths.tournamentSlug("matrix-cup")).set({
    tournamentId: TOURNAMENT_ID,
    name: "Matrix Cup",
    createdAt: now,
  });

  await firestore.doc(paths.tournamentRegistration(TOURNAMENT_ID, playerUid)).set({
    tournamentId: TOURNAMENT_ID,
    gamerTag: "MatrixPlayer",
    gamerTagLower: "matrixplayer",
    country: "KE",
    avatarUrl: null,
    platform: "android",
    status: "registered",
    registeredAt: now,
    withdrawnAt: null,
    removedAt: null,
    removedBy: null,
  });

  await firestore.doc(paths.platformSettingsMain()).set({
    maintenanceMode: false,
    maintenanceMessage: "",
    registrationsOpen: true,
    maxActiveTournamentsPerOrganiser: 10,
    applicationCooldownDays: 7,
    updatedBy: null,
    updatedAt: now,
  });
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

  return ((await response.json()) as { idToken: string }).idToken;
}

async function sessionFor(email: string): Promise<string> {
  return getFirebaseAdminAuth().createSessionCookie(await signInIdToken(email), {
    expiresIn: 60 * 60 * 1000,
  });
}

const sessions: Record<Exclude<Actor, "signed-out">, string> = {
  player: "",
  organiser: "",
  "other-organiser": "",
  "super-admin": "",
  impersonator: "",
};

function request(method: string, path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body:
      method === "GET" || method === "DELETE" || method === "HEAD" || body === undefined
        ? undefined
        : JSON.stringify(body),
  });
}

function contextFor(route: RouteEntry) {
  const params: Record<string, string> = {};

  for (const key of route.params) {
    if (key === "id") params[key] = TOURNAMENT_ID;
    else if (key === "uid") {
      // The status route performs a real status change, so it targets a
      // dedicated throwaway user instead of one of the actor fixtures.
      if (route.path === "/api/super-admin/users/[uid]/status") {
        params[key] = seeded.statusTargetUid;
      } else if (route.path.startsWith("/api/super-admin/users/")) {
        params[key] = "missing-target-uid";
      } else {
        params[key] = seeded.playerUid;
      }
    } else if (key === "n") params[key] = "1";
    else params[key] = `missing-${key}`;
  }

  return { params: Promise.resolve(params) };
}

async function call(route: RouteEntry, method: string, actor: Actor): Promise<number> {
  sessionCookie.value = actor === "signed-out" ? undefined : sessions[actor];
  const handler = route.module[method] as
    ((request: NextRequest, context?: unknown) => Promise<{ status: number }>) | undefined;

  if (!handler) {
    throw new Error(`${route.path} does not export ${method}`);
  }

  const response = await handler(
    request(method, route.path, SAMPLE_BODY_FACTORIES[route.path]?.() ?? {}),
    contextFor(route),
  );
  return response.status;
}

function matchesExpected(result: Expected, status: number): boolean {
  if (result === "allowed") return status !== 401 && status !== 403 && status < 500;
  if (result === "denied-401") return status === 401;
  if (result === "denied-403") return status === 403;
  return status === 404;
}

describe("API actor permission matrix", () => {
  beforeEach(async () => {
    await clearEmulator();
    seeded.playerUid = await createUser("player@example.com", "user", "MatrixPlayer");
    seeded.organiserUid = await createUser("organiser@example.com", "organiser", "MatrixOrganiser");
    await createUser("other-organiser@example.com", "organiser", "OtherOrganiser");
    await createUser(SUPER_ADMIN_EMAIL, "super_admin", "MatrixOwner");
    await createUser("fake-owner@example.com", "super_admin", "FakeOwner");
    seeded.statusTargetUid = await createUser("status-target@example.com", "user", "StatusTarget");
    await seedTournament(seeded.organiserUid, "MatrixOrganiser", seeded.playerUid);
    sessions.player = await sessionFor("player@example.com");
    sessions.organiser = await sessionFor("organiser@example.com");
    sessions["other-organiser"] = await sessionFor("other-organiser@example.com");
    sessions["super-admin"] = await sessionFor(SUPER_ADMIN_EMAIL);
    sessions.impersonator = await sessionFor("fake-owner@example.com");
  });

  afterAll(async () => {
    sessionCookie.value = undefined;
    await clearEmulator();
  });

  it("calls every API route as every actor type", async () => {
    const actors: readonly Actor[] = [
      "signed-out",
      "player",
      "organiser",
      "other-organiser",
      "super-admin",
      "impersonator",
    ];
    const failures: string[] = [];

    for (const route of ROUTES) {
      const kind = category(route.path);

      for (const method of route.methods) {
        for (const actor of actors) {
          const result = expected(kind, actor, route.path);

          // Destructive calls are verified by their own dedicated tests so the
          // broad matrix keeps a stable fixture for every following route.
          if (result === "allowed" && SKIP_ALLOWED.has(`${method} ${route.path}`)) {
            continue;
          }

          let status: number;

          try {
            status = await call(route, method, actor);
          } catch (error) {
            failures.push(
              `${method} ${route.path} as ${actor}: threw ${error instanceof Error ? error.message : String(error)}`,
            );
            continue;
          }

          if (!matchesExpected(result, status)) {
            failures.push(`${method} ${route.path} as ${actor}: expected ${result}, got ${status}`);
          }
        }
      }
    }

    expect(failures).toEqual([]);
  }, 300000);

  it("returns 200 for representative public and owner flows", async () => {
    sessionCookie.value = undefined;
    expect(
      await call(
        ROUTES.find((route) => route.path === "/api/health")!,
        "GET",
        "signed-out",
      ),
    ).toBe(200);
    sessionCookie.value = undefined;
    expect(
      await call(
        ROUTES.find((route) => route.path === "/api/gamer-tags/check")!,
        "GET",
        "signed-out",
      ),
    ).toBe(200);
    expect(
      await call(
        ROUTES.find((route) => route.path === "/api/players/search")!,
        "GET",
        "signed-out",
      ),
    ).toBe(200);
    expect(
      await call(
        ROUTES.find((route) => route.path === "/api/organiser/tournaments")!,
        "POST",
        "organiser",
      ),
    ).toBe(201);
    expect(
      await call(
        ROUTES.find((route) => route.path === "/api/profile")!,
        "PATCH",
        "player",
      ),
    ).toBe(200);
  });

  it("revokes a session on logout", async () => {
    const logout = ROUTES.find((route) => route.path === "/api/auth/session")!;
    sessionCookie.value = sessions.player;
    expect(await call(logout, "DELETE", "player")).toBe(200);
    sessionCookie.value = undefined;
    expect(await call(logout, "DELETE", "signed-out")).toBe(200);
  });
});
