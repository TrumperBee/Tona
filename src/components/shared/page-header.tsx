// GCC - page-level composition helpers.
import type { ReactNode } from "react";

import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/data-display";
import { cn } from "@/lib/utils/cn";

export interface PageHeaderProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly breadcrumbs?: readonly BreadcrumbItem[];
  readonly className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("max-w-3xl", className)}>
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} className="mb-5" /> : null}
      {eyebrow ? (
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
          <span aria-hidden="true" className="h-px w-6 bg-gold-400/60" />
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-3 font-display text-4xl font-semibold uppercase leading-[0.98] tracking-display text-white sm:text-5xl">
        {title}
      </h1>
      {description ? (
        <div className="mt-4 max-w-2xl text-base leading-7 text-grey-300">{description}</div>
      ) : null}
      {actions ? <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

export interface SectionHeadingProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly align?: "left" | "center";
  readonly className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "items-center text-center sm:flex-col sm:items-center",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-gold-300">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 font-display text-3xl font-semibold uppercase tracking-display text-white sm:text-4xl">
          {title}
        </h2>
        {description ? (
          <div className="mt-3 text-sm leading-7 text-grey-400 sm:text-base">{description}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
