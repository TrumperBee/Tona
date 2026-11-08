// GCC - gamer tag rules.
//
// A gamer tag is the permanent competitive identity: it anchors results and
// history, so it cannot be changed after registration. The same rules run on
// the client for immediate feedback and on the server as the authority.
import { z } from "zod";

import { isReservedGamerTag } from "@/lib/config/reserved-gamer-tags";

/** 3-16 characters, starts/ends alphanumeric, no repeated specials. */
export const GAMER_TAG_PATTERN = /^[A-Za-z0-9](?!.*[._-]{2})[A-Za-z0-9._-]{1,14}[A-Za-z0-9]$/;

export const GAMER_TAG_HINT =
  "3-16 characters. Letters, numbers, dots, underscores and hyphens. Start and end with a letter or number, and do not repeat a special character.";

/** Lowercase uniqueness key. Display casing is preserved separately. */
export function normalizeGamerTag(value: string): string {
  return value.trim().toLowerCase();
}

export function validateGamerTag(value: string): string | null {
  const tag = value.trim();

  if (!GAMER_TAG_PATTERN.test(tag)) {
    return GAMER_TAG_HINT;
  }

  if (isReservedGamerTag(tag)) {
    return "That gamer tag is reserved. Choose another.";
  }

  return null;
}

export const gamerTagSchema = z
  .string()
  .trim()
  .min(3, GAMER_TAG_HINT)
  .max(16, GAMER_TAG_HINT)
  .superRefine((value, context) => {
    const error = validateGamerTag(value);

    if (error) {
      context.addIssue({ code: "custom", message: error });
    }
  });

/** Accepts a gamer tag in any casing and returns its lower-case key. */
export const gamerTagKeySchema = z
  .string()
  .trim()
  .transform(normalizeGamerTag)
  .pipe(z.string().regex(/^[a-z0-9](?!.*[._-]{2})[a-z0-9._-]{1,14}[a-z0-9]$/));
