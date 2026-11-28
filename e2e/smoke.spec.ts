import { expect, test, type Page } from "@playwright/test";
import { SEEDED, assertNoClientErrors, attachDiagnostics, login, logout } from "./helpers";

async function resetSeed(page: Page) {
  const res = await page.request.post("/api/test/seed");
  expect(res.ok(), `seed reset failed: ${res.status()}`).toBeTruthy();
}

test.describe("smoke", () => {
  test.beforeEach(async ({ page }) => {
    await resetSeed(page);
  });

  test("public pages load with no console/CSP/page errors", async ({ page }) => {
    const diag = attachDiagnostics(page);
    for (const path of [
      "/",
      "/tournaments",
      "/rankings",
      "/hall-of-fame",
      `/tournaments/${SEEDED.tournament.slug}`,
    ]) {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(resp?.status(), path).toBeLessThan(400);
      await expect(page.locator("body")).toBeVisible();
    }
    await assertNoClientErrors(diag);
  });

  test("register, login, logout flow", async ({ page }) => {
    const diag = attachDiagnostics(page);
    const stamp = Date.now().toString().slice(-8);
    const email = `e2e${stamp}@gcc-test.example`;
    const password = "Passw0rd!123";
    const tag = `E2E${stamp}`;

    await page.goto("/register");
    await page.getByLabel(/^Full name/i).fill("E2E Smoke Player");
    await page.getByLabel(/^Email/i).fill(email);
    await page.getByLabel(/^Confirm email/i).fill(email);
    await page.getByLabel(/^Password/i).fill(password);
    await page.getByLabel(/^Confirm password/i).fill(password);
    await page.getByLabel(/^Gamer tag/i).fill(tag);
    await page.getByLabel(/^Country/i).fill("Kenya");
    await page.keyboard.press("Enter").catch(() => {});
    await page
      .getByLabel(/^Preferred game/i)
      .selectOption("efootball")
      .catch(() => {});
    await page
      .getByLabel(/^Platform/i)
      .selectOption("playstation")
      .catch(() => {});
    await page.getByLabel(/accept the terms/i).check();
    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForURL((u) => !u.pathname.includes("/register"), { timeout: 45_000 });
    await expect(page).toHaveURL(/\/dashboard|\/tournaments|\/$/);

    await logout(page);
    await login(page, email, password);
    await expect(page).not.toHaveURL(/\/login/);
    await assertNoClientErrors(diag);
  });

  test("player can register for tournament and withdraw", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await login(page, SEEDED.player2.email, SEEDED.player2.password);
    await page.goto(`/tournaments/${SEEDED.registrationTournament.slug}`);
    await expect(page.getByRole("link", { name: /^register$/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await page
      .getByRole("link", { name: /^register$/i })
      .first()
      .click();
    await page.waitForURL(/\/register\/?$/, { timeout: 20_000 });
    const commitment = page.getByRole("checkbox", { name: /read the published rules/i });
    await expect(commitment).toBeVisible({ timeout: 20_000 });
    await commitment.check();
    await page.getByRole("button", { name: /confirm entry/i }).click();
    await expect(page.getByText(/you are in|you are registered/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.goto(`/tournaments/${SEEDED.registrationTournament.slug}`);
    await expect(page.getByText(/you are registered/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /withdraw entry/i }).click();
    await page.getByRole("button", { name: /^withdraw$/i }).click();
    await expect(
      page
        .getByRole("link", { name: /^register$/i })
        .or(page.getByRole("button", { name: /^register$/i }))
        .first(),
    ).toBeVisible({ timeout: 20_000 });
    await assertNoClientErrors(diag);
  });

  test("organiser result entry preserves focus/scroll and records result", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await login(page, SEEDED.organiser.email, SEEDED.organiser.password);
    await page.goto(`/organiser/tournaments/${SEEDED.tournament.id}/results`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText(/league results/i).first()).toBeVisible();
    const matchdayTab = page.getByRole("tab", { name: /matchday grid/i });
    await matchdayTab.scrollIntoViewIfNeeded();
    await matchdayTab.click({ force: true });
    const home = page.locator("#grid-m1-home");
    await expect(home).toBeVisible();
    await home.scrollIntoViewIfNeeded();
    await home.fill("2");
    await expect(home).toHaveValue("2");
    const away = page.locator("#grid-m1-away");
    await away.scrollIntoViewIfNeeded();
    await away.fill("1");
    await expect(away).toHaveValue("1");
    const beforeScroll = await page.evaluate(() => window.scrollY);
    await page.getByRole("button", { name: /save entered results/i }).click();
    await expect(
      page.getByText(/results recorded|Result recorded|recorded in one transaction/i).first(),
    ).toBeVisible({ timeout: 20_000 });
    const afterScroll = await page.evaluate(() => window.scrollY);
    expect(Math.abs(afterScroll - beforeScroll)).toBeLessThan(200);
    await assertNoClientErrors(diag);
  });

  test("maintenance mode shows maintenance notice and blocks non-super-admin writes", async ({
    browser,
  }) => {
    const playerCtx = await browser.newContext();
    const playerPage = await playerCtx.newPage();
    await login(playerPage, SEEDED.player2.email, SEEDED.player2.password);

    const superCtx = await browser.newContext();
    const superPage = await superCtx.newPage();
    await login(superPage, SEEDED.superAdmin.email, SEEDED.superAdmin.password);

    const toggleMaintenance = async (enabled: boolean) => {
      const res = await superPage.request.patch("/api/super-admin/settings", {
        headers: { Origin: "http://127.0.0.1:3100" },
        data: {
          maintenanceMode: enabled,
          maintenanceMessage: enabled ? "E2E maintenance window" : "",
          registrationsOpen: true,
          maxActiveTournamentsPerOrganiser: 3,
          applicationCooldownDays: 7,
          emailAnnouncements: false,
          reason: enabled ? "E2E maintenance verification" : "End E2E maintenance verification",
        },
      });
      expect(res.ok(), `maintenance toggle ${enabled} failed: ${res.status()}`).toBeTruthy();
    };

    try {
      await toggleMaintenance(true);
      const blocked = await playerPage.request.post(
        `/api/tournaments/${SEEDED.tournament.id}/register`,
        { headers: { Origin: "http://127.0.0.1:3100" } },
      );
      expect(
        blocked.status(),
        `non-super-admin write should be blocked in maintenance: ${blocked.status()} ${await blocked.text()}`,
      ).toBe(503);

      let maintenanceVisible = false;
      for (let i = 0; i < 15; i++) {
        await playerPage.goto(`/?maintenance-check=${i}`, { waitUntil: "domcontentloaded" });
        if (
          await playerPage
            .getByText(/e2e maintenance window|maintenance mode/i)
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          maintenanceVisible = true;
          break;
        }
        await playerPage.waitForTimeout(1000);
      }
      expect(maintenanceVisible, "maintenance notice should be visible").toBeTruthy();
    } finally {
      await toggleMaintenance(false).catch(() => {});
      await playerCtx.close();
      await superCtx.close();
    }
  });
  test("mobile profile link is reachable and protected routes redirect", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const diag = attachDiagnostics(page);
    await page.goto("/dashboard/profile");
    await page.waitForURL(/\/login/);
    await login(page, SEEDED.player.email, SEEDED.player.password);
    await page.goto("/dashboard");
    const profileLink = page.getByRole("link", { name: /profile/i }).first();
    await expect(profileLink).toBeVisible();
    await profileLink.click();
    await expect(page).toHaveURL(/\/dashboard\/profile/);
    await assertNoClientErrors(diag);
    await ctx.close();
  });
});
