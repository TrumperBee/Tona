// GCC — WhatsApp message templates.
//
// Typed templates with `{{variable}}` placeholders, rendered server-side into
// the pre-filled text of a wa.me click-to-chat link. The organiser contact
// message is deliberately generic: it never includes phone numbers, emails
// or anything the player has not already made public. Phase 14 reuses this
// registry for registration confirmations, fixture reminders and result
// notifications.

export type WhatsAppTemplateId =
  | "organiser-contact"
  | "registration-confirmed"
  | "fixture-reminder"
  | "result-confirmed"
  | "result-report-opened";

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
