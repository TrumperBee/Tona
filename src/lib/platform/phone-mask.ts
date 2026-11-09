// GCC - phone-number masking for privileged screens.
//
// Numbers are stored only as E.164 on the private user document. The Super
// Admin sees a masked value by default; revealing the full number is a separate
// audited action.
import { parsePhoneNumberFromString } from "libphonenumber-js";

function groupInThrees(value: string): string {
  return value.match(/.{1,3}/g)?.join(" ") ?? value;
}

function maskDigits(digits: string, visibleStart: number, visibleEnd: number): string {
  if (digits.length <= visibleStart + visibleEnd + 1) {
    return groupInThrees("•".repeat(digits.length));
  }

  const visible = new Set<number>();
  for (let index = 0; index < visibleStart; index += 1) visible.add(index);
  for (let index = digits.length - visibleEnd; index < digits.length; index += 1) {
    visible.add(index);
  }

  const masked = [...digits].map((digit, index) => (visible.has(index) ? digit : "•")).join("");

  return groupInThrees(masked);
}

/** Returns e.g. `+254 7•• ••• 678`, or null when there is no number. */
export function maskPhoneNumber(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = parsePhoneNumberFromString(value);

  if (parsed) {
    return `+${parsed.countryCallingCode} ${maskDigits(parsed.nationalNumber, 1, 3)}`;
  }

  const digits = value.replace(/\D/g, "");

  if (digits.length === 0) {
    return null;
  }

  return groupInThrees(maskDigits(digits, 0, 3));
}
