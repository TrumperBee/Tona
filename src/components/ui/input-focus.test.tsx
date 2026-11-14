// @vitest-environment jsdom
//
// Regression tests for ADR-066: a controlled input must keep the same DOM node
// and keep focus while the user types. If a wrapper remounts its subtree on
// every render, React replaces the element and the cursor disappears after the
// first character.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";

const TEXT = "abcdefghijklmnopqrstuvwxy";

afterEach(() => {
  cleanup();
});

async function typeCharacterByCharacter(
  label: string,
): Promise<HTMLInputElement | HTMLTextAreaElement> {
  const user = userEvent.setup();
  const field = screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
  const node = field;

  await user.click(field);

  for (const character of TEXT) {
    await user.keyboard(character);

    expect(screen.getByLabelText(label)).toBe(node);
    expect(document.activeElement).toBe(node);
  }

  expect(node.value).toBe(TEXT);
  return node;
}

describe("shared text controls", () => {
  it("keeps the Input node and focus for a 25-character value", async () => {
    render(<Input aria-label="Gamer tag" defaultValue="" />);

    await typeCharacterByCharacter("Gamer tag");
  });

  it("keeps the Textarea node and focus for a 25-character value", async () => {
    render(<Textarea aria-label="Reason" defaultValue="" />);

    await typeCharacterByCharacter("Reason");
  });

  it("keeps the FormField input node and focus for a 25-character value", async () => {
    render(
      <FormField htmlFor="fullName" label="Full name" hint="Use your real name.">
        <Input defaultValue="" />
      </FormField>,
    );

    await typeCharacterByCharacter("Full name");
  });
});
