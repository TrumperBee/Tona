// @vitest-environment jsdom
//
// The viewer's timezone is only knowable in the browser. The first paint must
// stay deterministic or React reports a hydration text mismatch.
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TournamentDates } from "@/components/tournament/tournament-dates";

const props = {
  opensAt: "2026-11-01T09:00:00.000Z",
  closesAt: "2026-11-20T17:00:00.000Z",
  startsAt: "2026-12-01T15:00:00.000Z",
  timezone: "Africa/Nairobi",
};

let resolvedOptionsSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  const original = Intl.DateTimeFormat.prototype.resolvedOptions;

  resolvedOptionsSpy = vi
    .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...original.call(this), timeZone: "Africa/Nairobi" };
    });
});

afterEach(() => {
  cleanup();
  resolvedOptionsSpy.mockRestore();
});

describe("TournamentDates", () => {
  it("renders a stable local-time label on the server", () => {
    const html = renderToString(<TournamentDates {...props} />);

    expect(html).toContain("Your local time");
    expect(html).not.toContain("Your local time (");
  });

  it("adds the device timezone only after hydration", () => {
    render(<TournamentDates {...props} />);

    expect(screen.getByRole("button", { name: "Your local time (Africa/Nairobi)" })).toBeTruthy();
  });
});
