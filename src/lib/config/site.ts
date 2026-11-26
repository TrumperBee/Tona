// GCC - static product identity and outward-facing links.
// Values here are public by design and safe to import anywhere.

export const SITE_NAME = "Global Champions Circuit";
export const SITE_SHORT_NAME = "GCC";
export const SITE_TAGLINE = "One Platform. Endless Competition.";

const fallbackEHubMarketUrl = "https://ehubmarket.me/";
const fallbackSiteUrl = "http://localhost:3000";

/** Reads a public env var, treating blank values as unset. */
function publicEnv(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Public URLs become `href`/`src` values, so only https (or local http for
 * development) is accepted. javascript:, data: and other schemes fall back to
 * the canonical value instead of becoming executable link targets.
 */
function safePublicUrl(value: string | undefined, fallback: string, stripSlashes: boolean): string {
  const candidate = publicEnv(value);

  if (!candidate) {
    return fallback;
  }

  try {
    const url = new URL(candidate);
    const loopback = url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);

    if (
      !url.username &&
      !url.password &&
      url.hostname.length > 0 &&
      (url.protocol === "https:" || loopback)
    ) {
      return stripSlashes ? candidate.replace(/\/+$/, "") : candidate;
    }
  } catch {
    // Malformed values fall through to the canonical fallback.
  }

  return fallback;
}

/** Promotional partner link. Falls back to the canonical URL when unsafe. */
export const EHUBMARKET_URL = safePublicUrl(
  process.env.NEXT_PUBLIC_EHUBMARKET_URL,
  fallbackEHubMarketUrl,
  false,
);

/** Canonical deployment URL used for metadata, robots and sitemap. */
export const SITE_URL = safePublicUrl(process.env.NEXT_PUBLIC_SITE_URL, fallbackSiteUrl, true);

/** Public contact channels. Unset values are omitted rather than invented. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;
export const CONTACT_WHATSAPP_E164 = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP?.trim() || null;

const contactWhatsAppDigits = CONTACT_WHATSAPP_E164?.replace(/\D/g, "") ?? "";
export const CONTACT_WHATSAPP_URL = contactWhatsAppDigits
  ? `https://wa.me/${contactWhatsAppDigits}`
  : null;

export const siteConfig = {
  name: SITE_NAME,
  shortName: SITE_SHORT_NAME,
  tagline: SITE_TAGLINE,
  description:
    "GCC is an independent tournament platform for football gaming communities - " +
    "competitive leagues, verified results, permanent records and a Hall of Fame.",
  url: SITE_URL,
  eHubMarketUrl: EHUBMARKET_URL,
  contactEmail: CONTACT_EMAIL,
  contactWhatsAppUrl: CONTACT_WHATSAPP_URL,
} as const;

export type SiteConfig = typeof siteConfig;
