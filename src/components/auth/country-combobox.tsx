"use client";

// GCC - searchable country combobox.
//
// Options are generated from ISO codes with Intl.DisplayNames and emoji flags.
// The widget follows the ARIA combobox pattern and keeps the selected code in
// controlled state, so the form never depends on a hidden native select.
import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";

import { buildCountryOptions, type CountryOption } from "@/lib/config/countries";
import { cn } from "@/lib/utils/cn";

export interface CountryComboboxProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (code: string) => void;
  readonly invalid?: boolean;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly describedBy?: string;
}

export function CountryCombobox({
  id,
  value,
  onChange,
  invalid = false,
  disabled = false,
  required = false,
  describedBy,
}: CountryComboboxProps) {
  const options = useMemo<readonly CountryOption[]>(() => buildCountryOptions(), []);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find((option) => option.code === value) ?? null;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) {
      return options;
    }

    return options.filter(
      (option) =>
        option.name.toLowerCase().includes(term) ||
        option.code.toLowerCase() === term ||
        option.code.toLowerCase().startsWith(term),
    );
  }, [options, query]);

  const listboxId = `${id}-listbox`;

  function choose(option: CountryOption): void {
    onChange(option.code);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = filtered[activeIndex];

      if (option) {
        choose(option);
      }
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && filtered[activeIndex] ? `${id}-option-${filtered[activeIndex].code}` : undefined
          }
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          autoComplete="country-name"
          disabled={disabled}
          value={open ? query : selected ? `${selected.flag} ${selected.name}` : ""}
          placeholder="Search for a country"
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "block w-full rounded-md border bg-navy-900/70 px-3 py-2.5 pr-10 text-sm text-white shadow-sm transition-colors",
            "placeholder:text-grey-500 focus:outline-none focus:ring-2 focus:ring-electric-400/30",
            "disabled:cursor-not-allowed disabled:opacity-60",
            invalid
              ? "border-danger/60 focus:border-danger focus:ring-danger/20"
              : "border-white/15 focus:border-electric-400",
          )}
        />
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-400"
        />
      </div>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Countries"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-white/15 bg-navy-900 py-1 shadow-dialog"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-grey-400">No countries match that search.</li>
          ) : (
            filtered.map((option, index) => (
              <li key={option.code} role="none">
                <button
                  id={`${id}-option-${option.code}`}
                  type="button"
                  role="option"
                  aria-selected={option.code === value}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    index === activeIndex ? "bg-electric-500/15 text-white" : "text-grey-200",
                  )}
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    {option.flag}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  <span className="text-xs text-grey-500">{option.code}</span>
                  {option.code === value ? (
                    <Check aria-hidden="true" className="h-4 w-4 text-electric-300" />
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
