"use client";

// GCC - dropdown menu with roving keyboard focus.
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface DropdownMenuItem {
  readonly label: string;
  readonly href?: string;
  readonly onSelect?: () => void;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
  readonly danger?: boolean;
  readonly separatorBefore?: boolean;
}

export interface DropdownMenuProps {
  readonly label: string;
  readonly trigger: ReactNode;
  readonly items: readonly DropdownMenuItem[];
  readonly align?: "start" | "end";
  readonly className?: string;
  readonly menuClassName?: string;
}

export function DropdownMenu({
  label,
  trigger,
  items,
  align = "end",
  className,
  menuClassName,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | HTMLAnchorElement | null>>([]);
  const menuId = useId();

  const enabledIndexes = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.disabled)
    .map(({ index }) => index);

  useEffect(() => {
    if (!open) {
      return;
    }

    const first = enabledIndexes[0];

    if (first !== undefined) {
      itemRefs.current[first]?.focus();
    }

    function onPointerDown(event: PointerEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
    // enabledIndexes is derived from items; reopening is the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function focusAt(index: number): void {
    setActiveIndex(index);
    itemRefs.current[index]?.focus();
  }

  function toggleMenu(): void {
    if (open) {
      setOpen(false);
      return;
    }

    const first = enabledIndexes[0];

    if (first !== undefined) {
      setActiveIndex(first);
    }

    setOpen(true);
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const currentPosition = enabledIndexes.indexOf(activeIndex);

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    let nextPosition = currentPosition;

    if (event.key === "ArrowDown") {
      nextPosition = (currentPosition + 1) % enabledIndexes.length;
    } else if (event.key === "ArrowUp") {
      nextPosition = (currentPosition - 1 + enabledIndexes.length) % enabledIndexes.length;
    } else if (event.key === "Home") {
      nextPosition = 0;
    } else if (event.key === "End") {
      nextPosition = enabledIndexes.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextIndex = enabledIndexes[nextPosition];

    if (nextIndex !== undefined) {
      focusAt(nextIndex);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggleMenu}
        className="inline-flex items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
      >
        {trigger}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className={cn(
            "absolute top-full z-50 mt-2 min-w-52 animate-scale-in rounded-lg border border-white/10 bg-navy-900 p-1.5 shadow-dialog",
            align === "end" ? "right-0" : "left-0",
            menuClassName,
          )}
        >
          {items.map((item, index) => {
            const classes = cn(
              "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400",
              item.danger ? "text-danger-soft" : "text-grey-200",
              item.disabled
                ? "cursor-not-allowed opacity-40"
                : item.danger
                  ? "hover:bg-danger/10 hover:text-white"
                  : "hover:bg-white/[0.07] hover:text-white",
            );

            const content = (
              <>
                {item.icon ? (
                  <span aria-hidden="true" className="shrink-0">
                    {item.icon}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">{item.label}</span>
              </>
            );

            return (
              <div key={`${item.label}-${index}`}>
                {item.separatorBefore ? (
                  <div role="separator" className="my-1.5 h-px bg-white/10" />
                ) : null}
                {item.href && !item.disabled ? (
                  <Link
                    ref={(element) => {
                      itemRefs.current[index] = element;
                    }}
                    href={item.href}
                    role="menuitem"
                    tabIndex={index === activeIndex ? 0 : -1}
                    onClick={() => setOpen(false)}
                    className={classes}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    ref={(element) => {
                      itemRefs.current[index] = element;
                    }}
                    type="button"
                    role="menuitem"
                    tabIndex={index === activeIndex ? 0 : -1}
                    disabled={item.disabled}
                    onClick={() => {
                      item.onSelect?.();
                      setOpen(false);
                    }}
                    className={classes}
                  >
                    {content}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
