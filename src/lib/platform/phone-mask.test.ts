// GCC - phone-number masking tests.
import { describe, expect, it } from "vitest";

import { maskPhoneNumber } from "@/lib/platform/phone-mask";

describe("maskPhoneNumber", () => {
  it("returns null when there is no number", () => {
    expect(maskPhoneNumber(null)).toBeNull();
    expect(maskPhoneNumber(undefined)).toBeNull();
    expect(maskPhoneNumber("")).toBeNull();
    expect(maskPhoneNumber("no digits here")).toBeNull();
  });

  it("keeps the calling code, the first digit and the last three digits", () => {
    expect(maskPhoneNumber("+254712345678")).toBe("+254 7•• ••• 678");
  });

  it("never exposes the middle digits in the masked value", () => {
    const masked = maskPhoneNumber("+2348012345678");

    expect(masked).not.toBeNull();
    expect(masked).not.toContain("0123");
    expect(masked?.startsWith("+234 ")).toBe(true);
    expect(masked?.replace(/\s/g, "").endsWith("678")).toBe(true);
  });
});
