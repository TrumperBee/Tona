// GCC - tournament status presentation.
//
// One source for the label, tone and explanation shown wherever a tournament
// status appears. `tone` maps to the Badge tones in src/components/ui/card.tsx.
import type { BadgeTone } from "@/components/ui/card";
import type { TournamentStatus } from "@/types/domain";

export interface TournamentStatusMeta {
  readonly label: string;
  readonly tone: BadgeTone;
  readonly description: string;
  /** True while the competition is running and results can change. */
  readonly live: boolean;
}

export const TOURNAMENT_STATUS_META: Record<TournamentStatus, TournamentStatusMeta> = {
  draft: {
    label: "Draft",
    tone: "neutral",
    description: "The organiser is still preparing this competition.",
    live: false,
  },
  registration_open: {
    label: "Registration open",
    tone: "info",
    description: "Entries are open. Accepted participants enter the pot draw.",
    live: true,
  },
  registration_closed: {
    label: "Registration closed",
    tone: "warning",
    description: "Entries are closed while the organiser finalises the field.",
    live: false,
  },
  pots_confirmed: {
    label: "Pots confirmed",
    tone: "info",
    description: "The field is set into four pots of nine ahead of the draw.",
    live: false,
  },
  fixtures_published: {
    label: "Fixtures published",
    tone: "info",
    description: "Every participant's eight league-phase fixtures are published.",
    live: true,
  },
  league_phase: {
    label: "League phase live",
    tone: "success",
    description: "League-phase matches are being played and verified.",
    live: true,
  },
  knockout: {
    label: "Knockout stage",
    tone: "gold",
    description: "The play-offs and knockout rounds are under way.",
    live: true,
  },
  completed: {
    label: "Completed",
    tone: "success",
    description: "The final has been played and the champion is recorded.",
    live: false,
  },
  archived: {
    label: "Archived",
    tone: "neutral",
    description: "This season is preserved in the archives.",
    live: false,
  },
  cancelled: {
    label: "Cancelled",
    tone: "danger",
    description: "The organiser cancelled this competition before it finished.",
    live: false,
  },
  suspended: {
    label: "Suspended",
    tone: "danger",
    description: "The competition is paused pending an organiser review.",
    live: false,
  },
};
