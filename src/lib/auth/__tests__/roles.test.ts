import { describe, expect, it } from "vitest";

import {
  assertRoleAssignmentAllowed,
  hasRoleAtLeast,
  isSuperAdminEmail,
  RoleAssignmentError,
} from "@/lib/auth/roles";

const SUPER_ADMIN_EMAIL = "Owner@Example.com";

function expectRoleError(
  email: string | null,
  verified: boolean,
  role: "user" | "organiser" | "super_admin",
  configured = SUPER_ADMIN_EMAIL,
): void {
  expect(() => assertRoleAssignmentAllowed(email, verified, role, configured)).toThrow(
    RoleAssignmentError,
  );
}

describe("assertRoleAssignmentAllowed", () => {
  it("allows super_admin only for the configured, verified email, case-insensitively", () => {
    expect(() =>
      assertRoleAssignmentAllowed(" owner@example.COM ", true, "super_admin", SUPER_ADMIN_EMAIL),
    ).not.toThrow();
  });

  it("refuses super_admin for a different email", () => {
    expectRoleError("someone@example.com", true, "super_admin");
  });

  it("refuses super_admin for an unverified configured email", () => {
    expectRoleError("owner@example.com", false, "super_admin");
  });

  it("refuses super_admin when SUPER_ADMIN_EMAIL is empty", () => {
    expectRoleError("owner@example.com", true, "super_admin", "");
  });

  it("refuses to demote the configured Super Admin account", () => {
    expectRoleError("OWNER@example.com", true, "organiser");
    expectRoleError("owner@example.com", true, "user");
  });

  it("allows ordinary and organiser roles for other accounts, even before verification", () => {
    expect(() =>
      assertRoleAssignmentAllowed("player@example.com", false, "user", SUPER_ADMIN_EMAIL),
    ).not.toThrow();
    expect(() =>
      assertRoleAssignmentAllowed("organiser@example.com", true, "organiser", SUPER_ADMIN_EMAIL),
    ).not.toThrow();
  });

  it("rejects an unknown role at runtime", () => {
    expect(() =>
      assertRoleAssignmentAllowed(
        "player@example.com",
        true,
        "administrator" as unknown as "user",
        SUPER_ADMIN_EMAIL,
      ),
    ).toThrow(RoleAssignmentError);
  });
});

describe("role hierarchy", () => {
  it("orders user below organiser below super_admin", () => {
    expect(hasRoleAtLeast("user", "user")).toBe(true);
    expect(hasRoleAtLeast("user", "organiser")).toBe(false);
    expect(hasRoleAtLeast("organiser", "user")).toBe(true);
    expect(hasRoleAtLeast("organiser", "super_admin")).toBe(false);
    expect(hasRoleAtLeast("super_admin", "super_admin")).toBe(true);
  });
});

describe("isSuperAdminEmail", () => {
  it("compares case-insensitively and rejects an empty configuration", () => {
    expect(isSuperAdminEmail("OWNER@example.com", SUPER_ADMIN_EMAIL)).toBe(true);
    expect(isSuperAdminEmail("other@example.com", SUPER_ADMIN_EMAIL)).toBe(false);
    expect(isSuperAdminEmail("owner@example.com", "")).toBe(false);
  });
});
