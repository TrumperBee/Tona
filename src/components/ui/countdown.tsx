"use client";

// GCC - live countdown. Kept as its own client module so the rest of the
// display primitives stay server-renderable.
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils/cn";

interface Remaining {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly complete: boolean;
}

function remainingUntil(targetMs: number): Remaining {
  const difference = targetMs - Date.now();

  if (!Number.isFinite(difference) || difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, complete: true };
  }

  const seconds = Math.floor(difference / 1000);

  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    complete: false,
  };
}

export interface CountdownProps {
  readonly target: Date | string | number;
  readonly label?: string;
  readonly completeLabel?: string;
  readonly className?: string;
  readonly size?: "sm" | "md";
}

export function Countdown({
  target,
  label,
  completeLabel = "Starting now",
  className,
  size = "md",
}: CountdownProps) {
  const targetMs = new Date(target).getTime();
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    function tick(): void {
      setRemaining(remainingUntil(targetMs));
    }

    tick();
    const interval = window.setInterval(tick, 1000);

    return () => window.clearInterval(interval);
  }, [targetMs]);

  const value = remaining ?? { days: 0, hours: 0, minutes: 0, seconds: 0, complete: false };
  const segments = [
    { label: "Days", value: value.days },
    { label: "Hours", value: value.hours },
    { label: "Minutes", value: value.minutes },
    { label: "Seconds", value: value.seconds },
  ] as const;

  return (
    <div className={className}>
      {label ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-eyebrow text-grey-400">
          {label}
        </p>
      ) : null}
      {value.complete ? (
        <p className="text-sm font-semibold text-electric-300">{completeLabel}</p>
      ) : (
        <div role="timer" aria-live="off" className="flex gap-2">
          <span className="sr-only">
            {remaining
              ? `${value.days} days, ${value.hours} hours, ${value.minutes} minutes and ${value.seconds} seconds remaining`
              : "Countdown loading"}
          </span>
          {segments.map((segment) => (
            <span
              key={segment.label}
              aria-hidden="true"
              className={cn(
                "flex flex-col items-center rounded-md border border-white/10 bg-navy-900/80",
                size === "sm" ? "min-w-11 px-1.5 py-1" : "min-w-14 px-2 py-1.5",
              )}
            >
              <span
                className={cn(
                  "font-display font-semibold tabular-nums text-white",
                  size === "sm" ? "text-lg" : "text-2xl",
                )}
              >
                {remaining ? String(segment.value).padStart(2, "0") : "--"}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-eyebrow text-grey-500">
                {segment.label}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
