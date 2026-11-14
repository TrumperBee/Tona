"use client";

// GCC - refresh the server components without losing the reader's place.
//
// `router.refresh()` re-renders the current route from the server. In the App
// Router that can reset the window scroll position, which is very noticeable
// after saving a result halfway down a long board. This hook records the scroll
// offset and the focused control before the refresh and restores both once the
// new tree has painted (ADR-067).
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const RESTORE_DELAYS = [0, 60, 180, 400] as const;

export function useRefreshPreservingScroll(): () => void {
  const router = useRouter();
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) {
      window.clearTimeout(timer);
    }
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  return useCallback(() => {
    const left = window.scrollX;
    const top = window.scrollY;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    function restore(): void {
      window.scrollTo({ left, top, behavior: "instant" as ScrollBehavior });

      if (active?.isConnected && document.activeElement !== active) {
        active.focus({ preventScroll: true });
      }
    }

    clearTimers();
    router.refresh();

    // Next may scroll the window when the refreshed tree commits. Restoring on
    // the next few frames covers both the optimistic and the committed paint
    // without polling beyond the first half second.
    for (const delay of RESTORE_DELAYS) {
      timers.current.push(window.setTimeout(restore, delay));
    }
  }, [clearTimers, router]);
}
