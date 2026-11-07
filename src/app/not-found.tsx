// GCC - branded 404 page.
import { ArrowRight, Compass, Home } from "lucide-react";
import Link from "next/link";

import { BrandLockup } from "@/components/brand/logo";
import { buttonStyles } from "@/components/ui/button-styles";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-hero-glow" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-pitch-grid bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />

      <div className="container relative flex flex-1 flex-col">
        <header className="flex h-16 items-center">
          <Link
            href="/"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
          >
            <BrandLockup />
            <span className="sr-only">Home</span>
          </Link>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <div className="relative grid place-items-center">
            <div
              aria-hidden="true"
              className="absolute h-52 w-52 rounded-full border border-electric-400/20"
            />
            <div
              aria-hidden="true"
              className="absolute h-36 w-36 rounded-full border border-electric-400/15"
            />
            <p className="relative font-display text-7xl font-semibold leading-none text-white sm:text-8xl">
              404
            </p>
          </div>

          <p className="mt-8 text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
            Off the pitch
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-display text-white sm:text-5xl">
            This page does not exist
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-grey-300">
            The route may have moved, or the address may be wrong. No competition, player or result
            has been lost — this is only a missing page.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className={buttonStyles({ size: "md" })}>
              <Home aria-hidden="true" className="h-4 w-4" />
              Back to home
            </Link>
            <Link
              href="/tournaments"
              className={buttonStyles({ variant: "secondary", size: "md" })}
            >
              <Compass aria-hidden="true" className="h-4 w-4" />
              Browse tournaments
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
