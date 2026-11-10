import { describe, expect, it } from "vitest";

import {
  adminApplicationSubmitSchema,
  applicationApproveSchema,
  applicationRejectSchema,
} from "./admin-application";

const valid = {
  communityName: "Lagos Elite FC",
  communityType: "online_community",
  communityLink: "https://example.com/community",
  expectedPlayers: "36-72",
  gamesPlanned: ["efootball"],
  experience: "I have organised weekly leagues for more than forty players for two years.",
  motivation: "I want to give my community a fair, reliable competition with a permanent record.",
  agreesToRules: true,
};

describe("admin application submission schema", () => {
  it("accepts a complete application", () => {
    const result = adminApplicationSubmitSchema.safeParse(valid);

    expect(result.success).toBe(true);
  });

  it("trims text and allows a blank optional link", () => {
    const result = adminApplicationSubmitSchema.parse({
      ...valid,
      communityName: "  Lagos Elite FC  ",
      communityLink: "   ",
      experience: `  ${valid.experience}  `,
    });

    expect(result.communityName).toBe("Lagos Elite FC");
    expect(result.communityLink).toBeNull();
    expect(result.experience).toBe(valid.experience);
  });

  it("rejects short text, unsupported games and duplicate games", () => {
    expect(adminApplicationSubmitSchema.safeParse({ ...valid, communityName: "A" }).success).toBe(
      false,
    );
    expect(
      adminApplicationSubmitSchema.safeParse({ ...valid, experience: "Too short" }).success,
    ).toBe(false);
    expect(
      adminApplicationSubmitSchema.safeParse({ ...valid, motivation: "Too short" }).success,
    ).toBe(false);
    expect(adminApplicationSubmitSchema.safeParse({ ...valid, gamesPlanned: [] }).success).toBe(
      false,
    );
    expect(
      adminApplicationSubmitSchema.safeParse({ ...valid, gamesPlanned: ["chess"] }).success,
    ).toBe(false);
    expect(
      adminApplicationSubmitSchema.safeParse({
        ...valid,
        gamesPlanned: ["efootball", "efootball"],
      }).success,
    ).toBe(false);
  });

  it("rejects non-https links, unknown enum values and missing agreement", () => {
    expect(
      adminApplicationSubmitSchema.safeParse({
        ...valid,
        communityLink: "http://example.com",
      }).success,
    ).toBe(false);
    expect(
      adminApplicationSubmitSchema.safeParse({ ...valid, communityType: "other_type" }).success,
    ).toBe(false);
    expect(
      adminApplicationSubmitSchema.safeParse({ ...valid, expectedPlayers: "many" }).success,
    ).toBe(false);
    expect(adminApplicationSubmitSchema.safeParse({ ...valid, agreesToRules: false }).success).toBe(
      false,
    );
  });

  it("rejects unknown fields so identity can never be injected", () => {
    const result = adminApplicationSubmitSchema.safeParse({
      ...valid,
      uid: "attacker",
      status: "approved",
      role: "super_admin",
    });

    expect(result.success).toBe(false);
  });
});

describe("application review schemas", () => {
  it("allows an approval note to be absent or short", () => {
    expect(applicationApproveSchema.safeParse({}).success).toBe(true);
    expect(applicationApproveSchema.safeParse({ note: "Welcome." }).success).toBe(true);
    expect(applicationApproveSchema.safeParse({ note: "x".repeat(301) }).success).toBe(false);
  });

  it("requires a 10-300 character rejection note", () => {
    expect(applicationRejectSchema.safeParse({ note: "Too short" }).success).toBe(false);
    expect(applicationRejectSchema.safeParse({ note: "x".repeat(10) }).success).toBe(true);
    expect(applicationRejectSchema.safeParse({ note: "x".repeat(301) }).success).toBe(false);
    expect(applicationRejectSchema.safeParse({ note: "   " }).success).toBe(false);
  });
});
