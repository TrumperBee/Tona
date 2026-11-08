// GCC - phone number helpers (E.164).
//
// Numbers are parsed with libphonenumber-js. The browser sends either a
// national number with the selected country or an international number; the
// server stores only E.164 in the private user document.
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { z } from "zod";

/** E.164: a leading +, a non-zero country digit, then 7-14 more digits. */
export const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/** Removes spaces, brackets, dots and hyphens. Does not add a country code. */
export function normalizePhone(input: string): string {
  return input.trim().replace(/[\s().-]/g, "");
}

/** Returns E.164 for a valid number, or null. */
export function normalizeToE164(
  input: string | null | undefined,
  defaultCountry?: string,
): string | null {
  const raw = input?.trim();

  if (!raw) {
    return null;
  }

  const country =
    defaultCountry && /^[A-Za-z]{2}$/.test(defaultCountry)
      ? (defaultCountry.toUpperCase() as CountryCode)
      : undefined;

  const parsed = parsePhoneNumberFromString(raw, country);

  if (!parsed || !parsed.isValid()) {
    return null;
  }

  return parsed.number;
}

export function isValidE164(input: string): boolean {
  return E164_PATTERN.test(normalizePhone(input));
}

export const e164Schema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .pipe(z.string().regex(E164_PATTERN, "Use international format, e.g. +254712345678."));

/** Validates a number against a selected country and returns E.164. */
export function whatsappSchema(country: string) {
  return z
    .string()
    .trim()
    .max(32, "That number is too long.")
    .transform((value, context) => {
      if (!value) {
        return undefined;
      }

      const e164 = normalizeToE164(value, country);

      if (!e164) {
        context.addIssue({
          code: "custom",
          message: "Enter a valid mobile number for the selected country.",
        });
        return z.NEVER;
      }

      return e164;
    });
}
