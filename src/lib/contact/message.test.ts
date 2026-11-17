import { describe, expect, it } from "vitest";

import {
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_NOTE_MAX_LENGTH,
  buildMatchContactMessage,
  clampContactMessage,
  isMatchContactTemplateId,
  matchContactLabel,
  normaliseContactNote,
  selectMatchContactTemplate,
} from "@/lib/contact/message";
import { buildWhatsAppLink } from "@/lib/whatsapp/link";
import { renderWhatsAppTemplate } from "@/lib/whatsapp/templates";

const base = {
  opponentTag: "Rash",
  senderTag: "Kofi",
  tournamentName: "GCC November Cup",
  matchLabel: "Matchday 3",
};

describe("selectMatchContactTemplate", () => {
  it("uses the league template for a league match", () => {
    expect(selectMatchContactTemplate({ stage: "league", leg: null, tieId: null })).toBe(
      "match-contact-league",
    );
  });

  it("separates the two knockout legs", () => {
    expect(selectMatchContactTemplate({ stage: "qf", leg: 1, tieId: "qf-1" })).toBe(
      "match-contact-knockout-leg-1",
    );
  });

  it("uses leg 2 for the second leg", () => {
    expect(selectMatchContactTemplate({ stage: "r16", leg: 2, tieId: "r16-1" })).toBe(
      "match-contact-knockout-leg-2",
    );
  });

  it("uses the final template for the final", () => {
    expect(selectMatchContactTemplate({ stage: "final", leg: null, tieId: "final" })).toBe(
      "match-contact-final",
    );
  });

  it("falls back to the single-leg body when no legs are stored", () => {
    expect(selectMatchContactTemplate({ stage: "sf", leg: null, tieId: "sf-1" })).toBe(
      "match-contact-knockout-single",
    );
  });
});

describe("isMatchContactTemplateId", () => {
  it("accepts the five contact messages and rejects anything else", () => {
    expect(isMatchContactTemplateId("match-contact-league")).toBe(true);
    expect(isMatchContactTemplateId("match-contact-final")).toBe(true);
    expect(isMatchContactTemplateId("organiser-contact")).toBe(false);
    expect(isMatchContactTemplateId("")).toBe(false);
    expect(isMatchContactTemplateId(null)).toBe(false);
  });
});

describe("buildMatchContactMessage", () => {
  it("includes both gamer tags, the tournament and the match label", () => {
    const message = buildMatchContactMessage("match-contact-league", base);

    expect(message).toContain("Rash");
    expect(message).toContain("Kofi");
    expect(message).toContain("GCC November Cup");
    expect(message).toContain("Matchday 3");
    expect(message).toContain("👋");
    expect(message).not.toMatch(/\{\{|\}\}/);
  });

  it("keeps 3 and 16 character tags intact", () => {
    const short = buildMatchContactMessage("match-contact-league", {
      ...base,
      opponentTag: "Ace",
      senderTag: "x".repeat(16),
    });

    expect(short).toContain("Ace");
    expect(short).toContain("x".repeat(16));
  });

  it("appends the organiser note as its own paragraph", () => {
    const message = buildMatchContactMessage("match-contact-league", {
      ...base,
      contactNote: "Please agree a time before Sunday",
    });

    expect(message.endsWith("\n\nPlease agree a time before Sunday")).toBe(true);
  });

  it("adds nothing for an empty or whitespace note", () => {
    const message = buildMatchContactMessage("match-contact-league", {
      ...base,
      contactNote: "   \n  ",
    });

    expect(message).not.toContain("\n\n");
    expect(message.endsWith("arrange our match.")).toBe(true);
  });

  it("caps the whole message at 500 characters", () => {
    const message = buildMatchContactMessage("match-contact-league", {
      ...base,
      contactNote: "n".repeat(5000),
    });

    expect(message.length).toBeLessThanOrEqual(CONTACT_MESSAGE_MAX_LENGTH);
  });
});

describe("normaliseContactNote", () => {
  it("collapses whitespace and trims", () => {
    expect(normaliseContactNote("  agree   a time \n before Sunday ")).toBe(
      "agree a time before Sunday",
    );
  });

  it("returns null for empty values", () => {
    expect(normaliseContactNote(null)).toBeNull();
    expect(normaliseContactNote(undefined)).toBeNull();
    expect(normaliseContactNote("   ")).toBeNull();
  });

  it("truncates at the 140 character limit", () => {
    const note = normaliseContactNote("a".repeat(200));

    expect(note).toHaveLength(CONTACT_NOTE_MAX_LENGTH);
  });
});

describe("clampContactMessage", () => {
  it("keeps short messages untouched apart from trimming", () => {
    expect(clampContactMessage("  hello  ")).toBe("hello");
  });

  it("truncates long edits to the limit", () => {
    expect(clampContactMessage("z".repeat(900))).toHaveLength(CONTACT_MESSAGE_MAX_LENGTH);
  });
});

describe("matchContactLabel", () => {
  it("labels a league match by matchday", () => {
    expect(matchContactLabel({ stage: "league", matchday: 7 })).toBe("Matchday 7");
  });

  it("labels knockout stages by round name", () => {
    expect(matchContactLabel({ stage: "qf", matchday: 0 })).toBe("Quarter-finals");
    expect(matchContactLabel({ stage: "final", matchday: 0 })).toBe("Final");
  });
});

describe("WhatsApp link encoding", () => {
  it("encodes emoji, ampersands and the newline between paragraphs", () => {
    const message = buildMatchContactMessage("match-contact-league", {
      ...base,
      contactNote: "Time & date, please",
    });
    const link = buildWhatsAppLink("+254712345678", message);

    expect(link.startsWith("https://wa.me/254712345678?text=")).toBe(true);
    expect(link).toContain("%F0%9F%91%8B");
    expect(link).toContain("%26");
    expect(link).toContain("%0A%0A");
    expect(link).not.toContain(" ");
    expect(link).not.toContain("&");
  });

  it("survives a decode round trip exactly", () => {
    const message = buildMatchContactMessage("match-contact-final", {
      ...base,
      matchLabel: "Final",
      contactNote: "Kick-off 20:00 — don't be late",
    });
    const link = buildWhatsAppLink("+447700900123", message);
    const encoded = link.split("?text=")[1];

    expect(decodeURIComponent(encoded)).toBe(message);
  });

  it("round-trips an accented gamer tag", () => {
    const message = buildMatchContactMessage("match-contact-league", {
      ...base,
      opponentTag: "José",
    });
    const link = buildWhatsAppLink("+34600123456", message);

    expect(decodeURIComponent(link.split("?text=")[1])).toBe(message);
  });
});

describe("templates", () => {
  it("throws rather than leaving a placeholder when a variable is missing", () => {
    expect(() =>
      renderWhatsAppTemplate("match-contact-league", {
        opponentTag: "Rash",
        senderTag: "Kofi",
        tournamentName: "Cup",
      }),
    ).toThrow();
  });
});
