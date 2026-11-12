// GCC - unit tests for the seeder's destructive-action guard rails.
import { describe, expect, it } from "vitest";

import {
  assertSafeEnvironment,
  cleanabilityRefusal,
  confirmationMatches,
  emptyProgress,
  isEligibleTestAccount,
  isTournamentCleanable,
  looksLikeEmulatorProject,
  mayDeleteAccount,
} from "./safety";
import type { ManifestAccount, SeedManifest } from "./manifest";

function manifestOf(accounts: readonly ManifestAccount[]): SeedManifest {
  return {
    version: 1,
    batchId: "seed-test",
    createdAt: new Date().toISOString(),
    projectId: "tona-d6f56",
    accounts,
  };
}

function account(overrides: Partial<ManifestAccount> = {}): ManifestAccount {
  return {
    uid: "test-uid",
    gamerTag: "Ace",
    email: "testplayer01@gcc-test.example",
    password: "batch-password-123",
    slot: 1,
    ...overrides,
  };
}

describe("environment safety", () => {
  it("refuses production", () => {
    expect(() =>
      assertSafeEnvironment({
        NODE_ENV: "production",
        FIREBASE_ADMIN_PROJECT_ID: "real-project",
      }),
    ).toThrow(/production/);
  });

  it("requires a project id", () => {
    expect(() => assertSafeEnvironment({ NODE_ENV: "test" })).toThrow(/FIREBASE_ADMIN_PROJECT_ID/);
  });

  it("refuses a demo/emulator project id when no emulator host is set", () => {
    expect(looksLikeEmulatorProject("demo-tona")).toBe(true);
    expect(looksLikeEmulatorProject("tona-emulator")).toBe(true);
    expect(looksLikeEmulatorProject("tona-d6f56")).toBe(false);

    expect(() =>
      assertSafeEnvironment({
        NODE_ENV: "test",
        FIREBASE_ADMIN_PROJECT_ID: "demo-tona",
      }),
    ).toThrow(/ambiguous/);
  });

  it("allows a demo id when an emulator host is configured", () => {
    expect(
      assertSafeEnvironment({
        NODE_ENV: "test",
        FIREBASE_ADMIN_PROJECT_ID: "demo-tona",
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      }),
    ).toBe("demo-tona");
  });

  it("returns the real project id", () => {
    expect(
      assertSafeEnvironment({
        NODE_ENV: "test",
        FIREBASE_ADMIN_PROJECT_ID: "tona-d6f56",
      }),
    ).toBe("tona-d6f56");
  });
});

describe("typed confirmation", () => {
  it("requires the exact project id (trimmed) and never a --yes shortcut", () => {
    expect(confirmationMatches("tona-d6f56", "tona-d6f56")).toBe(true);
    expect(confirmationMatches("  tona-d6f56 \n", "tona-d6f56")).toBe(true);
    expect(confirmationMatches("yes", "tona-d6f56")).toBe(false);
    expect(confirmationMatches("tona-d6f57", "tona-d6f56")).toBe(false);
    expect(confirmationMatches("", "tona-d6f56")).toBe(false);
  });
});

describe("cleanup eligibility", () => {
  it("only touches manifest accounts on the reserved domain", () => {
    expect(isEligibleTestAccount(account())).toBe(true);
    expect(isEligibleTestAccount(account({ email: "someone@example.com" }))).toBe(false);
    expect(
      isEligibleTestAccount(account({ email: "testplayer01@gcc-test.example.evil.com" })),
    ).toBe(false);
  });

  it("never touches the configured Super Admin", () => {
    const env = { SUPER_ADMIN_EMAIL: "owner@example.com", SUPER_ADMIN_UID: "owner-uid" };

    expect(
      isEligibleTestAccount(
        account({ uid: "owner-uid", email: "testplayer01@gcc-test.example" }),
        env,
      ),
    ).toBe(false);
    expect(isEligibleTestAccount(account({ uid: "other", email: "owner@example.com" }), env)).toBe(
      false,
    );
  });

  it("refuses a uid that is not in the manifest, even with a valid test email", () => {
    const manifest = manifestOf([account()]);
    const intruder = account({
      uid: "not-in-manifest",
      gamerTag: "Intruder",
      email: "testplayer02@gcc-test.example",
      slot: 2,
    });

    expect(mayDeleteAccount(account(), manifest)).toBe(true);
    expect(mayDeleteAccount(intruder, manifest)).toBe(false);
    expect(
      mayDeleteAccount(account({ email: "testplayer01@gcc-test.example" }), manifestOf([])),
    ).toBe(false);
  });
});

describe("tournament cleanability", () => {
  it("allows registration-stage tournaments with no competition data", () => {
    expect(isTournamentCleanable("draft", emptyProgress())).toBe(true);
    expect(isTournamentCleanable("registration_open", emptyProgress())).toBe(true);
    expect(isTournamentCleanable("registration_closed", emptyProgress())).toBe(true);
  });

  it("refuses an advanced status even when no subcollection was found", () => {
    expect(isTournamentCleanable("pots_confirmed", emptyProgress())).toBe(false);
    expect(isTournamentCleanable("league_phase", emptyProgress())).toBe(false);
    expect(isTournamentCleanable("registration_open", { ...emptyProgress(), hasDraw: true })).toBe(
      false,
    );
    expect(
      isTournamentCleanable("registration_closed", {
        ...emptyProgress(),
        hasMatches: true,
      }),
    ).toBe(false);
  });

  it("explains exactly why partial cleanup is refused", () => {
    const message = cleanabilityRefusal("Cup", "league_phase", {
      ...emptyProgress(),
      hasMatches: true,
    });

    expect(message).toContain("league_phase");
    expect(message).toContain("matches");
    expect(message).toContain("--delete-tournament");
  });
});
