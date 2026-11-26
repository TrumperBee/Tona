// @vitest-environment jsdom
//
// The deletion panel makes an irreversible request. It must not fire until the
// exact confirmation text is typed, and it must clear the Firebase client
// session after the server has cleared the http-only cookie.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/lib/auth/client", () => ({
  signOutCompletely: vi.fn(async () => {}),
}));

import { DeleteAccountPanel } from "@/components/profile/delete-account-panel";
import { signOutCompletely } from "@/lib/auth/client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, deleted: true }),
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(signOutCompletely).mockClear();
  router.push.mockClear();
  router.refresh.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DeleteAccountPanel", () => {
  it("requires the exact DELETE confirmation before calling the route", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountPanel gamerTag="Striker_9" />);

    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(screen.getByRole("dialog")).toBeDefined();

    const confirm = screen.getByRole("button", { name: "Permanently delete" });
    expect(confirm).toHaveProperty("disabled", true);

    const input = screen.getByLabelText(/Type DELETE to confirm/);
    fireEvent.change(input, { target: { value: "delete" } });
    expect(confirm).toHaveProperty("disabled", true);

    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(confirm).toHaveProperty("disabled", false);

    await user.click(confirm);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/profile/account", { method: "DELETE" });
      expect(signOutCompletely).toHaveBeenCalledOnce();
      expect(router.push).toHaveBeenCalledWith("/?account=deleted");
    });
  });

  it("shows the server error and a fresh-sign-in link without signing out", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: "For your security, sign in again before deleting your account.",
      }),
    });
    const user = userEvent.setup();
    render(<DeleteAccountPanel gamerTag="Striker_9" />);

    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/), {
      target: { value: "DELETE" },
    });
    await user.click(screen.getByRole("button", { name: "Permanently delete" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("sign in again");
    expect(screen.getByRole("link", { name: "Sign in again" }).getAttribute("href")).toBe(
      "/login?next=/dashboard/profile/edit",
    );
    expect(signOutCompletely).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
