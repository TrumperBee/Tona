// GCC — WhatsApp message templates.
// Planned: typed templates for registration confirmations, fixture reminders,
// result confirmations and dispute updates. Message copy is finalised in Phase 14.
// TODO(phase 14): implement the template registry and variable substitution.

export type WhatsAppTemplateId =
  "registration-confirmed" | "fixture-reminder" | "result-confirmed" | "dispute-opened";

export interface WhatsAppTemplate {
  readonly id: WhatsAppTemplateId;
  readonly label: string;
  /** Placeholders are written as {{variableName}} and filled server-side. */
  readonly body: string;
}
