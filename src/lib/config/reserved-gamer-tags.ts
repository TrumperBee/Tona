// GCC - reserved gamer tags.
//
// These names are used by the platform or could be used to impersonate it.
// Matching is case-insensitive and exact; the list is intentionally short and
// explicit so it can be reviewed.

export const RESERVED_GAMER_TAGS: readonly string[] = [
  "admin",
  "administrator",
  "gcc",
  "gccadmin",
  "gccofficial",
  "support",
  "moderator",
  "mod",
  "staff",
  "official",
  "system",
  "root",
  "null",
  "undefined",
  "superadmin",
  "super_admin",
  "super-admin",
  "organiser",
  "organizer",
  "referee",
  "security",
  "help",
  "helpdesk",
];

const reservedLower = new Set(RESERVED_GAMER_TAGS.map((tag) => tag.toLowerCase()));

export function isReservedGamerTag(value: string): boolean {
  return reservedLower.has(value.trim().toLowerCase());
}
