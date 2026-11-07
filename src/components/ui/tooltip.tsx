"use client";

// GCC - tooltip for short, supplementary explanations.
import { Children, cloneElement, useId, useState, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type TooltipSide = "top" | "bottom" | "left" | "right";

const sideStyles: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};

export interface TooltipProps {
  readonly content: ReactNode;
  readonly children: ReactElement<{ "aria-describedby"?: string }>;
  readonly side?: TooltipSide;
  readonly className?: string;
}

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = Children.only(children);
  const existingDescription = trigger.props["aria-describedby"];
  const describedBy = [existingDescription, open ? id : undefined].filter(Boolean).join(" ");

  const cloned = cloneElement(trigger, {
    "aria-describedby": describedBy || undefined,
  });

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {cloned}
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 w-max max-w-56 animate-fade-in rounded-md border border-white/10 bg-navy-800 px-2.5 py-1.5 text-xs font-medium leading-5 text-grey-100 shadow-card",
            sideStyles[side],
            className,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
