// GCC - notification email policy unit tests.
//
// The registry is the contract every notification shares: one category, one
// default and one unsubscribe stream. These tests pin that contract so a new
// kind cannot quietly bypass the preference model.
import { describe, expect, it } from "vitest";

import {
  applyUnsubscribe,
  DEFAULT_NOTIFICATION_PREFS,
  normaliseNotificationPrefs,
  resolveEmailDecision,
} from "@/lib/notifications/policy";
import {
  NOTIFICATION_KINDS,
  NOTIFICATION_REGISTRY,
  notificationPreferenceKey,
  notificationUnsubscribeCategory,
  isNotificationKind,
} from "@/lib/notifications/types";

describe("notification registry", () => {
  it("declares a complete definition for every kind", () => {
    for (const kind of NOTIFICATION_KINDS) {
      const definition = NOTIFICATION_REGISTRY[kind];

      expect(definition, kind).toBeDefined();
      expect(["critical", "important", "optional"]).toContain(definition.category);
      expect(typeof definition.defaultEmail).toBe("boolean");
      expect(typeof definition.batchable).toBe("boolean");
      expect(typeof definition.legacyType).toBe("string");
      expect(definition.label.length).toBeGreaterThan(0);
    }
  });

  it("follows the documented default-email matrix", () => {
    for (const kind of NOTIFICATION_KINDS) {
      const definition = NOTIFICATION_REGISTRY[kind];
      const expected = definition.category !== "optional";

      expect(definition.defaultEmail, kind).toBe(expected);
    }
  });

  it("maps every kind to exactly one preference and unsubscribe stream", () => {
    for (const kind of NOTIFICATION_KINDS) {
      const key = notificationPreferenceKey(kind);
      const stream = notificationUnsubscribeCategory(kind);

      if (NOTIFICATION_REGISTRY[kind].category === "critical") {
        expect(key, kind).toBeNull();
        expect(stream, kind).toBeNull();
      } else {
        expect(key, kind).not.toBeNull();
        expect(stream, kind).not.toBeNull();
      }
    }
  });

  it("recognises only known kinds", () => {
    expect(isNotificationKind("registration_confirmed")).toBe(true);
    expect(isNotificationKind("made_up_kind")).toBe(false);
    expect(isNotificationKind(null)).toBe(false);
  });
});

describe("normaliseNotificationPrefs", () => {
  it("returns the documented defaults for a missing document", () => {
    expect(normaliseNotificationPrefs(undefined)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(normaliseNotificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(normaliseNotificationPrefs("nonsense")).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it("keeps stored booleans and ignores malformed values", () => {
    expect(
      normaliseNotificationPrefs({
        important: false,
        resultEmails: "yes",
        announcementEmails: true,
      }),
    ).toEqual({ important: false, resultEmails: false, announcementEmails: true });
  });
});

describe("resolveEmailDecision", () => {
  it("always allows critical mail regardless of preferences", () => {
    const decision = resolveEmailDecision("account_suspended", {
      important: false,
      resultEmails: false,
      announcementEmails: false,
    });

    expect(decision).toEqual({
      emailAllowed: true,
      category: "critical",
      reason: "critical",
    });
  });

  it("allows important mail by default and when enabled", () => {
    expect(resolveEmailDecision("registration_confirmed", undefined).emailAllowed).toBe(true);
    expect(
      resolveEmailDecision("registration_confirmed", {
        important: false,
        resultEmails: false,
        announcementEmails: false,
      }),
    ).toEqual({ emailAllowed: false, category: "important", reason: "opted_out" });
  });

  it("keeps optional mail off until its stream is enabled", () => {
    expect(resolveEmailDecision("platform_announcement", DEFAULT_NOTIFICATION_PREFS)).toEqual({
      emailAllowed: false,
      category: "optional",
      reason: "opted_out",
    });

    expect(
      resolveEmailDecision("result_recorded", {
        ...DEFAULT_NOTIFICATION_PREFS,
        resultEmails: true,
      }).emailAllowed,
    ).toBe(true);

    expect(
      resolveEmailDecision("platform_announcement", {
        ...DEFAULT_NOTIFICATION_PREFS,
        announcementEmails: true,
      }).emailAllowed,
    ).toBe(true);
  });

  it("separates the result and announcement streams inside optional mail", () => {
    const resultOnly = {
      ...DEFAULT_NOTIFICATION_PREFS,
      resultEmails: true,
    };

    expect(resolveEmailDecision("result_recorded", resultOnly).emailAllowed).toBe(true);
    expect(resolveEmailDecision("tournament_announcement", resultOnly).emailAllowed).toBe(false);
  });
});

describe("applyUnsubscribe", () => {
  it("turns off only the named stream", () => {
    const all = { important: true, resultEmails: true, announcementEmails: true };

    expect(applyUnsubscribe(all, "important")).toEqual({
      important: false,
      resultEmails: true,
      announcementEmails: true,
    });
    expect(applyUnsubscribe(all, "result")).toEqual({
      important: true,
      resultEmails: false,
      announcementEmails: true,
    });
    expect(applyUnsubscribe(all, "announcement")).toEqual({
      important: true,
      resultEmails: true,
      announcementEmails: false,
    });
  });

  it("is idempotent", () => {
    const once = applyUnsubscribe(DEFAULT_NOTIFICATION_PREFS, "important");
    expect(applyUnsubscribe(once, "important")).toEqual(once);
  });
});
