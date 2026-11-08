// GCC — shared application types.
// Domain-specific types live next to their module; this barrel exposes only
// types that are used across features.

export type { GameId, PlatformId, SupportedGame } from "@/lib/config/games";
export type { CompetitionFormat, QualificationDestination } from "@/lib/config/formats";
export type { Role } from "@/lib/auth/roles";
export type {
  AccountStatus,
  AdminApplicationDocument,
  ApplicationStatus,
  AuditLogDocument,
  DrawDocument,
  FixtureDraftDocument,
  GameProfileStats,
  HallOfFameDocument,
  KnockoutTieDocument,
  MatchDocument,
  MatchResult,
  MatchStatus,
  MembershipDocument,
  NotificationDocument,
  PlatformAnnouncementDocument,
  PlatformStatsDocument,
  PlayerHistoryDocument,
  ProfileStatTotals,
  ProfileStats,
  PublicProfileDocument,
  RateLimitDocument,
  RegistrationDocument,
  ResultReportDocument,
  ResultReportStatus,
  StageType,
  StandingDocument,
  TournamentAnnouncementDocument,
  TournamentDocument,
  TournamentStatus,
  UserDocument,
  UserRole,
} from "@/types/domain";
