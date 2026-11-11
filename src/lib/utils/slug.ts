// GCC — URL-safe slug helpers for tournaments and other public records.
//
// Uniqueness is guaranteed by the `tournamentSlugs/{slug}` reservation the
// server creates in the same transaction as the tournament document. The
// helpers here build the base slug from name + season and the numeric-suffix
// candidates tried when a base is already taken.

const MAX_SLUG_LENGTH = 80;
const MAX_SUFFIX_TRIES = 50;

/** Converts arbitrary text into a lowercase, hyphen-separated slug. */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= MAX_SLUG_LENGTH;
}

/**
 * Base slug for a tournament derived from its name and season label, e.g.
 * ("Nairobi Cup", "2026/27") -> "nairobi-cup-2026-27". Falls back to
 * "tournament" when the combined text yields no usable characters.
 */
export function suggestTournamentSlug(name: string, season: string): string {
  const combined = slugify(`${name} ${season}`);
  return combined.length > 0 ? combined : "tournament";
}

/**
 * Slug candidates to try in order: the base first, then `-2`, `-3`, ... up to
 * `maxTries` options. Each candidate stays within the slug length limit.
 */
export function slugCandidates(
  base: string,
  maxTries: number = MAX_SUFFIX_TRIES,
): readonly string[] {
  const candidates = [base];

  for (let suffix = 2; candidates.length < maxTries; suffix += 1) {
    const candidate = `${base}-${suffix}`.slice(0, MAX_SLUG_LENGTH);

    if (!candidates.includes(candidate)) {
      candidates.push(candidate);
    }

    if (suffix > 1_000) break;
  }

  return candidates;
}
