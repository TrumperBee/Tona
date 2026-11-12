// GCC — shared application types.
// Domain-specific types live next to their module; this barrel exposes only
// types that are used across features.

export type { GameId, PlatformId, SupportedGame } from "@/lib/config/games";
export type { CompetitionFormat, QualificationDestination } from "@/lib/config/formats";
export type { Role } from "@/lib/auth/roles";
export type {
  AccountStatus,
  AdminApplicationDocument,
  ApplicationStateDocument,
  ApplicationStatus,
  AuditLogDocument,
  CommunityType,
  ExpectedPlayerRange,
  DrawDocument,
  FixtureDraftDocument,
  FixtureDraftPlayerStats,
  FixtureDraftReport,
  FixtureDraftStats,
  GameProfileStats,
  HallOfFameDocument,
  KnockoutTieDocument,
  MatchDocument,
  MatchResult,
  MatchStatus,
  MatchdayDocument,
  MembershipDocument,
  NotificationDocument,
  AnnouncementSeverity,
  PlatformAnnouncementDocument,
  PlatformSettingsDocument,
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
