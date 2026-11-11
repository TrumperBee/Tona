// GCC - unit tests for the pure registration-state decision.
import { describe, expect, it } from "vitest";

import {
  getRegistrationState,
  isFieldFull,
  isRegistrationOpen,
  isTerminalEntryStatus,
  nextCountdownTarget,
  type RegistrationStateInput,
} from "@/lib/tournament/registration-state";
import type { TournamentStatus } from "@/types/domain";

const HOUR = 3_600_000;

function tournament(overrides: {
  readonly status?: TournamentStatus;
  readonly opensIn?: number;
  readonly closesIn?: number;
  readonly count?: number;
  readonly capacity?: number;
}): RegistrationStateInput {
  const now = Date.now();

  return {
    status: overrides.status ?? "registration_open",
    registrationCount: overrides.count ?? 0,
    maxParticipants: overrides.capacity ?? 36,
    registrationOpensAt: new Date(now + (overrides.opensIn ?? -HOUR)),
    registrationClosesAt: new Date(now + (overrides.closesIn ?? HOUR)),
  };
}

describe("getRegistrationState", () => {
  it("reports every stored status", () => {
    const expectations: ReadonlyArray<[TournamentStatus, string]> = [
      ["draft", "not_published"],
      ["registration_open", "open"],
      ["registration_closed", "closed"],
      ["pots_confirmed", "closed"],
      ["fixtures_published", "closed"],
      ["league_phase", "closed"],
      ["knockout", "closed"],
      ["completed", "closed"],
      ["archived", "closed"],
      ["cancelled", "cancelled"],
      ["suspended", "suspended"],
    ];

    for (const [status, expected] of expectations) {
      expect(getRegistrationState(tournament({ status }), new Date())).toBe(expected);
    }
  });

  it("is open only inside the window with room left", () => {
    const now = new Date();
    expect(getRegistrationState(tournament({}), now)).toBe("open");
    expect(isRegistrationOpen(tournament({}), now)).toBe(true);
  });

  it("reports opens_soon before the window starts, including the exact boundary", () => {
    const now = new Date();
    expect(getRegistrationState(tournament({ opensIn: HOUR }), now)).toBe("opens_soon");
    // Exactly at opensAt the window is open (inclusive start).
    const atOpen = { ...tournament({}), registrationOpensAt: now };
    expect(getRegistrationState(atOpen, now)).toBe("open");
  });

  it("reports closed after the window ends, and open at the exact closing boundary", () => {
    const now = new Date();
    expect(getRegistrationState(tournament({ closesIn: -HOUR }), now)).toBe("closed");
    // Exactly at closesAt the window is still open (inclusive end).
    const atClose = { ...tournament({}), registrationClosesAt: now };
    expect(getRegistrationState(atClose, now)).toBe("open");
  });

  it("reports full at capacity even inside the window", () => {
    const now = new Date();
    expect(getRegistrationState(tournament({ count: 36, capacity: 36 }), now)).toBe("full");
    expect(getRegistrationState(tournament({ count: 35, capacity: 36 }), now)).toBe("open");
  });

  it("prefers full over opens_soon so a full field never advertises a countdown", () => {
    expect(getRegistrationState(tournament({ opensIn: HOUR, count: 36 }), new Date())).toBe("full");
  });

  it("treats a missing window as closed rather than guessing", () => {
    const broken: RegistrationStateInput = {
      status: "registration_open",
      registrationCount: 0,
      maxParticipants: 36,
      registrationOpensAt: null,
      registrationClosesAt: new Date(Date.now() + HOUR),
    };

    expect(getRegistrationState(broken, new Date())).toBe("closed");
  });

  it("accepts Firestore-style timestamps and ISO strings", () => {
    const now = Date.now();
    const withTimestamps: RegistrationStateInput = {
      status: "registration_open",
      registrationCount: 0,
      maxParticipants: 36,
      registrationOpensAt: { toDate: () => new Date(now - HOUR) },
      registrationClosesAt: { toDate: () => new Date(now + HOUR) },
    };

    expect(getRegistrationState(withTimestamps, new Date())).toBe("open");

    const withIso: RegistrationStateInput = {
      status: "registration_open",
      registrationCount: 0,
      maxParticipants: 36,
      registrationOpensAt: new Date(now - HOUR).toISOString(),
      registrationClosesAt: new Date(now + HOUR).toISOString(),
    };

    expect(getRegistrationState(withIso, new Date())).toBe("open");
  });
});

describe("isFieldFull", () => {
  it("uses the same capacity boundary as getRegistrationState", () => {
    expect(isFieldFull({ registrationCount: 35, maxParticipants: 36 })).toBe(false);
    expect(isFieldFull({ registrationCount: 36, maxParticipants: 36 })).toBe(true);
    expect(isFieldFull({ registrationCount: 40, maxParticipants: 36 })).toBe(true);
    expect(getRegistrationState(tournament({ count: 35, capacity: 36 }), new Date())).toBe("open");
    expect(getRegistrationState(tournament({ count: 36, capacity: 36 }), new Date())).toBe("full");
  });

  it("does not depend on status or the registration window", () => {
    expect(isFieldFull(tournament({ status: "registration_closed", count: 36 }))).toBe(true);
    expect(isFieldFull(tournament({ status: "draft", count: 0 }))).toBe(false);
  });
});

describe("isTerminalEntryStatus", () => {
  it("marks every status from registration_closed onwards as terminal for entries", () => {
    expect(isTerminalEntryStatus("registration_closed")).toBe(true);
    expect(isTerminalEntryStatus("archived")).toBe(true);
    expect(isTerminalEntryStatus("registration_open")).toBe(false);
    expect(isTerminalEntryStatus("draft")).toBe(false);
    expect(isTerminalEntryStatus("suspended")).toBe(false);
    expect(isTerminalEntryStatus("cancelled")).toBe(false);
  });
});

describe("nextCountdownTarget", () => {
  it("counts down to the opening moment before the window starts", () => {
    const entry = tournament({ opensIn: 2 * HOUR });
    const target = nextCountdownTarget(entry, new Date());

    expect(target?.label).toBe("Registration opens");
    expect(target && target.at > Date.now()).toBe(true);
  });

  it("counts down to the closing moment while open", () => {
    const entry = tournament({ closesIn: 30 * 60_000 });
    const target = nextCountdownTarget(entry, new Date());

    expect(target?.label).toBe("Registration closes");
  });

  it("has no countdown once the window is over, full, or the state is terminal", () => {
    expect(nextCountdownTarget(tournament({ closesIn: -HOUR }), new Date())).toBeNull();
    expect(nextCountdownTarget(tournament({ count: 36 }), new Date())).toBeNull();
    expect(
      nextCountdownTarget(tournament({ status: "registration_closed" }), new Date()),
    ).toBeNull();
  });
});
