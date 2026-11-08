// GCC — Firestore collection names and typed path builders.
//
// All document paths used by server code come from this module so writes and
// rules cannot drift apart. Document IDs are server-generated; path builders
// reject empty segments and slashes because either would create a different
// document path.

export const COLLECTIONS = {
  users: "users",
  publicProfiles: "publicProfiles",
  gamerTags: "gamerTags",
  adminApplications: "adminApplications",
  tournaments: "tournaments",
  announcements: "announcements",
  hallOfFame: "hallOfFame",
  auditLogs: "auditLogs",
  rateLimits: "rateLimits",
  platformStats: "platformStats",
} as const;

export const SUBCOLLECTIONS = {
  notifications: "notifications",
  memberships: "memberships",
  history: "history",
  registrations: "registrations",
  draw: "draw",
  fixtureDrafts: "fixtureDrafts",
  matches: "matches",
  resultReports: "resultReports",
  standings: "standings",
  knockoutTies: "knockoutTies",
  announcements: "announcements",
} as const;

export const DOCUMENTS = {
  current: "current",
  summary: "summary",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
export type SubcollectionName = (typeof SUBCOLLECTIONS)[keyof typeof SUBCOLLECTIONS];

function segment(value: string, label: string): string {
  if (value.length === 0 || value.includes("/")) {
    throw new Error(`Invalid ${label}: document path segments cannot be empty or contain "/".`);
  }

  return value;
}

function collectionPath(...parts: readonly string[]): string {
  return parts.filter((part, index) => index === 0 || segment(part, "collection")).join("/");
}

function documentPath(...parts: readonly string[]): string {
  return parts
    .map((part, index) =>
      index % 2 === 0 ? segment(part, "collection") : segment(part, "document"),
    )
    .join("/");
}

/** Typed paths for every collection and document in the Phase 2 data model. */
export const paths = {
  users: () => COLLECTIONS.users,
  user: (uid: string) => documentPath(COLLECTIONS.users, uid),
  userNotifications: (uid: string) =>
    collectionPath(COLLECTIONS.users, uid, SUBCOLLECTIONS.notifications),
  userNotification: (uid: string, notificationId: string) =>
    documentPath(COLLECTIONS.users, uid, SUBCOLLECTIONS.notifications, notificationId),
  userMemberships: (uid: string) =>
    collectionPath(COLLECTIONS.users, uid, SUBCOLLECTIONS.memberships),
  userMembership: (uid: string, tournamentId: string) =>
    documentPath(COLLECTIONS.users, uid, SUBCOLLECTIONS.memberships, tournamentId),

  publicProfiles: () => COLLECTIONS.publicProfiles,
  publicProfile: (uid: string) => documentPath(COLLECTIONS.publicProfiles, uid),
  publicProfileHistory: (uid: string) =>
    collectionPath(COLLECTIONS.publicProfiles, uid, SUBCOLLECTIONS.history),
  publicProfileHistoryEntry: (uid: string, tournamentId: string) =>
    documentPath(COLLECTIONS.publicProfiles, uid, SUBCOLLECTIONS.history, tournamentId),

  gamerTags: () => COLLECTIONS.gamerTags,
  gamerTag: (gamerTagLower: string) => documentPath(COLLECTIONS.gamerTags, gamerTagLower),

  adminApplications: () => COLLECTIONS.adminApplications,
  adminApplication: (applicationId: string) =>
    documentPath(COLLECTIONS.adminApplications, applicationId),

  tournaments: () => COLLECTIONS.tournaments,
  tournament: (tournamentId: string) => documentPath(COLLECTIONS.tournaments, tournamentId),
  tournamentRegistrations: (tournamentId: string) =>
    collectionPath(COLLECTIONS.tournaments, tournamentId, SUBCOLLECTIONS.registrations),
  tournamentRegistration: (tournamentId: string, uid: string) =>
    documentPath(COLLECTIONS.tournaments, tournamentId, SUBCOLLECTIONS.registrations, uid),
  tournamentDraw: (tournamentId: string) =>
    collectionPath(COLLECTIONS.tournaments, tournamentId, SUBCOLLECTIONS.draw),
  tournamentDrawCurrent: (tournamentId: string) =>
    documentPath(COLLECTIONS.tournaments, tournamentId, SUBCOLLECTIONS.draw, DOCUMENTS.current),
  tournamentFixtureDrafts: (tournamentId: string) =>
    collectionPath(COLLECTIONS.tournaments, tournamentId, SUBCOLLECTIONS.fixtureDrafts),
  tournamentFixtureDraftCurrent: (tournamentId: string) =>
    documentPath(
      COLLECTIONS.tournaments,
      tournamentId,
      SUBCOLLECTIONS.fixtureDrafts,
      DOCUMENTS.current,
    ),
  tournamentMatches: (tournamentId: string) =>
    collectionPath(COLLECTIONS.tournaments, tournamentId, SUBCOLLECTIONS.matches),
  tournamentMatch: (tournamentId: string, matchId: string) =>
    documentPath(COLLECTIONS.tournaments, tournamentId, SUBCOLLECTIONS.matches, matchId),
  tournamentResultReports: (tournamentId: string) =>
    collectionPath(COLLECTIONS.tournaments, tournamentId, SUBCOLLECTIONS.resultReports),
  tournamentResultReport: (tournamentId: string, reportId: string) =>
    documentPath(COLLECTIONS.tournaments, tournamentId, SUBCOLLECTIONS.resultReports, reportId),
  tournamentStandings: (tournamentId: string) =>
    collectionPath(COLLECTIONS.tournaments, tournamentId, SUBCOLLECTIONS.standings),
  tournamentStanding: (tournamentId: string, uid: string) =>
    documentPath(COLLECTIONS.tournaments, tournamentId, SUBCOLLECTIONS.standings, uid),
  tournamentKnockoutTies: (tournamentId: string) =>
    collectionPath(COLLECTIONS.tournaments, tournamentId, SUBCOLLECTIONS.knockoutTies),
  tournamentKnockoutTie: (tournamentId: string, tieId: string) =>
    documentPath(COLLECTIONS.tournaments, tournamentId, SUBCOLLECTIONS.knockoutTies, tieId),
  tournamentAnnouncements: (tournamentId: string) =>
    collectionPath(COLLECTIONS.tournaments, tournamentId, SUBCOLLECTIONS.announcements),
  tournamentAnnouncement: (tournamentId: string, announcementId: string) =>
    documentPath(
      COLLECTIONS.tournaments,
      tournamentId,
      SUBCOLLECTIONS.announcements,
      announcementId,
    ),

  announcements: () => COLLECTIONS.announcements,
  announcement: (announcementId: string) => documentPath(COLLECTIONS.announcements, announcementId),

  hallOfFame: () => COLLECTIONS.hallOfFame,
  hallOfFameEntry: (entryId: string) => documentPath(COLLECTIONS.hallOfFame, entryId),

  auditLogs: () => COLLECTIONS.auditLogs,
  auditLog: (logId: string) => documentPath(COLLECTIONS.auditLogs, logId),

  rateLimits: () => COLLECTIONS.rateLimits,
  rateLimit: (key: string) => documentPath(COLLECTIONS.rateLimits, key),

  platformStats: () => COLLECTIONS.platformStats,
  platformStatsSummary: () => documentPath(COLLECTIONS.platformStats, DOCUMENTS.summary),
} as const;

/** Returns a stable document path for a user notification. */
export function userNotificationPath(uid: string, notificationId: string): string {
  return paths.userNotification(uid, notificationId);
}
