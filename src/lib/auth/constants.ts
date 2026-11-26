// GCC — auth constants shared by client, proxy and server code.
//
// This module contains no secrets and no environment reads. The session cookie
// name is public knowledge; its value and verification stay server-side.

export const SESSION_COOKIE_NAME = "gcc_session";
export const SESSION_COOKIE_PATH = "/";
export const ROLE_CLAIM = "role";

/**
 * Firebase session cookies can live at most 14 days. The environment may ask for
 * longer, but the browser cookie must never outlive the token it carries.
 */
export const SESSION_COOKIE_MAX_DAYS = 14;

/** Rate-limit policy for the session exchange endpoint. */
export const SESSION_RATE_LIMIT = {
  limit: 10,
  windowSeconds: 60,
} as const;
