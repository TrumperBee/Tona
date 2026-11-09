// GCC - announcement validation tests.
import { describe, expect, it } from "vitest";

import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  announcementContentSchema,
  announcementCreateSchema,
} from "@/lib/validation/announcement";

function content(overrides: Record<string, unknown> = {}) {
  return {
    title: "Platform update",
    body: "The platform will be briefly unavailable.",
    severity: "info",
    pinned: false,
    expiresAt: null,
    ...overrides,
  };
}

describe("announcementContentSchema", () => {
  it("accepts valid content and converts an ISO expiry to a Date", () => {
    const result = announcementContentSchema.safeParse(
      content({ expiresAt: "2026-12-31T23:59:00.000Z" }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.expiresAt).toBeInstanceOf(Date);
      expect(result.data.expiresAt?.toISOString()).toBe("2026-12-31T23:59:00.000Z");
    }
  });

  it("accepts a null expiry", () => {
    const result = announcementContentSchema.safeParse(content());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.expiresAt).toBeNull();
    }
  });

  it("rejects a title that is too short or too long", () => {
    expect(announcementContentSchema.safeParse(content({ title: "Hi" })).success).toBe(false);
    expect(
      announcementContentSchema.safeParse(
        content({ title: "x".repeat(ANNOUNCEMENT_TITLE_MAX + 1) }),
      ).success,
    ).toBe(false);
  });

  it("rejects a body that is too short or too long", () => {
    expect(announcementContentSchema.safeParse(content({ body: "Hi" })).success).toBe(false);
    expect(
      announcementContentSchema.safeParse(content({ body: "x".repeat(ANNOUNCEMENT_BODY_MAX + 1) }))
        .success,
    ).toBe(false);
  });

  it("rejects an unknown severity", () => {
    expect(announcementContentSchema.safeParse(content({ severity: "critical" })).success).toBe(
      false,
    );
  });

  it("rejects unknown fields", () => {
    expect(announcementContentSchema.safeParse(content({ publishedAt: new Date() })).success).toBe(
      false,
    );
  });
});

describe("announcementCreateSchema", () => {
  it("requires an explicit publishNow decision", () => {
    expect(announcementCreateSchema.safeParse(content()).success).toBe(false);
    expect(announcementCreateSchema.safeParse(content({ publishNow: true })).success).toBe(true);
  });
});
