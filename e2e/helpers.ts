import { expect, type Page } from "@playwright/test";

export const SEEDED = {
  superAdmin: {
    email: "superadmin@gcc-test.example",
    password: "Passw0rd!123",
    uid: "e2e-super-admin",
  },
  organiser: {
    email: "organiser@gcc-test.example",
    password: "Passw0rd!123",
    uid: "e2e-organiser",
  },
  player: { email: "player@gcc-test.example", password: "Passw0rd!123", uid: "e2e-player" },
  player2: { email: "player2@gcc-test.example", password: "Passw0rd!123", uid: "e2e-player2" },
  tournament: { id: "qa-tournament", slug: "qa-tournament", name: "QA Tournament" },
  registrationTournament: {
    id: "qa-reg-tournament",
    slug: "qa-reg-tournament",
    name: "QA Registration Tournament",
  },
} as const;

export type Diagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  cspViolations: string[];
  badResponses: string[];
};

export function attachDiagnostics(page: Page): Diagnostics {
  const diag: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    cspViolations: [],
    badResponses: [],
  };
  page.on("pageerror", (err) => diag.pageErrors.push(String(err?.message ?? err)));
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") diag.consoleErrors.push(text);
    if (/content security policy|csp/i.test(text) && /violat|refused|blocked/i.test(text)) {
      diag.cspViolations.push(text);
    }
  });
  page.on("requestfailed", (req) => {
    const failure = req.failure()?.errorText ?? "failed";
    if (/ERR_ABORTED/i.test(failure)) return;
    diag.badResponses.push(`${failure} ${req.url()}`);
  });
  page.on("response", (res) => {
    if (res.url().includes("/api/csp-report"))
      diag.cspViolations.push(`csp-report ${res.status()} ${res.url()}`);
  });
  return diag;
}

export function benignConsoleError(text: string): boolean {
  return /favicon|Download the React DevTools|DevTools|webpack-hmr|hot-reload|Failed to load resource.*favicon|ERR_ABORTED|upgrade-insecure-requests.*ignored when delivered in a report-only policy/i.test(
    text,
  );
}

export async function assertNoClientErrors(diag: Diagnostics) {
  const badConsole = diag.consoleErrors.filter((e) => !benignConsoleError(e));
  expect(badConsole, `Console errors:\n${badConsole.join("\n")}`).toEqual([]);
  expect(diag.pageErrors, `Page errors:\n${diag.pageErrors.join("\n")}`).toEqual([]);
  expect(diag.cspViolations, `CSP violations:\n${diag.cspViolations.join("\n")}`).toEqual([]);
}

export async function login(page: Page, email: string, password: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel(/^Email/i).fill(email);
    await page.getByLabel(/^Password/i).fill(password);
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    try {
      await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30_000 });
      return;
    } catch (err) {
      const incorrect = await page
        .getByText(/email or password is incorrect/i)
        .first()
        .isVisible()
        .catch(() => false);
      if (attempt === 0 && incorrect) {
        await page.waitForTimeout(1500);
        continue;
      }
      throw err;
    }
  }
}

export async function logout(page: Page) {
  // Open menu sheet via avatar button if present, else try visible sign out.
  const menuButton = page.getByRole("button", { name: /open menu|account menu|menu/i }).first();
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.click().catch(() => {});
  } else {
    // try avatar button in mobile chrome
    const avatarBtn = page.locator('button[aria-haspopup="dialog"], button:has(img[alt])').first();
    if (await avatarBtn.isVisible().catch(() => false)) await avatarBtn.click().catch(() => {});
  }
  const signOut = page.getByRole("button", { name: /sign out/i }).first();
  if (await signOut.isVisible().catch(() => false)) {
    await signOut.click();
    await page
      .waitForURL((u) => u.pathname === "/" || u.pathname.includes("/login"), { timeout: 20_000 })
      .catch(() => {});
    return;
  }
  // fallback: clear session via request
  await page
    .context()
    .request.delete("/api/auth/session")
    .catch(() => {});
  await page.goto("/");
}
