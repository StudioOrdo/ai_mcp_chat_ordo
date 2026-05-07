import { expect, test } from "@playwright/test";
import { ensureInstalledCookie } from "./helpers/public-form";

test.describe("Home shell header", () => {
  test.beforeEach(async ({ page }) => {
    await ensureInstalledCookie(page);
  });

  test("desktop home keeps only public navigation and auth links without workspace utilities", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Primary" });

    await expect(nav.getByRole("link", { name: /Studio Ordo home/i })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Open attention inbox" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Open workspace menu" })).toHaveCount(0);
    await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-workspace-menu="true"]')).toHaveCount(0);
    await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-brand-mark="true"]')).toHaveCount(1);
    await expect(nav.locator('[data-shell-nav-region="account-access"] [data-shell-workspace-menu="true"]')).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Open navigation menu" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Login" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Register" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Offers" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "About" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Feed" })).toHaveCount(0);
    await expect(page.getByLabel("Search pages, library notes, and workspace context")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open search" })).toHaveCount(0);
    await expect(page.getByText("May I help you?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Search my materials" })).toBeVisible();
    await expect(page.locator('[data-homepage-service-chip="true"]')).toHaveCount(3);
    await expect(page.getByRole("dialog", { name: "Workspace menu" })).toHaveCount(0);
  });

  test("desktop offers keeps visible public route links without shell search", async ({ page }) => {
    await page.goto("/offers");

    const nav = page.getByRole("navigation", { name: "Primary" });

    await expect(nav.getByRole("link", { name: /Studio Ordo home/i })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Open attention inbox" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Open workspace menu" })).toHaveCount(0);
    await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-workspace-menu="true"]')).toHaveCount(0);
    await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-brand-mark="true"]')).toHaveCount(1);
    await expect(nav.locator('[data-shell-nav-region="account-access"] [data-shell-workspace-menu="true"]')).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Open navigation menu" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Open account menu" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Login" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Register" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Offers" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "About" })).toBeVisible();
    await expect(page.getByLabel("Search pages, library notes, and workspace context")).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Workspace menu" })).toHaveCount(0);
  });

  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("mobile home avoids split nav surfaces and keeps public bottom navigation", async ({ page }) => {
      await page.goto("/");

      const nav = page.getByRole("navigation", { name: "Primary" });

      await expect(nav.getByRole("button", { name: "Open attention inbox" })).toHaveCount(0);
      await expect(nav.getByRole("button", { name: "Open workspace menu" })).toHaveCount(0);
      await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-workspace-menu="true"]')).toHaveCount(0);
      await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-brand-mark="true"]')).toHaveCount(1);
      await expect(nav.locator('[data-shell-nav-region="account-access"] [data-shell-workspace-menu="true"]')).toHaveCount(0);
      await expect(nav.getByRole("button", { name: "Open navigation menu" })).toHaveCount(0);
      await expect(nav.getByRole("button", { name: "Open account menu" })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: "Login" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Register" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Chat" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Offers" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "About" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Open search" })).toHaveCount(0);
      await expect(page.getByLabel("Search pages, library notes, and workspace context")).toHaveCount(0);
      await expect(page.getByRole("dialog", { name: "Workspace menu" })).toHaveCount(0);
    });

    test("mobile offers keeps public route links and public bottom dock", async ({ page }) => {
      await page.goto("/offers");

      const nav = page.getByRole("navigation", { name: "Primary" });

      await expect(nav.getByRole("button", { name: "Open attention inbox" })).toHaveCount(0);
      await expect(nav.getByRole("button", { name: "Open workspace menu" })).toHaveCount(0);
      await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-workspace-menu="true"]')).toHaveCount(0);
      await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-brand-mark="true"]')).toHaveCount(1);
      await expect(nav.locator('[data-shell-nav-region="account-access"] [data-shell-workspace-menu="true"]')).toHaveCount(0);
      await expect(nav.getByRole("button", { name: "Open navigation menu" })).toHaveCount(0);
      await expect(nav.getByRole("button", { name: "Open account menu" })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: "Login" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Register" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Offers" })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("button", { name: "Open search" })).toHaveCount(0);
      await expect(page.getByLabel("Search pages, library notes, and workspace context")).toHaveCount(0);
    });
  });
});
