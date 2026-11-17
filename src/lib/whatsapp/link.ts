// GCC — click-to-chat link builder (desktop and mobile web).
// Pure helper: the server can generate links without calling any WhatsApp API.
// Phase 14 uses it from the player-to-opponent contact route and the organiser
// registration contact route; the number only ever exists inside the returned
// link.

import { isValidE164, normalizePhone } from "./phone";

/** Builds an official wa.me link. Throws on an invalid E.164 number. */
export function buildWhatsAppLink(phone: string, message?: string): string {
  const normalized = normalizePhone(phone);

  if (!isValidE164(normalized)) {
    throw new Error("A valid E.164 phone number is required to build a WhatsApp link.");
  }

  const base = `https://wa.me/${normalized.slice(1)}`;
  const text = message?.trim();

  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
