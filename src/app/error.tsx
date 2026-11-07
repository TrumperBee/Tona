"use client";

// GCC - route error boundary.
// Shows a neutral message; sensitive error details are never rendered.
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replace with structured server logging in Phase 18.
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-hero-glow opacity-60" />
      <div className="container relative flex flex-1 flex-col items-center justify-center py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full border border-warning/30 bg-warning/10 text-warning-soft">
          <AlertTriangle aria-hidden="true" className="h-6 w-6" />
        </span>

        <BrandMark className="mt-6 h-8 w-8 opacity-70" />

        <p className="mt-5 text-xs font-semibold uppercase tracking-eyebrow text-warning-soft">
          Something went wrong
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-display text-white sm:text-5xl">
          This page could not be loaded
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-grey-300">
          An unexpected error occurred while rendering this page. No competition data has been
          changed. You can try again, or return to the home page.
        </p>

        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-grey-500">Reference: {error.digest}</p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset} leftIcon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}>
            Try again
          </Button>
          <Link href="/" className={buttonStyles({ variant: "secondary", size: "md" })}>
            <Home aria-hidden="true" className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
