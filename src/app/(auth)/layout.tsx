// GCC - account route shell.
//
// Accounts are not open yet, but the routes are real and share one calm,
// branded frame. No form is rendered until authentication is implemented.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { BrandLockup } from "@/components/brand/logo";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-col bg-navy-950">
      <header className="border-b border-white/10">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
          >
            <BrandLockup compact />
            <span className="sr-only">Home</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-grey-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to site
          </Link>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-hero-glow opacity-70"
        />
        <div className="relative w-full max-w-xl rounded-xl border border-white/10 bg-navy-900/70 p-6 shadow-card backdrop-blur sm:p-8">
          {children}
        </div>
      </main>

      <footer className="border-t border-white/10 px-4 py-5 text-center text-xs leading-5 text-grey-400">
        GCC is an independent competition platform and is not affiliated with any football governing
        body, game publisher or league.
      </footer>
    </div>
  );
}
