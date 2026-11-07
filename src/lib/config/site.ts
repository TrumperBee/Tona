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

/** Promotional partner link. Falls back to the canonical URL when unset. */
export const EHUBMARKET_URL =
  publicEnv(process.env.NEXT_PUBLIC_EHUBMARKET_URL) ?? fallbackEHubMarketUrl;

/** Canonical deployment URL used for metadata, robots and sitemap. */
export const SITE_URL = (publicEnv(process.env.NEXT_PUBLIC_SITE_URL) ?? fallbackSiteUrl).replace(
  /\/+$/,
  "",
);

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
