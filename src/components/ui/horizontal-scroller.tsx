// GCC - horizontal scroller.
//
// A single-row scroller for cards, stats and chips. It snaps on touch, keeps
// the page itself free of horizontal overflow, and exposes a labelled region so
// keyboard and screen-reader users know what moves.
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface HorizontalScrollerProps {
  readonly children: ReactNode;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly itemClassName?: string;
  readonly snap?: boolean;
}

export function HorizontalScroller({
  children,
  ariaLabel,
  className,
  itemClassName,
  snap = true,
}: HorizontalScrollerProps) {
  return (
    <div
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      className={cn(
        "-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
        className,
      )}
    >
      <div className={cn("flex gap-3 pb-1", snap && "snap-x snap-mandatory", itemClassName)}>
        {children}
      </div>
    </div>
  );
}
