"use client";

// GCC - searchable multi-country picker for entry restrictions.
//
// An empty selection means "every country is welcome", which is also how the
// server stores an unrestricted competition (null). The list is the platform's
// real country config, filtered as the organiser types.
import { useMemo, useState } from "react";

import { buildCountryOptions } from "@/lib/config/countries";
import { cn } from "@/lib/utils/cn";

export interface CountryPickerProps {
  readonly id: string;
  readonly selected: readonly string[];
  readonly onChange: (codes: readonly string[]) => void;
  readonly disabled?: boolean;
  readonly describedBy?: string;
}

const LIST_LIMIT = 40;

export function CountryPicker({
  id,
  selected,
  onChange,
  disabled = false,
  describedBy,
}: CountryPickerProps) {
  const [query, setQuery] = useState("");
  const options = useMemo(() => buildCountryOptions(), []);
  const term = query.trim().toLowerCase();

  const matches = useMemo(() => {
    const filtered = term
      ? options.filter(
          (option) =>
            option.name.toLowerCase().includes(term) || option.code.toLowerCase() === term,
        )
      : options;

    return filtered.slice(0, LIST_LIMIT);
  }, [options, term]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggle(code: string): void {
    if (disabled) {
      return;
    }

    onChange(
      selectedSet.has(code) ? selected.filter((value) => value !== code) : [...selected, code],
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        id={`${id}-search`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        disabled={disabled}
        placeholder="Filter countries…"
        aria-describedby={describedBy}
        aria-controls={`${id}-list`}
        className="block w-full rounded-md border border-white/15 bg-navy-900/70 px-3 py-2.5 text-sm text-white shadow-sm transition-colors placeholder:text-grey-500 focus:border-electric-400 focus:outline-none focus:ring-2 focus:ring-electric-400/30 disabled:cursor-not-allowed disabled:opacity-60"
      />

      <fieldset
        id={`${id}-list`}
        disabled={disabled}
        className="max-h-44 overflow-y-auto rounded-md border border-white/15 bg-navy-950/50 p-2"
      >
        <legend className="sr-only">Allowed countries</legend>
        {matches.length === 0 ? (
          <p className="p-2 text-xs text-grey-500">No country matches that filter.</p>
        ) : (
          matches.map((option) => {
            const checked = selectedSet.has(option.code);

            return (
              <label
                key={option.code}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm text-grey-200 transition-colors hover:bg-white/5",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(option.code)}
                  disabled={disabled}
                  className="h-4 w-4 shrink-0 cursor-pointer rounded border-white/30 accent-electric-400"
                />
                <span aria-hidden="true">{option.flag}</span>
                <span className="truncate">{option.name}</span>
                <span className="ml-auto text-xs text-grey-500">{option.code}</span>
              </label>
            );
          })
        )}
      </fieldset>

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-eyebrow text-grey-500">
            Restricted to {selected.length}:
          </span>
          {selected.map((code) => (
            <button
              key={code}
              type="button"
              disabled={disabled}
              onClick={() => toggle(code)}
              className="rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-xs text-grey-200 transition-colors hover:border-danger/40 hover:text-danger-soft"
            >
              {code}
              <span className="sr-only"> (remove)</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-grey-500">
          No country selected — players from every country are welcome.
        </p>
      )}
    </div>
  );
}
