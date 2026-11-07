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
  HallOfFameDocument,
  KnockoutTieDocument,
  MatchDocument,
  MatchStatus,
  NotificationDocument,
  PlatformAnnouncementDocument,
  PlatformStatsDocument,
  PublicProfileDocument,
  RateLimitDocument,
  RegistrationDocument,
  StageType,
  StandingDocument,
  TournamentAnnouncementDocument,
  TournamentDocument,
  TournamentStatus,
  UserDocument,
  UserRole,
} from "@/types/domain";
