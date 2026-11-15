// GCC - announcement dismissal state.
//
// Dismissals live in a first-party cookie so the server can leave dismissed
// banners out of the very first HTML response. The previous localStorage
// approach could only be read after hydration, so the banner was inserted
// above the page content and shifted the whole layout (CLS 0.15 on every
// first visit).
//
// This module holds no server-only imports: the server reads the cookie from
// the request, and the banner writes it back in the browser.

export const ANNOUNCEMENT_DISMISSAL_COOKIE = "gcc_dismissed_announcements";

/** One year, in seconds. */
export const ANNOUNCEMENT_DISMISSAL_MAX_AGE = 60 * 60 * 24 * 365;

/** Firestore document ids are URL-safe; anything else is ignored. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_REMEMBERED = 50;

export function parseDismissedAnnouncements(value: string | null | undefined): ReadonlySet<string> {
  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .split(",")
      .map((id) => id.trim())
      .filter((id) => SAFE_ID.test(id)),
  );
}

export function serializeDismissedAnnouncements(ids: Iterable<string>): string {
  // Newest last so the oldest entries fall off first.
  return [...ids]
    .filter((id) => SAFE_ID.test(id))
    .slice(-MAX_REMEMBERED)
    .join(",");
}

/** Reads the dismissal cookie in the browser. Never call this on the server. */
export function readDismissedAnnouncementsCookie(): ReadonlySet<string> {
  for (const entry of document.cookie.split(";")) {
    const [name, ...rest] = entry.trim().split("=");

    if (name === ANNOUNCEMENT_DISMISSAL_COOKIE) {
      return parseDismissedAnnouncements(decodeURIComponent(rest.join("=")));
    }
  }

  return new Set();
}

/** Persists a dismissal in the browser. Never call this on the server. */
export function rememberDismissedAnnouncement(id: string): void {
  const next = new Set(readDismissedAnnouncementsCookie());
  next.add(id);

  document.cookie = [
    `${ANNOUNCEMENT_DISMISSAL_COOKIE}=${encodeURIComponent(serializeDismissedAnnouncements(next))}`,
    "path=/",
    `max-age=${ANNOUNCEMENT_DISMISSAL_MAX_AGE}`,
    "samesite=lax",
  ].join("; ");
}
