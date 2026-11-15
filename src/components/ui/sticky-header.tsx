// GCC - sticky header.
//
// A small sticky band for sub-page toolbars (filters, section titles) that sits
// under the app top bar. It respects notches on iOS and never overlaps the
// header: `top` is supplied by the caller because the public header and the app
// header differ in height.
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface StickyHeaderProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly offsetClassName?: string;
}

export function StickyHeader({
  children,
  className,
  offsetClassName = "top-14",
}: StickyHeaderProps) {
  return (
    <div
      className={cn(
        "sticky z-20 -mx-4 border-b border-white/10 bg-navy-950/90 px-4 py-2 backdrop-blur-xl",
        "sm:-mx-6 sm:px-6",
        offsetClassName,
        className,
      )}
    >
      {children}
    </div>
  );
}
