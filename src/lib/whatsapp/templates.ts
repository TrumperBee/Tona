// GCC — WhatsApp message templates.
//
// Typed templates with `{{variable}}` placeholders, rendered server-side into
// the pre-filled text of a wa.me click-to-chat link. The organiser contact
// message is deliberately generic: it never includes phone numbers, emails
// or anything the player has not already made public. The match-contact
// templates (Phase 14) never carry the number either — the number exists only
// inside the link the server returns for one authorised request.
//
// Every message is a suggestion: the player may edit it before sending, and
// WhatsApp is opened by the player, who presses Send themselves.

export type WhatsAppTemplateId =
  | "organiser-contact"
  | "registration-confirmed"
  | "fixture-reminder"
  | "result-confirmed"
  | "result-report-opened"
  | "match-contact-league"
  | "match-contact-knockout-leg-1"
  | "match-contact-knockout-leg-2"
  | "match-contact-knockout-single"
  | "match-contact-final";

export interface WhatsAppTemplate {
  readonly id: WhatsAppTemplateId;
  readonly label: string;
  /** Placeholder names the body expects, without braces. */
  readonly variables: readonly string[];
  /** Placeholders are written as {{variableName}} and filled server-side. */
  readonly body: string;
}

export const WHATSAPP_TEMPLATES: Readonly<Record<WhatsAppTemplateId, WhatsAppTemplate>> = {
  "organiser-contact": {
    id: "organiser-contact",
    label: "Organiser contacting a player",
    variables: ["tournamentName"],
    body: "Hello! This message is from the organiser of {{tournamentName}} on Global Champions Circuit about your entry.",
  },
  "registration-confirmed": {
    id: "registration-confirmed",
    label: "Registration confirmation",
    variables: ["tournamentName"],
    body: "Your entry into {{tournamentName}} on Global Champions Circuit is confirmed. Good luck!",
  },
  "fixture-reminder": {
    id: "fixture-reminder",
    label: "Fixture reminder",
    variables: ["tournamentName", "opponentTag", "kickoffAt"],
    body: "{{tournamentName}}: your next match is against {{opponentTag}}, kicking off at {{kickoffAt}}. Play fair and enjoy the game!",
  },
  "result-confirmed": {
    id: "result-confirmed",
    label: "Result confirmation",
    variables: ["tournamentName", "result"],
    body: "{{tournamentName}}: your result has been recorded as {{result}}. Check the standings for the full table.",
  },
  "result-report-opened": {
    id: "result-report-opened",
    label: "Result report opened",
    variables: ["tournamentName", "matchLabel"],
    body: "{{tournamentName}}: a report was opened about {{matchLabel}}. An admin will review it shortly.",
  },
  "match-contact-league": {
    id: "match-contact-league",
    label: "Player contacting an opponent (league)",
    variables: ["opponentTag", "senderTag", "tournamentName", "matchLabel"],
    body: "Hey {{opponentTag}}! 👋 I'm {{senderTag}}. We play each other in {{tournamentName}} ({{matchLabel}}). Let me know a time that works for you so we can arrange our match.",
  },
  "match-contact-knockout-leg-1": {
    id: "match-contact-knockout-leg-1",
    label: "Player contacting an opponent (knockout, first leg)",
    variables: ["opponentTag", "senderTag", "tournamentName", "matchLabel"],
    body: "Hey {{opponentTag}}! 👋 I'm {{senderTag}}. We play the first leg of our {{matchLabel}} tie in {{tournamentName}}. Let me know a time that works for you so we can arrange it.",
  },
  "match-contact-knockout-leg-2": {
    id: "match-contact-knockout-leg-2",
    label: "Player contacting an opponent (knockout, second leg)",
    variables: ["opponentTag", "senderTag", "tournamentName", "matchLabel"],
    body: "Hey {{opponentTag}}! 👋 I'm {{senderTag}}. We play the second leg of our {{matchLabel}} tie in {{tournamentName}}. Let me know a time that works for you so we can settle it.",
  },
  "match-contact-knockout-single": {
    id: "match-contact-knockout-single",
    label: "Player contacting an opponent (single-leg knockout)",
    variables: ["opponentTag", "senderTag", "tournamentName", "matchLabel"],
    body: "Hey {{opponentTag}}! 👋 I'm {{senderTag}}. We meet in {{tournamentName}} ({{matchLabel}}). One match decides who goes through, so let me know a time that works for you.",
  },
  "match-contact-final": {
    id: "match-contact-final",
    label: "Player contacting an opponent (final)",
    variables: ["opponentTag", "senderTag", "tournamentName", "matchLabel"],
    body: "Hey {{opponentTag}}! 👋 I'm {{senderTag}}. We meet in the {{matchLabel}} of {{tournamentName}}. Let me know a time that works for you so we can play.",
  },
};

export function isWhatsAppTemplateId(value: unknown): value is WhatsAppTemplateId {
  return (
    typeof value === "string" &&
    (Object.keys(WHATSAPP_TEMPLATES) as readonly string[]).includes(value)
  );
}

export function getWhatsAppTemplate(id: WhatsAppTemplateId): WhatsAppTemplate {
  return WHATSAPP_TEMPLATES[id];
}

export class WhatsAppTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppTemplateError";
  }
}

/**
 * Renders a template by substituting every `{{variable}}`. Unknown or missing
 * variables throw rather than leaking raw placeholders into a message a
 * player might send.
 */
export function renderWhatsAppTemplate(
  id: WhatsAppTemplateId,
  variables: Readonly<Record<string, string>>,
): string {
  const template = WHATSAPP_TEMPLATES[id];

  if (!template) {
    throw new WhatsAppTemplateError(`Unknown WhatsApp template: ${String(id)}`);
  }

  const provided = new Set(Object.keys(variables));

  for (const name of template.variables) {
    if (!provided.has(name)) {
      throw new WhatsAppTemplateError(`Template "${id}" requires the variable "${name}".`);
    }
  }

  return template.body.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, name: string) => {
    if (!template.variables.includes(name)) {
      throw new WhatsAppTemplateError(`Template "${id}" has no variable "${name}".`);
    }

    const value = variables[name];

    if (typeof value !== "string" || value.trim().length === 0) {
      throw new WhatsAppTemplateError(`Template "${id}" received an empty value for "${name}".`);
    }

    return value;
  });
}
