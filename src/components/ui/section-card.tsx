// GCC - section card.
//
// A labelled block for grouping related content inside long dashboards. It is
// deliberately lighter than `Card`: an optional heading row with an action, the
// body and an optional footer. Text never drops below 12px.
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface SectionCardProps {
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
  readonly bodyClassName?: string;
  readonly id?: string;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  footer,
  className,
  bodyClassName,
  id,
}: SectionCardProps) {
  return (
    <section
      id={id}
      className={cn(
        "overflow-hidden rounded-xl border border-white/10 bg-navy-900/50 shadow-card",
        className,
      )}
    >
      {title || description || action ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-display text-base font-semibold uppercase tracking-display text-white sm:text-lg">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-xs leading-5 text-grey-400">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}

      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>

      {footer ? (
        <footer className="border-t border-white/10 bg-navy-950/40 p-4 sm:p-5">{footer}</footer>
      ) : null}
    </section>
  );
}
