// @vitest-environment jsdom
//
// Regression test for ADR-067. `router.refresh()` can reset the window scroll
// position. The refresh helper records the offset and the focused control first
// and restores both once the refreshed tree has painted.
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRefreshPreservingScroll } from "@/lib/hooks/use-refresh-preserving-scroll";

const routerRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh, push: vi.fn(), replace: vi.fn() }),
}));

beforeEach(() => {
  routerRefresh.mockClear();
  Object.defineProperty(window, "scrollY", { configurable: true, value: 720 });
  Object.defineProperty(window, "scrollX", { configurable: true, value: 0 });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useRefreshPreservingScroll", () => {
  it("refreshes the route and restores the scroll offset", () => {
    vi.useFakeTimers();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const { result } = renderHook(() => useRefreshPreservingScroll());

    act(() => {
      result.current();
      vi.runAllTimers();
    });

    expect(routerRefresh).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalled();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 720, behavior: "instant" });
  });

  it("returns focus to the control that was focused before the refresh", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();

    const { result } = renderHook(() => useRefreshPreservingScroll());

    act(() => {
      result.current();
      // Simulate the refreshed tree moving focus away from the control.
      button.blur();
      vi.runAllTimers();
    });

    expect(document.activeElement).toBe(button);
    button.remove();
  });
});
