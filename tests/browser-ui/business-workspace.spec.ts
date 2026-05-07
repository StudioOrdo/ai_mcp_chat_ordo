import { expect, test } from "@playwright/test";

import { backdateRegisterFormStart, finishRegisterNavigation } from "./helpers/public-form";

test.describe("People workspace", () => {
  test.describe.configure({ timeout: 60_000 });

  test("renders the signed-in People object surface without RSC action-boundary errors", async ({ page }) => {
    await backdateRegisterFormStart(page);
    await page.goto("/register");

    const uniqueEmail = `business-workspace-${Date.now()}@example.com`;
    await page.getByLabel("Name").fill("People Workspace User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("PeoplePass123");
    await page.getByRole("button", { name: "Create Account" }).click();
    await finishRegisterNavigation(page, "/business");

    await page.goto("/business");

    await expect(page).toHaveURL(/\/business$/);
    await expect(page.getByLabel("People selection")).toBeVisible();
    await expect(page.getByPlaceholder("Search people...")).toBeVisible();
    await expect(page.getByText("No people match this view.")).toBeVisible();
    await expect(page.getByText("Something failed while loading this page")).toHaveCount(0);
    await expect(page.getByText("Event handlers cannot be passed to Client Component props")).toHaveCount(0);

    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.locator('[data-shell-nav-region="brand"] [data-shell-mobile-main-menu="true"]')).toHaveCount(1);
    await expect(nav.locator('[data-shell-nav-region="account-access"] [data-shell-mobile-main-menu="true"]')).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Open main menu" })).toBeHidden();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(nav.getByRole("button", { name: "Open main menu" })).toBeVisible();
    await page.getByRole("button", { name: "Open main menu" }).click();
    const mainMenu = page.getByRole("dialog", { name: "Main menu" });
    await expect(mainMenu.getByRole("link", { name: /Conversations/ })).toBeVisible();
    await expect(mainMenu.getByRole("link", { name: /Today/ })).toBeVisible();
    await expect(mainMenu.getByRole("link", { name: /Studio/ })).toBeVisible();
    await expect(mainMenu.getByRole("link", { name: /People/ })).toBeVisible();
    await expect(mainMenu.getByRole("link", { name: /Offers/ })).toBeVisible();
    await expect(mainMenu.getByRole("link", { name: /About/ })).toBeVisible();
    await expect(mainMenu.getByRole("link", { name: /Jobs/ })).toHaveCount(0);
    await mainMenu.getByRole("button", { name: "Close main menu" }).click();

    await page.getByRole("button", { name: /People Workspace User account menu/i }).click();
    await expect(page.getByRole("link", { name: "My Account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Account" })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Change Password" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Affiliate Dashboard" })).toHaveAttribute("href", "/referrals");
    await expect(page.getByRole("link", { name: ["My", "Referrals"].join(" ") })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Preferences" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Theme: / })).toBeVisible();
    await expect(page.getByRole("link", { name: ["My", "conversations"].join(" ") })).toHaveCount(0);
    await expect(page.getByRole("link", { name: ["My", "offers"].join(" ") })).toHaveCount(0);
    await expect(page.getByRole("link", { name: ["My", "media"].join(" ") })).toHaveCount(0);
    await expect(page.getByRole("link", { name: ["My", "content"].join(" ") })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "System" })).toHaveCount(0);

    await page.getByRole("link", { name: "My Account" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("link", { name: /User info/i })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: /Change password/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Preferences/i })).toBeVisible();
    await page.getByRole("link", { name: /User info/i }).click();
    await expect(page.getByRole("button", { name: "Save account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to account sections" })).toBeVisible();
    await expect(page.getByText("Profile, referral, and preference details live in one account area")).toHaveCount(0);

    await page.getByRole("link", { name: "Back to account sections" }).click();
    await page.getByRole("link", { name: /Change password/i }).click();
    await expect(page).toHaveURL(/\/profile\?section=password$/);
    await expect(page.getByRole("heading", { name: "Change password", level: 1 })).toBeVisible();

    await page.getByRole("link", { name: "Back to account sections" }).click();
    await page.getByRole("link", { name: /^Preferences/i }).click();
    await expect(page).toHaveURL(/\/profile\?section=preferences$/);
    await expect(page.getByRole("heading", { name: "User preferences" })).toBeVisible();
    await expect(page.getByText("In development")).toBeVisible();
  });
});
