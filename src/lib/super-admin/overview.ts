// GCC - Super Admin overview metrics.
//
// Every card comes from a Firestore count() aggregate, not from reading a
// collection. The only document reads are the latest ten audit entries and the
// display tags for their actors.
import "server-only";

import type { Query } from "firebase-admin/firestore";

import { describeAuditAction } from "@/lib/audit/actions";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { paths } from "@/lib/firebase/paths";
import { getPlatformSettings, type PlatformSettingsValues } from "@/lib/platform/settings";
import type { AuditLogDocument } from "@/types/domain";

const RECENT_SIGNUP_DAYS = 7;
const ACTIVITY_LIMIT = 10;

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

export interface OverviewActivityEntry {
  readonly id: string;
  readonly action: string;
  readonly label: string;
  readonly actorUid: string;
  readonly actorGamerTag: string | null;
  readonly targetType: string;
  readonly targetId: string;
  readonly reason: string | null;
  readonly createdAt: Date | null;
}

export interface OverviewData {
  readonly users: {
    readonly total: number;
    readonly active: number;
    readonly suspended: number;
    readonly banned: number;
    readonly organisers: number;
    readonly recentSignups: number;
  };
  readonly tournaments: {
    readonly total: number;
    readonly active: number;
    readonly completed: number;
    readonly draft: number;
  };
  readonly pendingApplications: number;
  readonly totalRegistrations: number;
  readonly activity: readonly OverviewActivityEntry[];
  readonly settings: PlatformSettingsValues;
}

export async function getOverview(): Promise<OverviewData> {
  const firestore = getFirebaseAdminFirestore();
  const users = firestore.collection(paths.users());
  const tournaments = firestore.collection(paths.tournaments());
  const applications = firestore.collection(paths.adminApplications());
  const recentCutoff = new Date(Date.now() - RECENT_SIGNUP_DAYS * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    bannedUsers,
    organisers,
    recentSignups,
    totalTournaments,
    activeTournaments,
    completedTournaments,
    draftTournaments,
    pendingApplications,
    totalRegistrations,
    activitySnapshot,
    settings,
  ] = await Promise.all([
    count(users),
    count(users.where("status", "==", "active")),
    count(users.where("status", "==", "suspended")),
    count(users.where("status", "==", "banned")),
    count(users.where("role", "==", "organiser")),
    count(users.where("createdAt", ">=", recentCutoff)),
    count(tournaments),
    count(tournaments.where("status", "in", [...ACTIVE_TOURNAMENT_STATUSES])),
    count(tournaments.where("status", "==", "completed")),
    count(tournaments.where("status", "==", "draft")),
    count(applications.where("status", "==", "pending")),
    // Registrations are written only from Phase 8. A collection-group count is
    // exact and stays at zero until then; if the collection-group index is not
    // available the page must still load, so an unavailable count is reported
    // as zero rather than failing the whole console.
    firestore
      .collectionGroup("registrations")
      .count()
      .get()
      .then((snapshot) => snapshot.data().count)
      .catch(() => 0),
    firestore
      .collection(paths.auditLogs())
      .orderBy("createdAt", "desc")
      .limit(ACTIVITY_LIMIT)
      .get(),
    getPlatformSettings(),
  ]);

  const actorUids = [
    ...new Set(
      activitySnapshot.docs.map((document) => (document.data() as AuditLogDocument).actorUid),
    ),
  ];

  const actorSnapshots = actorUids.length
    ? await firestore.getAll(...actorUids.map((uid) => firestore.doc(paths.user(uid))))
    : [];

  const actorTags = new Map<string, string>();

  for (const snapshot of actorSnapshots) {
    const gamerTag = snapshot.data()?.gamerTag;

    if (snapshot.exists && typeof gamerTag === "string") {
      actorTags.set(snapshot.id, gamerTag);
    }
  }

  const activity = activitySnapshot.docs.map((document) => {
    const data = document.data() as AuditLogDocument;

    return {
      id: document.id,
      action: data.action,
      label: describeAuditAction(data.action),
      actorUid: data.actorUid,
      actorGamerTag: actorTags.get(data.actorUid) ?? null,
      targetType: data.targetType,
      targetId: data.targetId,
      reason: data.reason,
      createdAt: data.createdAt?.toDate() ?? null,
    } satisfies OverviewActivityEntry;
  });

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      suspended: suspendedUsers,
      banned: bannedUsers,
      organisers,
      recentSignups,
    },
    tournaments: {
      total: totalTournaments,
      active: activeTournaments,
      completed: completedTournaments,
      draft: draftTournaments,
    },
    pendingApplications,
    totalRegistrations,
    activity,
    settings,
  };
}
