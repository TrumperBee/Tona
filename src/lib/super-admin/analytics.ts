// GCC - platform analytics.
//
// Figures are computed from Firestore and cached for five minutes in
// `platformStats/summary`. Users-by-country is the only sampled chart: Firestore
// cannot group by field, so at most SAMPLE_CAP user documents are read and the
// page states that explicitly. Everything else is an exact count() aggregate.
import "server-only";

import { Timestamp, type Query } from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { GAMES, PLATFORMS } from "@/lib/config/games";
import { TOURNAMENT_STATUSES } from "@/types/domain";
import type { PlatformStatsDocument } from "@/types/domain";

export const ANALYTICS_CACHE_MS = 5 * 60 * 1000;
export const SIGNUP_DAYS = 30;
export const USER_SAMPLE_CAP = 1000;

export interface CountedKey {
  readonly key: string;
  readonly count: number;
}

export interface AnalyticsSummary {
  readonly totalUsers: number;
  readonly totalTournaments: number;
  readonly totalMatches: number;
  readonly activeTournaments: number;
  readonly totalRegistrations: number;
  readonly signupsByDay: readonly { readonly date: string; readonly count: number }[];
  readonly usersByCountry: readonly CountedKey[];
  readonly usersByGame: readonly CountedKey[];
  readonly usersByPlatform: readonly CountedKey[];
  readonly tournamentsByStatus: readonly CountedKey[];
  readonly usersSampled: number;
  readonly sampleCap: number;
  readonly generatedAt: Date;
}

const ACTIVE_TOURNAMENT_STATUSES = [
  "registration_open",
  "registration_closed",
  "pots_confirmed",
  "fixtures_published",
  "league_phase",
  "knockout",
] as const;

async function count(query: Query): Promise<number> {
  const snapshot = await query.count().get();
  return snapshot.data().count;
}

function utcDayStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );
}

function dayLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function computeSummary(): Promise<AnalyticsSummary> {
  const firestore = getFirebaseAdminFirestore();
  const users = firestore.collection(paths.users());
  const tournaments = firestore.collection(paths.tournaments());

  const today = utcDayStart(new Date());
  const days = Array.from({ length: SIGNUP_DAYS }, (_, index) => {
    const start = new Date(today.getTime() - (SIGNUP_DAYS - 1 - index) * 24 * 60 * 60 * 1000);
    return { date: dayLabel(start), start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  });

  const [
    totalUsers,
    totalTournaments,
    totalRegistrations,
    totalMatches,
    activeTournaments,
    tournamentCounts,
    gameCounts,
    platformCounts,
    signupCounts,
    countrySample,
  ] = await Promise.all([
    count(users),
    count(tournaments),
    firestore
      .collectionGroup("registrations")
      .count()
      .get()
      .then((snapshot) => snapshot.data().count)
      .catch(() => 0),
    firestore
      .collectionGroup("matches")
      .count()
      .get()
      .then((snapshot) => snapshot.data().count)
      .catch(() => 0),
    count(tournaments.where("status", "in", [...ACTIVE_TOURNAMENT_STATUSES])),
    Promise.all(
      TOURNAMENT_STATUSES.map(async (status) => ({
        key: status,
        count: await count(tournaments.where("status", "==", status)),
      })),
    ),
    Promise.all(
      GAMES.map(async (game) => ({
        key: game.id,
        count: await count(users.where("preferredGame", "==", game.id)),
      })),
    ),
    Promise.all(
      PLATFORMS.map(async (platform) => ({
        key: platform.id,
        count: await count(users.where("platform", "==", platform.id)),
      })),
    ),
    Promise.all(
      days.map(async (day) => ({
        date: day.date,
        count: await count(
          users.where("createdAt", ">=", day.start).where("createdAt", "<", day.end),
        ),
      })),
    ),
    users.select("country").limit(USER_SAMPLE_CAP).get(),
  ]);

  const countryCounts = new Map<string, number>();

  for (const document of countrySample.docs) {
    const country = document.data().country;

    if (typeof country === "string" && country.length > 0) {
      countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
    }
  }

  const usersByCountry = [...countryCounts.entries()]
    .map(([key, value]) => ({ key, count: value }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);

  return {
    totalUsers,
    totalTournaments,
    totalMatches,
    activeTournaments,
    totalRegistrations,
    signupsByDay: signupCounts,
    usersByCountry,
    usersByGame: gameCounts,
    usersByPlatform: platformCounts,
    tournamentsByStatus: tournamentCounts,
    usersSampled: countrySample.size,
    sampleCap: USER_SAMPLE_CAP,
    generatedAt: new Date(),
  };
}

async function persistSummary(summary: AnalyticsSummary): Promise<void> {
  await getFirebaseAdminFirestore()
    .doc(paths.platformStatsSummary())
    .set({
      ...summary,
      generatedAt: Timestamp.fromDate(summary.generatedAt),
      updatedAt: Timestamp.now(),
    });
}

function fromDocument(document: PlatformStatsDocument): AnalyticsSummary {
  return {
    totalUsers: document.totalUsers ?? 0,
    totalTournaments: document.totalTournaments ?? 0,
    totalMatches: document.totalMatches ?? 0,
    activeTournaments: document.activeTournaments ?? 0,
    totalRegistrations: document.totalRegistrations ?? 0,
    signupsByDay: document.signupsByDay ?? [],
    usersByCountry: document.usersByCountry ?? [],
    usersByGame: document.usersByGame ?? [],
    usersByPlatform: document.usersByPlatform ?? [],
    tournamentsByStatus: document.tournamentsByStatus ?? [],
    usersSampled: document.usersSampled ?? 0,
    sampleCap: document.sampleCap ?? USER_SAMPLE_CAP,
    generatedAt: document.generatedAt?.toDate() ?? new Date(0),
  };
}

export async function getAnalyticsSummary(options: { force?: boolean } = {}): Promise<{
  readonly summary: AnalyticsSummary;
  readonly cached: boolean;
}> {
  const reference = getFirebaseAdminFirestore().doc(paths.platformStatsSummary());
  const snapshot = await reference.get();

  if (!options.force && snapshot.exists) {
    const stored = fromDocument(snapshot.data() as PlatformStatsDocument);

    if (Date.now() - stored.generatedAt.getTime() < ANALYTICS_CACHE_MS) {
      return { summary: stored, cached: true };
    }
  }

  const summary = await computeSummary();
  await persistSummary(summary);
  return { summary, cached: false };
}
