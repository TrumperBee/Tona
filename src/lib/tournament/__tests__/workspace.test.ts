import { describe, expect, it } from "vitest";

import {
  DRAW_FIELD_SIZE,
  getPotsAvailability,
  getWorkspaceSteps,
  getWorkspaceTabs,
  WORKSPACE_STEP_IDS,
  type WorkspaceStep,
} from "@/lib/tournament/workspace";
import { TOURNAMENT_STATUSES, type TournamentStatus } from "@/types/domain";

function byId(steps: readonly WorkspaceStep[]) {
  return new Map(steps.map((item) => [item.id, item]));
}

function tournament(status: TournamentStatus) {
  return { status };
}

describe("getWorkspaceSteps", () => {
  it("marks the draft tournament as being in setup with every later stage locked", () => {
    const steps = byId(getWorkspaceSteps(tournament("draft")));

    expect(steps.get("setup")?.state).toBe("current");
    expect(steps.get("registration")?.state).toBe("locked");
    expect(steps.get("registration")?.lockReason).toBe("Registration has not opened yet.");
    expect(steps.get("pots")?.lockReason).toBe("Available after registration closes.");
    expect(steps.get("fixtures")?.lockReason).toBe("Available after the draw is confirmed.");
    expect(steps.get("league")?.lockReason).toBe("Available after fixtures are published.");
    expect(steps.get("knockout")?.lockReason).toBe("Available after the league phase completes.");
    expect(steps.get("completed")?.lockReason).toBe("Available after the knockout finishes.");
  });

  it("moves through the forward lifecycle one stage at a time", () => {
    const expectations: Readonly<
      Record<TournamentStatus, { readonly current: string; readonly done: readonly string[] }>
    > = {
      draft: { current: "setup", done: [] },
      registration_open: { current: "registration", done: ["setup"] },
      registration_closed: { current: "pots", done: ["setup", "registration"] },
      pots_confirmed: { current: "fixtures", done: ["setup", "registration", "pots"] },
      fixtures_published: {
        current: "league",
        done: ["setup", "registration", "pots", "fixtures"],
      },
      league_phase: { current: "league", done: ["setup", "registration", "pots", "fixtures"] },
      knockout: {
        current: "knockout",
        done: ["setup", "registration", "pots", "fixtures", "league"],
      },
      completed: {
        current: "",
        done: ["setup", "registration", "pots", "fixtures", "league", "knockout", "completed"],
      },
      archived: {
        current: "",
        done: ["setup", "registration", "pots", "fixtures", "league", "knockout", "completed"],
      },
      cancelled: { current: "", done: ["setup"] },
      suspended: { current: "", done: ["setup"] },
    };

    for (const status of TOURNAMENT_STATUSES) {
      const steps = byId(getWorkspaceSteps(tournament(status)));
      const expected = expectations[status];

      for (const id of WORKSPACE_STEP_IDS) {
        const state = steps.get(id)?.state;

        if (expected.done.includes(id)) {
          expect(state, `${status} / ${id}`).toBe("done");
        } else if (id === expected.current) {
          expect(state, `${status} / ${id}`).toBe("current");
        } else {
          expect(state, `${status} / ${id}`).toBe("locked");
          expect(steps.get(id)?.lockReason, `${status} / ${id} reason`).toBeTruthy();
        }
      }
    }
  });

  it("returns exactly one current step for every in-flight status", () => {
    for (const status of TOURNAMENT_STATUSES) {
      if (
        status === "completed" ||
        status === "archived" ||
        status === "cancelled" ||
        status === "suspended"
      ) {
        continue;
      }

      const current = getWorkspaceSteps(tournament(status)).filter(
        (item) => item.state === "current",
      );

      expect(current, status).toHaveLength(1);
    }
  });

  it("keeps completed tournaments fully done with no lock reasons", () => {
    for (const status of ["completed", "archived"] as const) {
      for (const item of getWorkspaceSteps(tournament(status))) {
        expect(item.state, `${status} / ${item.id}`).toBe("done");
        expect(item.lockReason, `${status} / ${item.id}`).toBeNull();
      }
    }
  });

  it("locks everything after setup when a tournament is cancelled or suspended", () => {
    for (const status of ["cancelled", "suspended"] as const) {
      const steps = byId(getWorkspaceSteps(tournament(status)));

      expect(steps.get("setup")?.state).toBe("done");

      for (const id of WORKSPACE_STEP_IDS.slice(1)) {
        const item = steps.get(id);
        expect(item?.state, `${status} / ${id}`).toBe("locked");
        expect(item?.lockReason, `${status} / ${id}`).toContain(
          status === "cancelled" ? "cancelled" : "suspended",
        );
      }
    }
  });

  it("returns the seven steps in lifecycle order", () => {
    expect(getWorkspaceSteps(tournament("draft")).map((item) => item.id)).toEqual(
      WORKSPACE_STEP_IDS,
    );
  });
});

describe("getPotsAvailability", () => {
  it("is unavailable outside registration_closed", () => {
    for (const status of TOURNAMENT_STATUSES) {
      if (status === "registration_closed") {
        continue;
      }

      expect(getPotsAvailability({ status, registrationCount: 36 }).available, status).toBe(false);
    }
  });

  it("opens only with exactly the 36-player field", () => {
    expect(DRAW_FIELD_SIZE).toBe(36);
    expect(getPotsAvailability({ status: "registration_closed", registrationCount: 36 })).toEqual({
      available: true,
      reason: null,
    });
  });

  it("explains the exact short or over-full field instead of offering a draw", () => {
    const short = getPotsAvailability({
      status: "registration_closed",
      registrationCount: 31,
    });

    expect(short.available).toBe(false);
    expect(short.reason).toContain("exactly 36");
    expect(short.reason).toContain("31");

    const over = getPotsAvailability({
      status: "registration_closed",
      registrationCount: 37,
    });

    expect(over.available).toBe(false);
    expect(over.reason).toContain("37");
  });

  it("falls back to the status gate when a partial document has no count", () => {
    expect(getPotsAvailability({ status: "registration_closed" })).toEqual({
      available: true,
      reason: null,
    });
  });

  it("locks the pots step with the count reason when the field is not 36", () => {
    const steps = byId(getWorkspaceSteps({ status: "registration_closed", registrationCount: 30 }));

    expect(steps.get("pots")?.state).toBe("locked");
    expect(steps.get("pots")?.lockReason).toContain("30");

    const full = byId(getWorkspaceSteps({ status: "registration_closed", registrationCount: 36 }));

    expect(full.get("pots")?.state).toBe("current");
  });
});

describe("getWorkspaceTabs", () => {
  it("keeps overview and settings available in every status", () => {
    for (const status of TOURNAMENT_STATUSES) {
      const tabs = new Map(getWorkspaceTabs(tournament(status)).map((tab) => [tab.segment, tab]));

      expect(tabs.get("")?.available, status).toBe(true);
      expect(tabs.get("settings")?.available, status).toBe(true);
    }
  });

  it("unlocks each competition tool exactly when its stage is reached", () => {
    const expectations: Readonly<Record<string, readonly TournamentStatus[]>> = {
      registrations: [
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
      announcements: [
        "registration_open",
        "registration_closed",
        "pots_confirmed",
        "fixtures_published",
        "league_phase",
        "knockout",
        "completed",
        "archived",
      ],
      pots: [
        "registration_closed",
        "pots_confirmed",
        "fixtures_published",
        "league_phase",
        "knockout",
        "completed",
        "archived",
      ],
      fixtures: [
        "pots_confirmed",
        "fixtures_published",
        "league_phase",
        "knockout",
        "completed",
        "archived",
      ],
      graphics: ["fixtures_published", "league_phase", "knockout", "completed", "archived"],
      results: ["fixtures_published", "league_phase", "knockout", "completed", "archived"],
      standings: ["fixtures_published", "league_phase", "knockout", "completed", "archived"],
      "result-reports": ["fixtures_published", "league_phase", "knockout", "completed", "archived"],
      knockout: ["knockout", "completed", "archived"],
    };

    for (const [segment, statuses] of Object.entries(expectations)) {
      for (const status of TOURNAMENT_STATUSES) {
        const tab = getWorkspaceTabs(tournament(status)).find((item) => item.segment === segment);

        expect(tab?.available, `${segment} / ${status}`).toBe(statuses.includes(status));

        if (!statuses.includes(status)) {
          expect(tab?.notice, `${segment} / ${status} notice`).toBeTruthy();
        }
      }
    }
  });

  it("states the exact unlock condition on a locked tab", () => {
    const tabs = new Map(getWorkspaceTabs(tournament("draft")).map((tab) => [tab.segment, tab]));

    expect(tabs.get("registrations")?.notice).toBe("Available after registration opens.");
    expect(tabs.get("pots")?.notice).toBe("Available after registration closes.");
    expect(tabs.get("fixtures")?.notice).toBe("Available after the draw is confirmed.");
    expect(tabs.get("knockout")?.notice).toBe("Available after the league phase completes.");
  });

  it("keeps only overview, settings and registrations for a cancelled tournament", () => {
    const tabs = getWorkspaceTabs(tournament("cancelled"));
    const available = tabs.filter((tab) => tab.available).map((tab) => tab.segment);

    expect(available).toEqual(["", "registrations", "settings"]);
  });

  it("keeps only overview and settings for a suspended tournament", () => {
    const tabs = getWorkspaceTabs(tournament("suspended"));
    const available = tabs.filter((tab) => tab.available).map((tab) => tab.segment);

    expect(available).toEqual(["", "settings"]);
  });

  it("returns a tab for every workspace navigation item", () => {
    const tabs = getWorkspaceTabs(tournament("draft"));

    expect(tabs).toHaveLength(11);
    expect(new Set(tabs.map((tab) => tab.segment)).size).toBe(11);
  });

  it("returns only plain serialisable data for the client component", () => {
    for (const status of TOURNAMENT_STATUSES) {
      const tabs = getWorkspaceTabs(tournament(status));

      expect(JSON.parse(JSON.stringify(tabs)), status).toEqual(tabs);

      for (const tab of tabs) {
        expect(Object.keys(tab).sort(), status).toEqual([
          "available",
          "label",
          "notice",
          "segment",
        ]);
        expect(
          Object.values(tab).some((value) => typeof value === "function"),
          status,
        ).toBe(false);
      }
    }
  });
});
