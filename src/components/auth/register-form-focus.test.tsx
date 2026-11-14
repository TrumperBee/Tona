// @vitest-environment jsdom
//
// Regression test for ADR-066 on the registration form: the form owns a lot of
// state (values, field errors, debounced gamer-tag availability). None of that
// may remount the inputs, so the same DOM node keeps focus for a long value.
//
// Labels are matched with a prefix regex because `FormField` appends an
// aria-hidden asterisk to required labels.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RegisterForm } from "@/components/auth/register-form";

const TEXT = "abcdefghijklmnopqrstuvwxy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/register",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ valid: true, available: true }),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function assertStableTyping(label: RegExp): Promise<HTMLInputElement> {
  const user = userEvent.setup();
  const input = screen.getByLabelText(label) as HTMLInputElement;
  await user.click(input);

  for (const character of TEXT) {
    await user.keyboard(character);

    expect(screen.getByLabelText(label)).toBe(input);
    expect(document.activeElement).toBe(input);
  }

  expect(input.value).toBe(TEXT);
  return input;
}

describe("registration form", () => {
  it("keeps the full-name input node and focus for 25 characters", async () => {
    render(<RegisterForm />);

    await assertStableTyping(/^Full name/);
  });

  it("keeps the email input node and focus for 25 characters", async () => {
    render(<RegisterForm />);

    await assertStableTyping(/^Email/);
  });

  it("keeps focus on the gamer tag field while its availability check runs", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const input = screen.getByLabelText(/^Gamer tag/) as HTMLInputElement;
    await user.click(input);

    // The field caps at 16 characters by design, so type that many and assert
    // the node survives the debounced availability state updates.
    const tag = "abcdefghijklmnop";

    for (const character of tag) {
      await user.keyboard(character);

      expect(screen.getByLabelText(/^Gamer tag/)).toBe(input);
      expect(document.activeElement).toBe(input);
    }

    expect(input.value).toBe(tag);
  });
});
