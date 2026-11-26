import { describe, expect, it } from "vitest";

import { resolveSessionRole, type RoleResolutionInput } from "@/lib/auth/role-sync";

const EMAIL = "owner@example.com";
const UID = "owner-uid";

function input(overrides: Partial<RoleResolutionInput> = {}): RoleResolutionInput {
  return {
    uid: UID,
    email: EMAIL,
    customClaims: {},
    superAdminEmail: EMAIL,
    superAdminUid: UID,
    ...overrides,
  };
}

describe("resolveSessionRole", () => {
  it("grants super_admin only to the pinned email AND uid", () => {
    expect(resolveSessionRole(input({ customClaims: { role: "user" } }))).toMatchObject({
      role: "super_admin",
      refreshRequired: true,
      revoke: false,
    });

    expect(
      resolveSessionRole(input({ uid: "attacker-uid", customClaims: { role: "super_admin" } })),
    ).toMatchObject({ role: "user", refreshRequired: true, revoke: true });
  });

  it("denies everyone when SUPER_ADMIN_UID is blank and strips a stale claim", () => {
    const resolution = resolveSessionRole(
      input({
        superAdminUid: "   ",
        customClaims: { role: "super_admin" },
      }),
    );

    expect(resolution).toMatchObject({ role: "user", refreshRequired: true, revoke: true });
  });

  it("strips the legacy superAdmin boolean claim from an ordinary account", () => {
    const resolution = resolveSessionRole(
      input({
        uid: "player-uid",
        email: "player@example.com",
        customClaims: { role: "user", superAdmin: true },
      }),
    );

    expect(resolution).toMatchObject({ role: "user", refreshRequired: true, revoke: false });
  });

  it("strips a legacy claim from the pinned account too", () => {
    const resolution = resolveSessionRole(
      input({ customClaims: { role: "super_admin", superAdmin: true } }),
    );

    expect(resolution).toMatchObject({ role: "super_admin", refreshRequired: true, revoke: false });
  });

  it("keeps an unprivileged session when nothing needs refreshing", () => {
    expect(
      resolveSessionRole(
        input({
          uid: "player-uid",
          email: "player@example.com",
          customClaims: { role: "organiser" },
        }),
      ),
    ).toEqual({ role: "organiser", refreshRequired: false, revoke: false });
  });
});
