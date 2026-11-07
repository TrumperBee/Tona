"use client";

// GCC - pagination control.
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface PaginationProps {
  readonly page: number;
  readonly pageCount: number;
  readonly onPageChange?: (page: number) => void;
  readonly hrefForPage?: (page: number) => string;
  readonly ariaLabel?: string;
  readonly className?: string;
}

function pageItems(page: number, pageCount: number): Array<number | "ellipsis"> {
  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const valid = [...pages]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];

  valid.forEach((value, index) => {
    const previous = valid[index - 1];

    if (previous !== undefined && value - previous > 1) {
      result.push("ellipsis");
    }

    result.push(value);
  });

  return result;
}

const itemClasses =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-semibold transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950";

export function Pagination({
  page,
  pageCount,
  onPageChange,
  hrefForPage,
  ariaLabel = "Pagination",
  className,
}: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  const current = Math.min(Math.max(page, 1), pageCount);
  const previousDisabled = current <= 1;
  const nextDisabled = current >= pageCount;

  function renderPageControl(target: number, content: ReactNode, targetPage: number) {
    if (hrefForPage) {
      return (
        <Link
          href={hrefForPage(target)}
          aria-current={target === current ? "page" : undefined}
          aria-label={`Page ${target}`}
          className={cn(
            itemClasses,
            target === current
              ? "bg-electric-500 text-navy-950"
              : "text-grey-300 hover:bg-white/[0.07] hover:text-white",
          )}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onPageChange?.(targetPage)}
        aria-current={target === current ? "page" : undefined}
        aria-label={`Page ${target}`}
        className={cn(
          itemClasses,
          target === current
            ? "bg-electric-500 text-navy-950"
            : "text-grey-300 hover:bg-white/[0.07] hover:text-white",
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <nav
      aria-label={ariaLabel}
      className={cn("flex items-center justify-between gap-3", className)}
    >
      <span className="text-xs text-grey-500">
        Page {current} of {pageCount}
      </span>
      <div className="flex items-center gap-1">
        {hrefForPage ? (
          <Link
            href={hrefForPage(Math.max(1, current - 1))}
            aria-disabled={previousDisabled}
            aria-label="Previous page"
            className={cn(
              itemClasses,
              previousDisabled
                ? "pointer-events-none opacity-40"
                : "text-grey-300 hover:bg-white/[0.07] hover:text-white",
            )}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </Link>
        ) : (
          <button
            type="button"
            disabled={previousDisabled}
            onClick={() => onPageChange?.(current - 1)}
            aria-label="Previous page"
            className={cn(
              itemClasses,
              previousDisabled
                ? "cursor-not-allowed opacity-40"
                : "text-grey-300 hover:bg-white/[0.07] hover:text-white",
            )}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </button>
        )}

        {pageItems(current, pageCount).map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden="true"
              className="inline-flex h-9 min-w-9 items-center justify-center text-grey-500"
            >
              &hellip;
            </span>
          ) : (
            <span key={item}>{renderPageControl(item, item, item)}</span>
          ),
        )}

        {hrefForPage ? (
          <Link
            href={hrefForPage(Math.min(pageCount, current + 1))}
            aria-disabled={nextDisabled}
            aria-label="Next page"
            className={cn(
              itemClasses,
              nextDisabled
                ? "pointer-events-none opacity-40"
                : "text-grey-300 hover:bg-white/[0.07] hover:text-white",
            )}
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        ) : (
          <button
            type="button"
            disabled={nextDisabled}
            onClick={() => onPageChange?.(current + 1)}
            aria-label="Next page"
            className={cn(
              itemClasses,
              nextDisabled
                ? "cursor-not-allowed opacity-40"
                : "text-grey-300 hover:bg-white/[0.07] hover:text-white",
            )}
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>
    </nav>
  );
}
