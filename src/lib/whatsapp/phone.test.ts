// GCC - WhatsApp / phone normalisation tests.
import { describe, expect, it } from "vitest";

import {
  E164_PATTERN,
  e164Schema,
  isValidE164,
  normalizePhone,
  normalizeToE164,
  whatsappSchema,
} from "@/lib/whatsapp/phone";

describe("normalizePhone", () => {
  it("removes formatting characters but keeps the leading plus", () => {
    expect(normalizePhone(" +254 712 (345) 678 ")).toBe("+254712345678");
    expect(normalizePhone("+44.7911-123-456")).toBe("+447911123456");
  });
});

describe("normalizeToE164", () => {
  it("normalises a national number with the selected country", () => {
    expect(normalizeToE164("0712 345 678", "KE")).toBe("+254712345678");
    expect(normalizeToE164("0712345678", "ke")).toBe("+254712345678");
  });

  it("normalises an international number without a default country", () => {
    expect(normalizeToE164("+254 712 345 678")).toBe("+254712345678");
    expect(normalizeToE164("+44 7911 123456")).toBe("+447911123456");
  });

  it("returns null for empty, blank or invalid input", () => {
    expect(normalizeToE164("")).toBeNull();
    expect(normalizeToE164("   ")).toBeNull();
    expect(normalizeToE164(null)).toBeNull();
    expect(normalizeToE164(undefined)).toBeNull();
    expect(normalizeToE164("not a phone")).toBeNull();
    expect(normalizeToE164("123", "KE")).toBeNull();
  });
});

describe("E.164 helpers", () => {
  it("recognises valid E.164 strings", () => {
    expect(isValidE164("+254712345678")).toBe(true);
    expect(e164Schema.parse("+254 712 345 678")).toBe("+254712345678");
  });

  it("rejects malformed E.164 strings", () => {
    expect(E164_PATTERN.test("254712345678")).toBe(false);
    expect(E164_PATTERN.test("+0123456789")).toBe(false);
    expect(e164Schema.safeParse("0712345678").success).toBe(false);
  });
});

describe("whatsappSchema", () => {
  const kenya = whatsappSchema("KE");

  it("returns E.164 for a valid number and the selected country", () => {
    expect(kenya.parse("0712 345 678")).toBe("+254712345678");
    expect(kenya.parse("+254712345678")).toBe("+254712345678");
  });

  it("returns undefined for an empty value", () => {
    expect(kenya.parse("")).toBeUndefined();
  });

  it("rejects a number that is invalid for the selected country", () => {
    const result = kenya.safeParse("12345");
    expect(result.success).toBe(false);
  });
});
