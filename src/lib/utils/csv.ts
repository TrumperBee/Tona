// GCC — CSV cell escaping, including spreadsheet formula-injection defence.
//
// User-controlled values (gamer tags, full names, countries, platforms) can
// begin with a spreadsheet formula marker. Excel, Sheets and LibreOffice would
// evaluate those cells on open, so a leading apostrophe forces text parsing.
// The apostrophe is part of the CSV value, not a shell/HTML escape.

const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const FORMULA_AFTER_SPACE = /^\s+[=+\-@]/;

/** Escapes one CSV cell and neutralises leading formula markers. */
export function csvCell(value: string): string {
  const safe = FORMULA_PREFIX.test(value) || FORMULA_AFTER_SPACE.test(value) ? `'${value}` : value;

  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
