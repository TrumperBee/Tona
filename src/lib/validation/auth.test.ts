// GCC - unit tests for the password policy.
//
// Firebase Authentication cannot enforce less than six characters, so the
// platform policy is length-only: 6-128, no complexity rules and no trimming.
import { describe, expect, it } from "vitest";

import {
  PASSWORD_MAX_LENGTH,
  loginSchema,
  passwordSchema,
  registerSchema,
} from "@/lib/validation/auth";

function accepts(password: string): boolean {
  return passwordSchema.safeParse(password).success;
}

describe("passwordSchema", () => {
  it("rejects five characters and accepts six", () => {
    expect(accepts("abcde")).toBe(false);
    expect(accepts("abcdef")).toBe(true);
  });

  it("accepts the maximum length and rejects one character more", () => {
    expect(accepts("a".repeat(PASSWORD_MAX_LENGTH))).toBe(true);
    expect(accepts("a".repeat(PASSWORD_MAX_LENGTH + 1))).toBe(false);
  });

  it("has no complexity rules", () => {
    expect(accepts("abcdef")).toBe(true);
    expect(accepts("123456")).toBe(true);
    expect(accepts("      ")).toBe(true);
    expect(accepts("😀😀😀😀😀😀")).toBe(true);
  });

  it("does not trim the password", () => {
    expect(passwordSchema.safeParse("  secret  ").data).toBe("  secret  ");
  });

  it("does not apply the policy to sign-in", () => {
    expect(loginSchema.safeParse({ email: "player@example.com", password: "a" }).success).toBe(
      true,
    );
    expect(
      loginSchema.safeParse({ email: "player@example.com", password: "x".repeat(128) }).success,
    ).toBe(true);
  });

  it("uses the shared policy on registration and still requires a matching confirmation", () => {
    const base = {
      email: "player@example.com",
      password: "abcdef",
      confirmPassword: "abcdef",
    };

    expect(registerSchema.safeParse(base).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, password: "abcde" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, confirmPassword: "different" }).success).toBe(false);
  });
});
