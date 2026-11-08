// GCC - registration payload schema tests.
import { describe, expect, it } from "vitest";

import { registrationSchema } from "@/lib/validation/registration";

const valid = {
  fullName: "  Amani Otieno ",
  gamerTag: "  Striker_9 ",
  email: "  PLAYER@Example.COM ",
  password: "correct horse battery",
  whatsapp: "0712 345 678",
  country: "ke",
  preferredGame: "efootball",
  platform: "android",
  acceptTerms: true,
} as const;

describe("registrationSchema", () => {
  it("accepts a complete valid payload and normalises its fields", () => {
    const parsed = registrationSchema.parse(valid);

    expect(parsed.fullName).toBe("Amani Otieno");
    expect(parsed.gamerTag).toBe("Striker_9");
    expect(parsed.email).toBe("player@example.com");
    expect(parsed.country).toBe("KE");
    expect(parsed.acceptTerms).toBe(true);
  });

  it("allows WhatsApp to be omitted", () => {
    const withoutWhatsapp: Record<string, unknown> = { ...valid };
    delete withoutWhatsapp.whatsapp;
    expect(registrationSchema.safeParse(withoutWhatsapp).success).toBe(true);
  });

  it("rejects a missing or false terms acceptance", () => {
    expect(registrationSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
    const withoutTerms: Record<string, unknown> = { ...valid };
    delete withoutTerms.acceptTerms;
    expect(registrationSchema.safeParse(withoutTerms).success).toBe(false);
  });

  it("rejects an invalid gamer tag", () => {
    expect(registrationSchema.safeParse({ ...valid, gamerTag: "a" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, gamerTag: "_bad" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, gamerTag: "admin" }).success).toBe(false);
  });

  it("rejects short passwords and malformed emails", () => {
    expect(registrationSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects an unknown country or game", () => {
    expect(registrationSchema.safeParse({ ...valid, country: "Kenya" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, preferredGame: "fifa" }).success).toBe(false);
  });

  it("rejects a WhatsApp value over the length cap", () => {
    expect(registrationSchema.safeParse({ ...valid, whatsapp: "+1".repeat(20) }).success).toBe(
      false,
    );
  });
});
