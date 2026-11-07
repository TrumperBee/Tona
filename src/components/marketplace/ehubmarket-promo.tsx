// GCC - marketplace partner promotion.
//
// The copy is fixed by the partnership brief. The link always opens in a new
// tab with noopener/noreferrer and is presented as a contained panel, never a
// pop-up or interstitial.
import { ArrowUpRight } from "lucide-react";

import { buttonStyles } from "@/components/ui/button-styles";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";

export function EHubMarketPromo({ className }: { readonly className?: string }) {
  return (
    <aside
      aria-labelledby="ehubmarket-heading"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-gold-400/20 bg-gradient-to-br from-gold-400/[0.08] via-navy-900/70 to-navy-950 p-6 sm:p-8",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-gold-400/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-10 h-40 w-40 rounded-full border border-gold-400/10"
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
            eHubMarket partner
          </p>
          <h2
            id="ehubmarket-heading"
            className="mt-2 font-display text-3xl font-semibold uppercase tracking-display text-white sm:text-4xl"
          >
            LOOKING FOR AN eFOOTBALL ACCOUNT?
          </h2>
          <p className="mt-3 text-sm leading-6 text-grey-300">
            Explore eFootball accounts from eHubMarket, GCC&apos;s marketplace partner. The
            marketplace opens in a new tab.
          </p>
        </div>
        <a
          href={siteConfig.eHubMarketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonStyles({ variant: "gold", size: "lg", className: "shrink-0" })}
        >
          EXPLORE MARKETPLACE
          <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
        </a>
      </div>
    </aside>
  );
}
