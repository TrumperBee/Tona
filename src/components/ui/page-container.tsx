// GCC - page container.
//
// One gutter and max-width rule for every page. Use it instead of ad-hoc
// `mx-auto max-w-* px-*` wrappers so grouped pages line up and no page can
// introduce a horizontal scrollbar at 360px.
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type PageContainerWidth = "narrow" | "default" | "wide" | "full";

const widths: Record<PageContainerWidth, string> = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

export interface PageContainerProps {
  readonly children: ReactNode;
  readonly width?: PageContainerWidth;
  readonly className?: string;
  /** Adds bottom padding for the mobile tab bar. */
  readonly withTabBar?: boolean;
  readonly as?: "div" | "main" | "section";
}

export function PageContainer({
  children,
  width = "default",
  className,
  withTabBar = false,
  as: Tag = "div",
}: PageContainerProps) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        withTabBar && "pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-12",
        widths[width],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
