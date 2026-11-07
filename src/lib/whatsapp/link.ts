// GCC — click-to-chat link builder (desktop and mobile web).
// Pure helper: the server can generate links without calling any WhatsApp API.
// TODO(phase 14): use inside notification and fixture reminder flows.

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
