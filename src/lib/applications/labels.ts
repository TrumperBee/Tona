// GCC - shared organiser application labels.
//
// Used by the applicant page and the Super Admin queue so a status always reads
// the same way. This module has no Firebase or server-only imports.
import type { BadgeTone } from "@/components/ui/card";
import type { ApplicationStatus, CommunityType, ExpectedPlayerRange } from "@/types/domain";

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  revoked: "Revoked",
};

export const APPLICATION_STATUS_TONES: Record<ApplicationStatus, BadgeTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  withdrawn: "neutral",
  revoked: "danger",
};

export const COMMUNITY_TYPE_LABELS: Record<CommunityType, string> = {
  university_club: "University or college club",
  online_community: "Online community",
  friends_group: "Friends group",
  streamer_creator: "Streamer or creator community",
  other: "Other",
};

export const EXPECTED_PLAYER_LABELS: Record<ExpectedPlayerRange, string> = {
  "under 36": "Under 36 players",
  "36-72": "36-72 players",
  "73-150": "73-150 players",
  "150+": "150+ players",
};
