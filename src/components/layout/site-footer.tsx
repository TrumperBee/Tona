// GCC - public site footer.
// Includes the independence notice and the eHubMarket partner link.
import { ArrowUpRight, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";

import { BrandLockup } from "@/components/brand/logo";
import { SITE_NAME, SITE_TAGLINE, siteConfig } from "@/lib/config/site";

const footerNavigation = [
  {
    heading: "Competition",
    links: [
      { href: "/tournaments", label: "Tournaments" },
      { href: "/rankings", label: "Rankings" },
      { href: "/hall-of-fame", label: "Hall of Fame" },
      { href: "/archives", label: "Archives" },
    ],
  },
  {
    heading: "Community",
    links: [
      { href: "/players", label: "Players" },
      { href: "/announcements", label: "Announcements" },
      { href: "/about", label: "About GCC" },
      { href: "/organiser-code", label: "Organiser code" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/terms", label: "Terms of use" },
      { href: "/privacy", label: "Privacy policy" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-navy-950">
      <div className="container grid gap-10 py-14 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <Link
            href="/"
            className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
          >
            <BrandLockup />
            <span className="sr-only">Home</span>
          </Link>
          <p className="mt-5 text-sm leading-6 text-grey-400">
            Independent tournament infrastructure for football gaming communities. Draws, fixtures,
            verified results and permanent records in one place.
          </p>
          <p className="mt-3 text-sm font-semibold text-electric-300">{SITE_TAGLINE}</p>

          <div className="mt-6 space-y-2">
            {siteConfig.contactEmail ? (
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="flex items-center gap-2 text-sm text-grey-300 transition-colors hover:text-white"
              >
                <Mail aria-hidden="true" className="h-4 w-4 text-grey-500" />
                {siteConfig.contactEmail}
              </a>
            ) : null}
            {siteConfig.contactWhatsAppUrl ? (
              <a
                href={siteConfig.contactWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-grey-300 transition-colors hover:text-white"
              >
                <MessageCircle aria-hidden="true" className="h-4 w-4 text-grey-500" />
                WhatsApp support
                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>

        {footerNavigation.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
              {group.heading}
            </p>
            <ul className="mt-4 space-y-2.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="rounded text-sm text-grey-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="container flex flex-col gap-4 py-6 text-xs text-grey-400 md:flex-row md:items-center md:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
          <p className="max-w-xl md:text-right">
            GCC is an independent competition platform and is not affiliated with, endorsed by or
            sponsored by UEFA, any football game publisher or any league.
          </p>
          <a
            href={siteConfig.eHubMarketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-gold-400/25 px-3 py-1.5 font-semibold uppercase tracking-eyebrow text-gold-200 transition-colors hover:border-gold-400/50 hover:text-gold-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
          >
            eHubMarket
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
