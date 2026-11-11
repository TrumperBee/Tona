import { describe, expect, it } from "vitest";

import {
  assertRoleAssignmentAllowed,
  hasRoleAtLeast,
  isSuperAdminAccount,
  RoleAssignmentError,
} from "@/lib/auth/roles";

const SUPER_ADMIN_EMAIL = "Owner@Example.com";
const SUPER_ADMIN_UID = "owner-uid";

function expectRoleError(
  email: string | null,
  uid: string | null,
  role: "user" | "organiser" | "super_admin",
  configuredEmail = SUPER_ADMIN_EMAIL,
  configuredUid = SUPER_ADMIN_UID,
): void {
  expect(() =>
    assertRoleAssignmentAllowed(email, uid, role, configuredEmail, configuredUid),
  ).toThrow(RoleAssignmentError);
}

describe("assertRoleAssignmentAllowed", () => {
  it("allows super_admin only when BOTH the configured email and uid match", () => {
    expect(() =>
      assertRoleAssignmentAllowed(
        " owner@example.COM ",
        ` ${SUPER_ADMIN_UID} `,
        "super_admin",
        SUPER_ADMIN_EMAIL,
        SUPER_ADMIN_UID,
      ),
    ).not.toThrow();
  });

  it("refuses super_admin for a different email", () => {
    expectRoleError("someone@example.com", SUPER_ADMIN_UID, "super_admin");
  });

  it("refuses super_admin for a different uid", () => {
    expectRoleError("owner@example.com", "someone-else", "super_admin");
  });

  it("fails closed for everyone when SUPER_ADMIN_UID is missing or blank", () => {
    expectRoleError(SUPER_ADMIN_EMAIL, SUPER_ADMIN_UID, "super_admin", SUPER_ADMIN_EMAIL, "");
    expectRoleError(SUPER_ADMIN_EMAIL, SUPER_ADMIN_UID, "super_admin", SUPER_ADMIN_EMAIL, "   ");
    expectRoleError(SUPER_ADMIN_EMAIL, SUPER_ADMIN_UID, "super_admin", SUPER_ADMIN_EMAIL, "  ");
  });

  it("refuses super_admin when SUPER_ADMIN_EMAIL is empty", () => {
    expectRoleError("owner@example.com", SUPER_ADMIN_UID, "super_admin", "", SUPER_ADMIN_UID);
  });

  it("refuses to demote the configured Super Admin account", () => {
    expectRoleError("OWNER@example.com", SUPER_ADMIN_UID, "organiser");
    expectRoleError("owner@example.com", SUPER_ADMIN_UID, "user");
  });

  it("allows ordinary and organiser roles for other accounts", () => {
    expect(() =>
      assertRoleAssignmentAllowed(
        "player@example.com",
        "player-uid",
        "user",
        SUPER_ADMIN_EMAIL,
        SUPER_ADMIN_UID,
      ),
    ).not.toThrow();
    expect(() =>
      assertRoleAssignmentAllowed(
        "organiser@example.com",
        "organiser-uid",
        "organiser",
        SUPER_ADMIN_EMAIL,
        SUPER_ADMIN_UID,
      ),
    ).not.toThrow();
  });

  it("rejects an unknown role at runtime", () => {
    expect(() =>
      assertRoleAssignmentAllowed(
        "player@example.com",
        "player-uid",
        "administrator" as unknown as "user",
        SUPER_ADMIN_EMAIL,
        SUPER_ADMIN_UID,
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

describe("isSuperAdminAccount", () => {
  it("requires both identifiers, case-insensitive on email", () => {
    expect(
      isSuperAdminAccount("OWNER@example.com", SUPER_ADMIN_UID, SUPER_ADMIN_EMAIL, SUPER_ADMIN_UID),
    ).toBe(true);
    expect(
      isSuperAdminAccount("other@example.com", SUPER_ADMIN_UID, SUPER_ADMIN_EMAIL, SUPER_ADMIN_UID),
    ).toBe(false);
    expect(
      isSuperAdminAccount("owner@example.com", "other-uid", SUPER_ADMIN_EMAIL, SUPER_ADMIN_UID),
    ).toBe(false);
  });

  it("fails closed when the pin is missing", () => {
    expect(isSuperAdminAccount("owner@example.com", SUPER_ADMIN_UID, SUPER_ADMIN_EMAIL, "")).toBe(
      false,
    );
    expect(
      isSuperAdminAccount("owner@example.com", SUPER_ADMIN_UID, SUPER_ADMIN_EMAIL, undefined),
    ).toBe(false);
    expect(isSuperAdminAccount("owner@example.com", SUPER_ADMIN_UID, "", SUPER_ADMIN_UID)).toBe(
      false,
    );
  });
});
