// GCC - cursor pagination links for Super Admin lists.
//
// Page numbers would require offset queries, so lists move one opaque cursor at
// a time. The count shown is an exact Firestore count() aggregate.
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonStyles } from "@/components/ui/button-styles";

export interface CursorNavProps {
  readonly previousHref: string | null;
  readonly nextHref: string | null;
  readonly summary?: ReactNode;
  readonly label?: string;
}

export function CursorNav({
  previousHref,
  nextHref,
  summary,
  label = "List pagination",
}: CursorNavProps) {
  if (!previousHref && !nextHref && !summary) {
    return null;
  }

  return (
    <nav
      aria-label={label}
      className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs text-grey-400">{summary}</p>
      <div className="flex items-center gap-2">
        {previousHref ? (
          <Link
            href={previousHref}
            className={buttonStyles({ variant: "secondary", size: "sm" })}
            rel="prev"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            Previous
          </Link>
        ) : null}
        {nextHref ? (
          <Link
            href={nextHref}
            className={buttonStyles({ variant: "secondary", size: "sm" })}
            rel="next"
          >
            Next
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
