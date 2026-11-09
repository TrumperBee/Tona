// GCC - platform write-gating unit tests.
//
// `assertPlatformWritable` is the single gate every state-changing route uses.
// These tests mock the Firestore document read so the decision logic and the
// returned message are verified without an emulator.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { documentGet } = vi.hoisted(() => ({ documentGet: vi.fn() }));

vi.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdminFirestore: () => ({
    doc: () => ({ get: documentGet }),
  }),
}));

import {
  assertPlatformWritable,
  DEFAULT_MAINTENANCE_MESSAGE,
  PlatformWriteBlockedError,
} from "@/lib/platform/settings";

function settingsDocument(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    data: () => ({
      maintenanceMode: false,
      maintenanceMessage: "",
      registrationsOpen: true,
      maxActiveTournamentsPerOrganiser: 3,
      applicationCooldownDays: 7,
      ...overrides,
    }),
  };
}

beforeEach(() => {
  documentGet.mockReset();
});

describe("assertPlatformWritable", () => {
  it("allows everyone when maintenance mode is off", async () => {
    documentGet.mockResolvedValue(settingsDocument());

    await expect(assertPlatformWritable(null)).resolves.toBeUndefined();
    await expect(assertPlatformWritable({ role: "user" })).resolves.toBeUndefined();
    await expect(assertPlatformWritable({ role: "organiser" })).resolves.toBeUndefined();
  });

  it("allows the Super Admin while maintenance mode is on", async () => {
    documentGet.mockResolvedValue(settingsDocument({ maintenanceMode: true }));

    await expect(assertPlatformWritable({ role: "super_admin" })).resolves.toBeUndefined();
  });

  it("blocks anonymous writes while maintenance mode is on", async () => {
    documentGet.mockResolvedValue(settingsDocument({ maintenanceMode: true }));

    await expect(assertPlatformWritable(null)).rejects.toBeInstanceOf(PlatformWriteBlockedError);
  });

  it("blocks participants and organisers while maintenance mode is on", async () => {
    documentGet.mockResolvedValue(
      settingsDocument({ maintenanceMode: true, maintenanceMessage: "Back at 18:00 UTC." }),
    );

    for (const user of [{ role: "user" }, { role: "organiser" }]) {
      await expect(assertPlatformWritable(user)).rejects.toMatchObject({
        name: "PlatformWriteBlockedError",
        status: 503,
        message: "Back at 18:00 UTC.",
      });
    }
  });

  it("falls back to the default message when the custom one is blank", async () => {
    documentGet.mockResolvedValue(
      settingsDocument({ maintenanceMode: true, maintenanceMessage: "   " }),
    );

    await expect(assertPlatformWritable({ role: "user" })).rejects.toMatchObject({
      message: DEFAULT_MAINTENANCE_MESSAGE,
    });
  });

  it("treats a missing settings document as the safe defaults", async () => {
    documentGet.mockResolvedValue({ exists: false, data: () => undefined });

    await expect(assertPlatformWritable({ role: "user" })).resolves.toBeUndefined();
  });
});
