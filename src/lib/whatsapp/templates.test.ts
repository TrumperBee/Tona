// GCC — unit tests for WhatsApp template rendering and the wa.me link builder.
import { describe, expect, it } from "vitest";

import { buildWhatsAppLink } from "@/lib/whatsapp/link";
import {
  getWhatsAppTemplate,
  isWhatsAppTemplateId,
  renderWhatsAppTemplate,
  WHATSAPP_TEMPLATES,
} from "@/lib/whatsapp/templates";

describe("renderWhatsAppTemplate", () => {
  it("fills every placeholder", () => {
    expect(
      renderWhatsAppTemplate("organiser-contact", { tournamentName: "Nairobi Cup 2026/27" }),
    ).toBe(
      "Hello! This message is from the organiser of Nairobi Cup 2026/27 on Global Champions Circuit about your entry.",
    );

    expect(
      renderWhatsAppTemplate("fixture-reminder", {
        tournamentName: "Nairobi Cup",
        opponentTag: "ChiefKeef",
        kickoffAt: "Sat 8pm EAT",
      }),
    ).toContain("against ChiefKeef");
  });

  it("throws when a required variable is missing", () => {
    expect(() => renderWhatsAppTemplate("organiser-contact", {})).toThrow(/tournamentName/);
  });

  it("throws when a variable value is empty", () => {
    expect(() => renderWhatsAppTemplate("organiser-contact", { tournamentName: "  " })).toThrow(
      /empty/,
    );
  });

  it("never leaves a raw placeholder in the output", () => {
    const message = renderWhatsAppTemplate("registration-confirmed", {
      tournamentName: "Thika Open",
    });

    expect(message).not.toMatch(/\{\{|\}\}/);
    expect(message).toContain("Thika Open");
  });

  it("keeps every template renderable with its declared variables", () => {
    for (const template of Object.values(WHATSAPP_TEMPLATES)) {
      const values = Object.fromEntries(template.variables.map((name) => [name, `value-${name}`]));

      const message = renderWhatsAppTemplate(template.id, values);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/\{\{|\}\}/);
    }
  });

  it("exposes template metadata and validates ids", () => {
    expect(isWhatsAppTemplateId("organiser-contact")).toBe(true);
    expect(isWhatsAppTemplateId("nope")).toBe(false);
    expect(getWhatsAppTemplate("organiser-contact").variables).toEqual(["tournamentName"]);
  });
});

describe("buildWhatsAppLink", () => {
  it("builds a wa.me link with an encoded message", () => {
    const link = buildWhatsAppLink("+254701234567", "Hello there!");

    expect(link).toBe("https://wa.me/254701234567?text=Hello%20there!");
  });

  it("omits the text parameter when there is no message", () => {
    expect(buildWhatsAppLink("+254701234567")).toBe("https://wa.me/254701234567");
    expect(buildWhatsAppLink("+254701234567", "   ")).toBe("https://wa.me/254701234567");
  });

  it("encodes template output safely", () => {
    const message = renderWhatsAppTemplate("organiser-contact", {
      tournamentName: "Nairobi Cup & Trophy 2026",
    });
    const link = buildWhatsAppLink("+254701234567", message);

    expect(link.startsWith("https://wa.me/254701234567?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toContain("Nairobi Cup & Trophy 2026");
  });

  it("rejects invalid numbers", () => {
    expect(() => buildWhatsAppLink("12345")).toThrow();
    expect(() => buildWhatsAppLink("+25470123456789256", undefined)).toThrow();
  });
});
