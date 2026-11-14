// @vitest-environment jsdom
//
// Regression test for ADR-066 on the public player search. The search input is
// a plain controlled input: typing must never replace it or blur it, even while
// the debounced availability request is pending.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlayerSearch } from "@/components/profile/player-search";

const TEXT = "abcdefghijklmnopqrstuvwxy";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ players: [] }),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("player search", () => {
  it("keeps the same input node and focus for a 25-character query", async () => {
    const user = userEvent.setup();
    render(<PlayerSearch />);

    const input = screen.getByLabelText("Search by gamer tag");
    await user.click(input);

    for (const character of TEXT) {
      await user.keyboard(character);

      expect(screen.getByLabelText("Search by gamer tag")).toBe(input);
      expect(document.activeElement).toBe(input);
    }

    expect(input).toHaveProperty("value", TEXT);
  });
});
