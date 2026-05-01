import { expect, test } from "@playwright/test";

test.describe("Home shell header", () => {
  test("desktop home keeps the left workspace trigger and right-side utility cluster without legacy shell search", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Primary" });

    await expect(nav.getByRole("link", { name: /Studio Ordo home/i })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Open notifications" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Open workspace menu" })).toBeVisible();
    await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-workspace-menu="true"]')).toHaveCount(1);
    await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-brand-mark="true"]')).toHaveCount(0);
    await expect(nav.locator('[data-shell-nav-region="account-access"] [data-shell-workspace-menu="true"]')).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Open navigation menu" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Login" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Register" })).toBeVisible();
    await expect(page.getByLabel("Search pages, library notes, and workspace context")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open search" })).toHaveCount(0);
    await expect(page.getByText("May I help you?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Search my materials" })).toBeVisible();
    await expect(page.locator('[data-homepage-service-chip="true"]')).toHaveCount(3);

    await nav.getByRole("button", { name: "Open workspace menu" }).click();

    const dialog = page.getByRole("dialog", { name: "Workspace menu" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveClass(/left-0/);
    await expect(dialog).toHaveClass(/border-r/);
    await expect(dialog.getByRole("link", { name: "Library" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Journal" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Login" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Register" })).toBeVisible();
  });

  test("desktop library keeps the same left workspace trigger without shell search", async ({ page }) => {
    await page.goto("/library");

    const nav = page.getByRole("navigation", { name: "Primary" });

    await expect(nav.getByRole("link", { name: /Studio Ordo home/i })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Open notifications" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Open workspace menu" })).toBeVisible();
    await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-workspace-menu="true"]')).toHaveCount(1);
    await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-brand-mark="true"]')).toHaveCount(0);
    await expect(nav.locator('[data-shell-nav-region="account-access"] [data-shell-workspace-menu="true"]')).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Open navigation menu" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Open account menu" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Login" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Register" })).toBeVisible();
    await expect(page.getByLabel("Search pages, library notes, and workspace context")).toHaveCount(0);

    await nav.getByRole("button", { name: "Open workspace menu" }).click();

    const dialog = page.getByRole("dialog", { name: "Workspace menu" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveClass(/left-0/);
    await expect(dialog).toHaveClass(/border-r/);
    await expect(dialog.getByRole("link", { name: "Library" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Journal" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Login" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Register" })).toBeVisible();
  });

  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("mobile home avoids split nav surfaces and keeps one workspace trigger", async ({ page }) => {
      await page.goto("/");

      const nav = page.getByRole("navigation", { name: "Primary" });

      await expect(nav.getByRole("button", { name: "Open notifications" })).toHaveCount(0);
      await expect(nav.getByRole("button", { name: "Open workspace menu" })).toBeVisible();
      await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-workspace-menu="true"]')).toHaveCount(1);
      await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-brand-mark="true"]')).toHaveCount(0);
      await expect(nav.locator('[data-shell-nav-region="account-access"] [data-shell-workspace-menu="true"]')).toHaveCount(0);
      await expect(nav.getByRole("button", { name: "Open navigation menu" })).toHaveCount(0);
      await expect(nav.getByRole("button", { name: "Open account menu" })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: "Login" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Register" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Open search" })).toHaveCount(0);
      await expect(page.getByLabel("Search pages, library notes, and workspace context")).toHaveCount(0);

      await nav.getByRole("button", { name: "Open workspace menu" }).click();

      const dialog = page.getByRole("dialog", { name: "Workspace menu" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveClass(/left-0/);
      await expect(dialog).toHaveClass(/border-r/);
      await expect(dialog.getByRole("link", { name: "Library" })).toBeVisible();
      await expect(dialog.getByRole("link", { name: "Journal" })).toBeVisible();
      await expect(dialog.getByRole("link", { name: "Login" })).toBeVisible();
      await expect(dialog.getByRole("link", { name: "Register" })).toBeVisible();

      await dialog.getByRole("link", { name: "Library" }).click();

      await expect(page).toHaveURL(/\/library$/);
      await expect(page.getByRole("dialog", { name: "Workspace menu" })).toHaveCount(0);
    });

    test("mobile library keeps a single workspace trigger and no legacy drawer split", async ({ page }) => {
      await page.goto("/library");

      const nav = page.getByRole("navigation", { name: "Primary" });

      await expect(nav.getByRole("button", { name: "Open notifications" })).toHaveCount(0);
      await expect(nav.getByRole("button", { name: "Open workspace menu" })).toBeVisible();
      await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-workspace-menu="true"]')).toHaveCount(1);
      await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-brand-mark="true"]')).toHaveCount(0);
      await expect(nav.locator('[data-shell-nav-region="account-access"] [data-shell-workspace-menu="true"]')).toHaveCount(0);
      await expect(nav.getByRole("button", { name: "Open navigation menu" })).toHaveCount(0);
      await expect(nav.getByRole("button", { name: "Open account menu" })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: "Login" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Register" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Open search" })).toHaveCount(0);
      await expect(page.getByLabel("Search pages, library notes, and workspace context")).toHaveCount(0);
    });
  });
});
