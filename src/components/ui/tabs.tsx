"use client";

// GCC - accessible tabs with roving focus.
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface TabItem {
  readonly id: string;
  readonly label: ReactNode;
  readonly content: ReactNode;
  readonly disabled?: boolean;
}

export interface TabsProps {
  readonly items: readonly TabItem[];
  readonly defaultValue?: string;
  readonly value?: string;
  readonly onValueChange?: (id: string) => void;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly listClassName?: string;
  readonly panelClassName?: string;
}

export function Tabs({
  items,
  defaultValue,
  value,
  onValueChange,
  ariaLabel,
  className,
  listClassName,
  panelClassName,
}: TabsProps) {
  const firstEnabled = items.find((item) => !item.disabled)?.id ?? "";
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstEnabled);
  const selected = value ?? internalValue;
  const baseId = useId();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const selectedItem = items.find((item) => item.id === selected);

  function select(id: string): void {
    if (value === undefined) {
      setInternalValue(id);
    }

    onValueChange?.(id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const enabled = items
      .map((item, itemIndex) => ({ item, itemIndex }))
      .filter(({ item }) => !item.disabled);

    if (enabled.length === 0) {
      return;
    }

    const currentEnabledIndex = enabled.findIndex(({ itemIndex }) => itemIndex === index);
    let nextEnabledIndex = currentEnabledIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextEnabledIndex = (currentEnabledIndex + 1) % enabled.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextEnabledIndex = (currentEnabledIndex - 1 + enabled.length) % enabled.length;
    } else if (event.key === "Home") {
      nextEnabledIndex = 0;
    } else if (event.key === "End") {
      nextEnabledIndex = enabled.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const next = enabled[nextEnabledIndex];

    if (!next) {
      return;
    }

    select(next.item.id);
    tabRefs.current[next.item.id]?.focus();
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          "no-scrollbar flex gap-1 overflow-x-auto border-b border-white/10",
          listClassName,
        )}
      >
        {items.map((item, index) => {
          const isSelected = item.id === selected;

          return (
            <button
              key={item.id}
              ref={(element) => {
                tabRefs.current[item.id] = element;
              }}
              id={`${baseId}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={isSelected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => select(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "relative shrink-0 rounded-t-md px-4 py-2.5 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950",
                "disabled:cursor-not-allowed disabled:opacity-40",
                isSelected
                  ? "text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-electric-400"
                  : "text-grey-400 hover:bg-white/[0.04] hover:text-grey-200",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {selectedItem ? (
        <div
          id={`${baseId}-panel-${selectedItem.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${selectedItem.id}`}
          tabIndex={0}
          className={cn(
            "pt-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950",
            panelClassName,
          )}
        >
          {selectedItem.content}
        </div>
      ) : null}
    </div>
  );
}
