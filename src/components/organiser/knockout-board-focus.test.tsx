// @vitest-environment jsdom
//
// Regression test for ADR-066. The generate dialog and its subcomponents are
// declared at module scope; if anyone moves them inside `KnockoutBoard`'s render
// body, every state change gives them a new identity and React remounts the
// subtree, so the leg selector loses focus after one interaction.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KnockoutBoard } from "@/components/organiser/knockout-board";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/organiser/tournaments/t1/knockout",
  useSearchParams: () => new URLSearchParams(),
}));

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
  it("keeps the legs selector mounted and focused across a state update", async () => {
    const user = userEvent.setup();

    render(
      <KnockoutBoard
        tournamentId="t1"
        tournamentStatus="league_phase"
        leagueMatchesCompleted={144}
        leagueMatchesTotal={144}
        generated={false}
        seed={null}
        legs={null}
        bracketHash={null}
        ties={[]}
        championTag={null}
        runnerUpTag={null}
        qualifiers={{ direct: 8, playoff: 16, eliminated: 12 }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Generate knockout stage" }));

    const select = (await screen.findByLabelText("Legs before the final")) as HTMLSelectElement;

    await user.click(select);
    await user.selectOptions(select, "1");

    // The change re-rendered the parent, which is exactly what used to remount
    // an inline dialog component and blur the selector.
    const after = screen.getByLabelText("Legs before the final") as HTMLSelectElement;

    expect(after).toBe(select);
    expect(document.activeElement).toBe(select);
    expect(after.value).toBe("1");
  });
});
