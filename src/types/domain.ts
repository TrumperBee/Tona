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

export const MATCH_STATUSES = [
  "scheduled",
  "awaiting_result",
  "awaiting_confirmation",
  "confirmed",
  "disputed",
  "completed",
  "forfeited",
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const STAGE_TYPES = ["league", "playoff", "r16", "qf", "sf", "final"] as const;
export type StageType = (typeof STAGE_TYPES)[number];

export const APPLICATION_STATUSES = ["pending", "approved", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const DISPUTE_STATUSES = ["open", "under_review", "resolved", "rejected"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const RESULT_SOURCES = ["participant", "admin", "forfeit"] as const;
export type ResultSource = (typeof RESULT_SOURCES)[number];

export const REGISTRATION_STATUSES = ["registered", "withdrawn", "removed"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const KNOCKOUT_TIE_STATUSES = ["scheduled", "in_progress", "completed"] as const;
export type KnockoutTieStatus = (typeof KNOCKOUT_TIE_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "system",
  "tournament",
  "fixture",
  "result",
  "dispute",
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

export interface UserDocument {
  readonly fullName: string;
  readonly gamerTag: string;
  readonly gamerTagLower: string;
  readonly email: string;
  readonly whatsappE164: string | null;
  readonly country: string;
  readonly preferredGame: GameId;
  readonly platform: PlatformId;
  readonly photoUrl: string | null;
  readonly status: AccountStatus;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface PublicProfileDocument {
  readonly gamerTag: string;
  readonly country: string;
  readonly preferredGame: GameId;
  readonly platform: PlatformId;
  readonly photoUrl: string | null;
  readonly tournaments: number;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly titles: number;
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
  readonly deadlineAt: Timestamp | null;
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
  readonly source: ResultSource;
}

export interface PendingMatchResult {
  readonly submittedBy: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly submittedAt: Timestamp;
}

export interface MatchDocument {
  readonly stage: StageType;
  readonly matchday: number;
  readonly homeUid: string;
  readonly awayUid: string;
  readonly homeTag: string;
  readonly awayTag: string;
  readonly participants: readonly [string, string];
  readonly status: MatchStatus;
  readonly scheduledAt: Timestamp;
  readonly deadlineAt: Timestamp;
  readonly result: MatchResult | null;
  readonly pendingResult: PendingMatchResult | null;
  readonly confirmedAt: Timestamp | null;
  readonly updatedAt: Timestamp;
}

export interface DisputeSubmission {
  readonly submittedBy: string;
  readonly note: string;
  readonly submittedAt: Timestamp;
}

export interface DisputeDocument {
  readonly matchId: string;
  readonly raisedBy: string;
  readonly submissions: readonly DisputeSubmission[];
  readonly evidenceNotes: string;
  readonly status: DisputeStatus;
  readonly resolution: string | null;
  readonly resolvedBy: string | null;
  readonly reason: string | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
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
