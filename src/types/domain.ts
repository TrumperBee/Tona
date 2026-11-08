// GCC — Firestore domain types.
//
// These types describe documents as the server writes them. Timestamps are
// Firestore Timestamp values on the client SDK type surface; Admin SDK writes
// use the structurally compatible server Timestamp.
import type { Timestamp } from "firebase/firestore";

import type { TournamentFormatId } from "@/lib/config/formats";
import type { GameId, PlatformId } from "@/lib/config/games";

export const USER_ROLES = ["user", "organiser", "super_admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "suspended", "banned"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const TOURNAMENT_STATUSES = [
  "draft",
  "registration_open",
  "registration_closed",
  "pots_confirmed",
  "fixtures_published",
  "league_phase",
  "knockout",
  "completed",
  "archived",
  "suspended",
] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

// Results are entered by the tournament owner (or Super Admin) only. There is
// no player submission or confirmation stage, so a match is either waiting to
// be played or has a final result recorded by an authorised admin.
export const MATCH_STATUSES = ["scheduled", "completed"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const STAGE_TYPES = ["league", "playoff", "r16", "qf", "sf", "final"] as const;
export type StageType = (typeof STAGE_TYPES)[number];

export const APPLICATION_STATUSES = ["pending", "approved", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const RESULT_REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;
export type ResultReportStatus = (typeof RESULT_REPORT_STATUSES)[number];

export const REGISTRATION_STATUSES = ["registered", "withdrawn", "removed"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const KNOCKOUT_TIE_STATUSES = ["scheduled", "in_progress", "completed"] as const;
export type KnockoutTieStatus = (typeof KNOCKOUT_TIE_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "system",
  "tournament",
  "fixture",
  "result",
  "result_report",
  "announcement",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Allowed tournament status transitions. `archived` is terminal. */
export const TOURNAMENT_TRANSITIONS: Readonly<
  Record<TournamentStatus, readonly TournamentStatus[]>
> = {
  draft: ["registration_open", "suspended"],
  registration_open: ["registration_closed", "suspended"],
  registration_closed: ["pots_confirmed", "suspended"],
  pots_confirmed: ["fixtures_published", "suspended"],
  fixtures_published: ["league_phase", "suspended"],
  league_phase: ["knockout", "completed", "suspended"],
  knockout: ["completed", "suspended"],
  completed: ["archived"],
  archived: [],
  // A suspended tournament may be resumed at any non-archived stage after a
  // Super Admin review. The exact prior state is restored by server code.
  suspended: [
    "draft",
    "registration_open",
    "registration_closed",
    "pots_confirmed",
    "fixtures_published",
    "league_phase",
    "knockout",
    "completed",
  ],
};

/** Returns true when a tournament may move from one status to another. */
export function canTransition(from: TournamentStatus, to: TournamentStatus): boolean {
  const allowed = TOURNAMENT_TRANSITIONS[from];
  return allowed?.includes(to) ?? false;
}

// The authoritative role is the Firebase custom claim. Any `role` value kept
// on this document is display-only and must never be used for authorisation.
export interface UserDocument {
  readonly fullName: string;
  readonly gamerTag: string;
  readonly gamerTagLower: string;
  readonly email: string;
  readonly whatsappE164: string | null;
  readonly country: string;
  readonly preferredGame: GameId;
  readonly platform: PlatformId;
  readonly community: string | null;
  readonly favouriteClub: string | null;
  readonly photoUrl: string | null;
  readonly avatarUrl: string | null;
  readonly avatarPublicId: string | null;
  readonly role?: UserRole;
  readonly status: AccountStatus;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface ProfileStatTotals {
  readonly tournaments: number;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly titles: number;
}

export interface GameProfileStats extends ProfileStatTotals {
  readonly rating: number | null;
  readonly ratedMatches: number;
}

/**
 * Typed profile aggregates. Phase 17 computes these values; until then the
 * server writes the zero default. `byGame` is partial because a player only
 * has entries for games they have actually played.
 */
export interface ProfileStats {
  readonly overall: ProfileStatTotals;
  readonly byGame: Readonly<Partial<Record<GameId, GameProfileStats>>>;
}

export const EMPTY_PROFILE_STATS: ProfileStats = {
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
};

export interface PublicProfileDocument {
  readonly gamerTag: string;
  readonly gamerTagLower: string;
  readonly country: string;
  readonly preferredGame: GameId;
  readonly platform: PlatformId;
  readonly community: string | null;
  readonly favouriteClub: string | null;
  readonly photoUrl: string | null;
  readonly avatarUrl: string | null;
  readonly avatarPublicId: string | null;
  readonly stats: ProfileStats;
}

/**
 * Server-written "My Tournaments" entry. Owning the parent user document is
 * enough to read it; no tournament read is required.
 */
export interface MembershipDocument {
  readonly tournamentId: string;
  readonly slug: string;
  readonly name: string;
  readonly gameId: GameId;
  readonly status: TournamentStatus;
  readonly registeredAt: Timestamp;
}

/** Server-written public career history entry for a completed tournament. */
export interface PlayerHistoryDocument {
  readonly tournamentName: string;
  readonly slug: string;
  readonly season: string;
  readonly gameId: GameId;
  readonly finalPosition: number;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly wonTitle: boolean;
  readonly completedAt: Timestamp;
}

export interface GamerTagReservation {
  readonly uid: string;
  readonly createdAt: Timestamp;
}

export interface AdminApplicationDocument {
  readonly uid: string;
  readonly communityName: string;
  readonly experience: string;
  readonly motivation: string;
  readonly expectedPlayers: number;
  readonly contactEmail: string;
  readonly contactWhatsappE164: string | null;
  readonly status: ApplicationStatus;
  readonly reviewedBy: string | null;
  readonly reviewedAt: Timestamp | null;
  readonly reviewNote: string | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface TournamentDocument {
  readonly ownerUid: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly gameId: GameId;
  readonly formatId: TournamentFormatId;
  readonly coverImageUrl: string | null;
  readonly rules: string;
  readonly matchDurationMinutes: number;
  /** IANA identifier, e.g. Africa/Nairobi. */
  readonly timezone: string;
  readonly registrationOpensAt: Timestamp;
  readonly registrationClosesAt: Timestamp;
  readonly startsAt: Timestamp;
  readonly maxParticipants: number;
  readonly registrationCount: number;
  readonly status: TournamentStatus;
  readonly season: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface RegistrationDocument {
  readonly tournamentId: string;
  readonly gamerTag: string;
  readonly country: string;
  readonly photoUrl: string | null;
  readonly status: RegistrationStatus;
  readonly registeredAt: Timestamp;
}

export type PotNumber = "1" | "2" | "3" | "4";

export interface DrawDocument {
  readonly pots: Readonly<Record<PotNumber, readonly string[]>>;
  readonly method: "manual" | "shuffle";
  readonly shuffleSeed: string | null;
  readonly confirmedAt: Timestamp | null;
  readonly confirmedBy: string | null;
}

export interface DraftFixture {
  readonly id: string;
  readonly matchday: number;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly scheduledAt: Timestamp | null;
}

export interface FixtureValidationIssue {
  readonly code: string;
  readonly message: string;
}

export interface FixtureDraftDocument {
  readonly generatedBy: string;
  readonly generatedAt: Timestamp;
  readonly fixtures: readonly DraftFixture[];
  readonly validation: {
    readonly valid: boolean;
    readonly issues: readonly FixtureValidationIssue[];
  };
}

export interface MatchResult {
  readonly homeGoals: number;
  readonly awayGoals: number;
  /** UID of the tournament owner or Super Admin who recorded the result. */
  readonly enteredBy: string;
  readonly enteredAt: Timestamp;
  readonly lastEditedBy?: string;
  readonly lastEditedAt?: Timestamp;
  readonly editCount: number;
}

export interface MatchDocument {
  readonly tournamentId: string;
  readonly stage: StageType;
  readonly matchday: number;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly participants: readonly [string, string];
  readonly status: MatchStatus;
  readonly scheduledAt: Timestamp;
  readonly result: MatchResult | null;
  readonly updatedAt: Timestamp;
}

/**
 * A player-to-admin "Report a problem" message about a recorded result. It is
 * not an official result workflow: the admin may resolve or dismiss it, and
 * the audit log records any result correction separately.
 */
export interface ResultReportDocument {
  readonly matchId: string;
  readonly reportedBy: string;
  readonly reportedByTag: string;
  readonly reason: string;
  readonly status: ResultReportStatus;
  readonly adminNote: string | null;
  readonly resolvedBy: string | null;
  readonly resolvedAt: Timestamp | null;
  readonly createdAt: Timestamp;
}

export interface StandingDocument {
  readonly gamerTag: string;
  readonly MP: number;
  readonly W: number;
  readonly D: number;
  readonly L: number;
  readonly GF: number;
  readonly GA: number;
  readonly GD: number;
  readonly Pts: number;
  readonly position: number;
  readonly qualificationBand: string | null;
}

export interface KnockoutLeg {
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
}

export interface KnockoutTieDocument {
  readonly round: StageType;
  readonly seeds: {
    readonly home: number;
    readonly away: number;
  };
  readonly legs: readonly KnockoutLeg[];
  readonly aggregate: {
    readonly homeGoals: number;
    readonly awayGoals: number;
  };
  readonly winnerUid: string | null;
  readonly status: KnockoutTieStatus;
}

export interface TournamentAnnouncementDocument {
  readonly title: string;
  readonly body: string;
  readonly authorUid: string;
  readonly publishedAt: Timestamp;
}

export interface PlatformAnnouncementDocument {
  readonly title: string;
  readonly body: string;
  readonly authorUid: string;
  readonly publishedAt: Timestamp;
}

export interface NotificationDocument {
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly link: string | null;
  readonly read: boolean;
  readonly createdAt: Timestamp;
}

export interface HallOfFameStats {
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
}

export interface HallOfFameDocument {
  readonly tournamentId: string;
  readonly season: string;
  readonly championUid: string;
  readonly championTag: string;
  readonly finalistUid: string;
  readonly finalistTag: string;
  readonly thirdPlace: {
    readonly uid: string;
    readonly tag: string;
  } | null;
  readonly stats: HallOfFameStats;
}

export interface AuditLogDocument {
  readonly actorUid: string;
  readonly actorRole: UserRole;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly tournamentId: string | null;
  readonly before: unknown;
  readonly after: unknown;
  readonly reason: string | null;
  readonly createdAt: Timestamp;
}

export interface RateLimitDocument {
  readonly key: string;
  readonly count: number;
  readonly windowStart: number;
  readonly expiresAt: number;
  readonly updatedAt: number;
}

export interface PlatformStatsDocument {
  readonly totalUsers: number;
  readonly totalTournaments: number;
  readonly totalMatches: number;
  readonly activeTournaments: number;
  readonly updatedAt: Timestamp;
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export function isAccountStatus(value: unknown): value is AccountStatus {
  return typeof value === "string" && (ACCOUNT_STATUSES as readonly string[]).includes(value);
}

export function isTournamentStatus(value: unknown): value is TournamentStatus {
  return typeof value === "string" && (TOURNAMENT_STATUSES as readonly string[]).includes(value);
}
