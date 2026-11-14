// @vitest-environment jsdom
//
// Regression test for ADR-066. `RoundCard`, `TieCard` and `LegRow` used to be
// declared inside `KnockoutBoard`'s render body, so every state change gave them
// a new component identity and React remounted their subtree. The leg selector
// lost focus after one interaction. They now live at module scope, and this test
// fails if anyone moves them back.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KnockoutBoard, type KnockoutBoardRound } from "@/components/organiser/knockout-board";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/organiser/tournaments/t1/knockout",
  useSearchParams: () => new URLSearchParams(),
}));

const ROUND: KnockoutBoardRound = {
  round: "playoff",
  label: "Play-offs",
  legs: 2,
  published: false,
  complete: false,
  draft: null,
  ties: [],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("knockout board", () => {
  it("keeps the leg selector mounted and focused across a state update", async () => {
    const user = userEvent.setup();
    render(
      <KnockoutBoard
        tournamentId="t1"
        tournamentStatus="league_phase"
        leagueMatchesCompleted={144}
        leagueMatchesTotal={144}
        leagueClosed
        rounds={[ROUND]}
        championTag={null}
        runnerUpTag={null}
      />,
    );

    const select = screen.getByLabelText("Play-offs leg count") as HTMLSelectElement;
    await user.click(select);
    await user.selectOptions(select, "1");

    // The change re-rendered the parent, which is exactly what used to remount
    // the inline `RoundCard` and blur the selector.
    const after = screen.getByLabelText("Play-offs leg count") as HTMLSelectElement;

    expect(after).toBe(select);
    expect(document.activeElement).toBe(select);
    expect(after.value).toBe("1");
  });
});
