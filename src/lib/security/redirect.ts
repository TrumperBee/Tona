// GCC — safe post-login redirect helper.
//
// The `next` query parameter must never become an open redirect. Only a
// same-origin relative path is accepted. The function is pure so the bypass
// tricks can be unit-tested without a Next.js server.

const BASE_URL = "https://gcc.invalid";
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
const SCHEME_PREFIX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Returns a normalised relative path, or `null` when the input is unsafe.
 *
 * Accepted: a path starting with exactly one `/`, with no backslashes,
 * scheme, control characters or authority component. Leading/trailing
 * whitespace is trimmed. Dot segments are normalised before the final check.
 */
export function safeRedirectPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const candidate = value.trim();

  if (
    candidate.length === 0 ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    CONTROL_CHARACTERS.test(candidate)
  ) {
    return null;
  }

  // Reject encoded bypasses such as %2F%2Fevil.com or %5Cevil.com.
  let decoded: string;

  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return null;
  }

  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    CONTROL_CHARACTERS.test(decoded) ||
    SCHEME_PREFIX.test(decoded)
  ) {
    return null;
  }

  // Normalise dot segments and confirm the URL still belongs to the base
  // origin. This also catches "/..//evil.com", which normalises to "//evil.com".
  let url: URL;

  try {
    url = new URL(candidate, BASE_URL);
  } catch {
    return null;
  }

  if (url.origin !== BASE_URL || url.pathname.startsWith("//") || url.pathname.includes("\\")) {
    return null;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
