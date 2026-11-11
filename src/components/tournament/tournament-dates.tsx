"use client";

// GCC - tournament dates with a competition/local time toggle.
//
// Dates are stored UTC plus the competition's IANA timezone. The default view
// renders in the competition's timezone (the one the organiser publishes);
// the toggle re-renders the same instants in the viewer's device timezone so
// nobody has to do timezone maths in their head.
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils/cn";

type DateMode = "competition" | "local";

export interface TournamentDatesProps {
  readonly opensAt: string | null;
  readonly closesAt: string | null;
  readonly startsAt: string | null;
  readonly timezone: string;
  readonly className?: string;
}

function formatIn(value: string | null, timeZone: string | undefined): string {
  if (!value) {
    return "To be confirmed";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "To be confirmed";
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function TournamentDates({
  opensAt,
  closesAt,
  startsAt,
  timezone,
  className,
}: TournamentDatesProps) {
  const [mode, setMode] = useState<DateMode>("competition");
  const timeZone = mode === "competition" ? timezone : undefined;
  const localLabel = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "your device time";
    }
  }, []);

  const rows = [
    { label: "Registration opens", value: opensAt },
    { label: "Registration closes", value: closesAt },
    { label: "Competition starts", value: startsAt },
  ] as const;

  return (
    <div className={className}>
      <div
        className="inline-flex rounded-md border border-white/15 bg-navy-900/70 p-0.5"
        role="group"
        aria-label="Date display timezone"
      >
        {(
          [
            { id: "competition", label: `Competition time (${timezone})` },
            { id: "local", label: `Your local time` },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={mode === option.id}
            onClick={() => setMode(option.id)}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-semibold transition-colors",
              mode === option.id
                ? "bg-electric-500/20 text-white"
                : "text-grey-400 hover:text-grey-200",
            )}
          >
            {option.id === "local" ? `Your local time (${localLabel})` : option.label}
          </button>
        ))}
      </div>

      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/5 pb-2 last:border-none"
          >
            <dt className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
              {row.label}
            </dt>
            <dd className="text-sm font-medium text-grey-100">{formatIn(row.value, timeZone)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
