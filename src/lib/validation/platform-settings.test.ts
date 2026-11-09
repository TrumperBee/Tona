// GCC - platform settings validation tests.
import { describe, expect, it } from "vitest";

import {
  MAINTENANCE_MESSAGE_MAX,
  platformSettingsSchema,
} from "@/lib/validation/platform-settings";

function valid(overrides: Record<string, unknown> = {}) {
  return {
    maintenanceMode: false,
    maintenanceMessage: "",
    registrationsOpen: true,
    maxActiveTournamentsPerOrganiser: 3,
    applicationCooldownDays: 7,
    ...overrides,
  };
}

describe("platformSettingsSchema", () => {
  it("accepts a complete, valid payload", () => {
    const result = platformSettingsSchema.safeParse(valid());

    expect(result.success).toBe(true);
  });

  it("requires a maintenance message of at least 5 characters when maintenance is on", () => {
    const result = platformSettingsSchema.safeParse(
      valid({ maintenanceMode: true, maintenanceMessage: "down" }),
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["maintenanceMessage"]);
    }
  });

  it("rejects a message longer than the limit", () => {
    const result = platformSettingsSchema.safeParse(
      valid({ maintenanceMessage: "x".repeat(MAINTENANCE_MESSAGE_MAX + 1) }),
    );

    expect(result.success).toBe(false);
  });

  it("enforces the organiser tournament range", () => {
    expect(
      platformSettingsSchema.safeParse(valid({ maxActiveTournamentsPerOrganiser: 0 })).success,
    ).toBe(false);
    expect(
      platformSettingsSchema.safeParse(valid({ maxActiveTournamentsPerOrganiser: 21 })).success,
    ).toBe(false);
    expect(
      platformSettingsSchema.safeParse(valid({ maxActiveTournamentsPerOrganiser: 1.5 })).success,
    ).toBe(false);
  });

  it("enforces the application cooldown range and requires an integer", () => {
    expect(platformSettingsSchema.safeParse(valid({ applicationCooldownDays: -1 })).success).toBe(
      false,
    );
    expect(platformSettingsSchema.safeParse(valid({ applicationCooldownDays: 91 })).success).toBe(
      false,
    );
    expect(platformSettingsSchema.safeParse(valid({ applicationCooldownDays: 7.5 })).success).toBe(
      false,
    );
  });

  it("rejects a short audit reason", () => {
    const result = platformSettingsSchema.safeParse(valid({ reason: "ops" }));

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = platformSettingsSchema.safeParse(valid({ isAdmin: true }));

    expect(result.success).toBe(false);
  });
});
