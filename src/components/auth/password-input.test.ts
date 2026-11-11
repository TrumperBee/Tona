// GCC - unit tests for the advisory password-strength indicator.
import { describe, expect, it } from "vitest";

import { getPasswordStrength } from "@/components/auth/password-input";

describe("getPasswordStrength", () => {
  it("marks short simple passwords as weak without blocking them", () => {
    for (const password of ["abcdef", "123456"]) {
      const strength = getPasswordStrength(password);
      expect(strength.level).toBe("weak");
      expect(strength.advisory).toContain("You can still use it");
    }
  });

  it("marks longer or varied passwords as okay or strong", () => {
    expect(getPasswordStrength("Abcdefghij1").level).toBe("okay");
    expect(getPasswordStrength("Correct-Horse-9-Battery").level).toBe("strong");
  });

  it("shows no indicator before the player types", () => {
    expect(getPasswordStrength("").level).toBe("empty");
  });
});
