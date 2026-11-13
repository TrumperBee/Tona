// GCC - pure tournament workspace stage and tool-availability logic.
//
// This module is deliberately free of server-only imports so unit tests can
// exercise every lifecycle status directly. It answers two questions from the
// tournament document alone:
//   1. Which lifecycle stage is the competition in? (the stepper)
//   2. Which workspace tools are usable right now? (the tab notices)
// Both functions are total over TournamentStatus: no status can crash them.
import { organiserTournamentWorkspace } from "@/lib/config/navigation";
import { LEAGUE_MATCH_COUNT } from "@/lib/engine/fixtures/types";
import type { TournamentDocument, TournamentStatus } from "@/types/domain";

/** The seven lifecycle stages every GCC competition follows, in order. */
export const WORKSPACE_STEP_IDS = [
  "setup",
  "registration",
  "pots",
  "fixtures",
  "league",
  "knockout",
  "completed",
] as const;
export type WorkspaceStepId = (typeof WORKSPACE_STEP_IDS)[number];

export type WorkspaceStepState = "done" | "current" | "locked";

export interface WorkspaceStep {
  readonly id: WorkspaceStepId;
  readonly label: string;
  readonly state: WorkspaceStepState;
  /** Present only when state is "locked"; explains the exact condition. */
  readonly lockReason: string | null;
}

export interface WorkspaceTab {
  readonly segment: string;
  readonly label: string;
  readonly available: boolean;
  /** Present only when the tab is not available yet. */
  readonly notice: string | null;
}

const STEP_LABELS: Readonly<Record<WorkspaceStepId, string>> = {
  setup: "Setup",
  registration: "Registration",
  pots: "Pots and draw",
  fixtures: "Fixtures",
  league: "League phase",
  knockout: "Knockout",
  completed: "Completed",
};

/** Set once the organiser has confirmed the four pots of nine. */
const LOCK_REASONS: Readonly<Record<WorkspaceStepId, string>> = {
  setup: "The tournament has not been created.",
  registration: "Registration has not opened yet.",
  pots: "Available after registration closes.",
  fixtures: "Available after the draw is confirmed.",
  league: "Available after fixtures are published.",
  knockout: "Available after the league phase completes.",
  completed: "Available after the knockout finishes.",
};

const SUSPENDED_REASON =
  "Unavailable while the tournament is suspended. The platform restores the exact stage after review.";
const CANCELLED_REASON = "The tournament was cancelled before this stage was reached.";

function step(
  id: WorkspaceStepId,
  state: WorkspaceStepState,
  lockReason: string | null = null,
): WorkspaceStep {
  return { id, label: STEP_LABELS[id], state, lockReason };
}

function steps(
  current: WorkspaceStepId,
  ...doneSteps: readonly WorkspaceStepId[]
): readonly WorkspaceStep[] {
  const doneSet = new Set(doneSteps);
  const currentIndex = WORKSPACE_STEP_IDS.indexOf(current);

  return WORKSPACE_STEP_IDS.map((id) => {
    if (doneSet.has(id)) {
      return step(id, "done");
    }

    if (id === current) {
      return step(id, "current");
    }

    // A valid lifecycle lists every reached stage explicitly; anything before
    // the current index is defensive and treated as reached rather than locked.
    if (WORKSPACE_STEP_IDS.indexOf(id) < currentIndex) {
      return step(id, "done");
    }

    return step(id, "locked", LOCK_REASONS[id]);
  });
}

/** The fixed launch field: four pots of nine. */
export const DRAW_FIELD_SIZE = 36;

export interface PotsAvailability {
  readonly available: boolean;
  /** The exact reason the draw cannot be prepared yet, or null when it can. */
  readonly reason: string | null;
}

type WorkspaceTournament = Pick<TournamentDocument, "status"> &
  Partial<
    Pick<TournamentDocument, "registrationCount" | "maxParticipants" | "leagueMatchesCompleted">
  >;

/**
 * The draw opens only when registration has closed with exactly the full field.
 * A closed registration with a short field cannot be confirmed, so the pots
 * stage explains the exact count instead of offering an impossible draw.
 */
export function getPotsAvailability(tournament: WorkspaceTournament): PotsAvailability {
  if (tournament.status !== "registration_closed") {
    return { available: false, reason: null };
  }

  // Without a count only the status gate can be enforced (unit tests and
  // partial documents); every real caller passes the full tournament.
  if (typeof tournament.registrationCount !== "number") {
    return { available: true, reason: null };
  }

  if (tournament.registrationCount !== DRAW_FIELD_SIZE) {
    return {
      available: false,
      reason: `The draw needs exactly ${DRAW_FIELD_SIZE} registered players; this competition has ${tournament.registrationCount}.`,
    };
  }

  return { available: true, reason: null };
}

/**
 * Returns the seven lifecycle steps with their state for one tournament.
 * `done` stages are behind it, `current` is where its status sits, and every
 * later stage carries the exact condition that unlocks it.
 */
export function getWorkspaceSteps(tournament: WorkspaceTournament): readonly WorkspaceStep[] {
  switch (tournament.status) {
    case "draft":
      return steps("setup");
    case "registration_open":
      return steps("registration", "setup");
    case "registration_closed": {
      const base = steps("pots", "setup", "registration");
      const availability = getPotsAvailability(tournament);

      if (availability.available) {
        return base;
      }

      // The stage is reached, but the field cannot be drawn yet. Mark it locked
      // with the exact count so the stepper and the page agree on the reason.
      return base.map((item) =>
        item.id === "pots"
          ? step("pots", "locked", availability.reason ?? LOCK_REASONS.pots)
          : item,
      );
    }
    case "pots_confirmed":
      return steps("fixtures", "setup", "registration", "pots");
    case "fixtures_published":
      return steps("league", "setup", "registration", "pots", "fixtures");
    case "league_phase": {
      const base = steps("league", "setup", "registration", "pots", "fixtures");

      if ((tournament.leagueMatchesCompleted ?? 0) < LEAGUE_MATCH_COUNT) {
        return base;
      }

      // The league is played out but not closed yet. The organiser must open the
      // Knockout tab to close it, so the stepper names that exact next action
      // instead of claiming the stage is still unreachable.
      return base.map((item) =>
        item.id === "knockout"
          ? step(
              "knockout",
              "locked",
              `All ${LEAGUE_MATCH_COUNT} league results are recorded. Open the Knockout tab and close the league phase to unlock the bracket.`,
            )
          : item,
      );
    }
    case "knockout":
      return steps("knockout", "setup", "registration", "pots", "fixtures", "league");
    case "completed":
    case "archived":
      // The competition ran to the end: every lifecycle stage is behind it.
      return WORKSPACE_STEP_IDS.map((id) => step(id, "done"));
    case "cancelled":
      // Only setup is provable from the document; the stage reached before
      // cancellation is not stored, so later stages stay locked honestly.
      return WORKSPACE_STEP_IDS.map((id) =>
        id === "setup" ? step(id, "done") : step(id, "locked", CANCELLED_REASON),
      );
    case "suspended":
      // The prior stage is not stored on the document; the platform restores
      // it after review, so nothing beyond creation is claimed here.
      return WORKSPACE_STEP_IDS.map((id) =>
        id === "setup" ? step(id, "done") : step(id, "locked", SUSPENDED_REASON),
      );
  }
}

/** Tabs that are usable at or after these statuses. */
const TAB_AVAILABILITY: Readonly<
  Record<string, { readonly statuses: readonly TournamentStatus[]; readonly notice: string }>
> = {
  "": { statuses: [], notice: "" },
  registrations: {
    statuses: [
      "registration_open",
      "registration_closed",
      "pots_confirmed",
      "fixtures_published",
      "league_phase",
      "knockout",
      "completed",
      "archived",
      "cancelled",
    ],
    notice: "Available after registration opens.",
  },
  pots: {
    statuses: [
      "registration_closed",
      "pots_confirmed",
      "fixtures_published",
      "league_phase",
      "knockout",
      "completed",
      "archived",
    ],
    notice: "Available after registration closes.",
  },
  fixtures: {
    statuses: [
      "pots_confirmed",
      "fixtures_published",
      "league_phase",
      "knockout",
      "completed",
      "archived",
    ],
    notice: "Available after the draw is confirmed.",
  },
  results: {
    statuses: ["fixtures_published", "league_phase", "knockout", "completed", "archived"],
    notice: "Available once fixtures are published.",
  },
  standings: {
    statuses: ["fixtures_published", "league_phase", "knockout", "completed", "archived"],
    notice: "Available once fixtures are published.",
  },
  knockout: {
    // The league phase is included because closing it happens on the Knockout
    // tab; without this the organiser could never reach the close action.
    statuses: ["league_phase", "knockout", "completed", "archived"],
    notice: "Available after the league phase completes.",
  },
  "result-reports": {
    statuses: ["fixtures_published", "league_phase", "knockout", "completed", "archived"],
    notice: "Available once fixtures are published.",
  },
  announcements: {
    statuses: [
      "registration_open",
      "registration_closed",
      "pots_confirmed",
      "fixtures_published",
      "league_phase",
      "knockout",
      "completed",
      "archived",
    ],
    notice: "Available after registration opens.",
  },
  graphics: {
    statuses: ["fixtures_published", "league_phase", "knockout", "completed", "archived"],
    notice: "Available after fixtures are published.",
  },
  settings: {
    statuses: [],
    notice: "",
  },
};

/**
 * Returns the eleven workspace tabs with an honest availability flag and, when a
 * tab is not usable yet, the exact condition that unlocks it. Overview and
 * Settings are always available; a suspended tournament keeps only them.
 *
 * The result is plain serialisable data: it crosses the Server/Client boundary
 * into `WorkspaceTabs`, so it must never carry component references. Labels and
 * icons are resolved from the shared navigation model inside the client.
 */
export function getWorkspaceTabs(
  tournament: Pick<TournamentDocument, "status">,
): readonly WorkspaceTab[] {
  const status = tournament.status;

  return organiserTournamentWorkspace.map((item) => {
    const availability = TAB_AVAILABILITY[item.segment];
    const base = { segment: item.segment, label: item.label };

    if (item.segment === "" || item.segment === "settings") {
      return { ...base, available: true, notice: null };
    }

    if (status === "suspended") {
      return { ...base, available: false, notice: SUSPENDED_REASON };
    }

    if (status === "cancelled" && item.segment !== "registrations") {
      return { ...base, available: false, notice: CANCELLED_REASON };
    }

    const available = availability.statuses.includes(status);

    return { ...base, available, notice: available ? null : availability.notice };
  });
}
