import Database from "better-sqlite3";
import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

import { backdateRegisterFormStart, finishRegisterNavigation } from "./helpers/public-form";

test.describe.configure({ timeout: 45_000 });

async function stubShellRequests(page: Page) {
  await page.route("**/api/preferences", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ preferences: [] }),
    });
  });

  await page.route("**/api/conversations/active", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ conversationId: null }),
    });
  });
}

function resolveBrowserDbPath(): string {
  const configuredPath = process.env.STUDIO_ORDO_DB_PATH?.trim();
  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
  }

  return path.join(process.cwd(), ".data", "local.db");
}

function openBrowserDb(): Database.Database {
  const db = new Database(resolveBrowserDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  return db;
}

function lookupUserIdByEmail(email: string): string | null {
  const db = openBrowserDb();

  try {
    const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: string } | undefined;
    return row?.id ?? null;
  } finally {
    db.close();
  }
}

async function waitForUserIdByEmail(email: string): Promise<string> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const userId = lookupUserIdByEmail(email);
    if (userId) {
      return userId;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for registered user ${email}`);
}

function promoteUserToAdmin(userId: string) {
  const db = openBrowserDb();

  try {
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'role_admin')").run(userId);
  } finally {
    db.close();
  }
}

async function registerAndSimulateAdmin(page: Page) {
  const uniqueEmail = `admin-shell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await backdateRegisterFormStart(page);
  await page.goto("/register");
  await page.getByLabel("Name").fill("Admin Shell User");
  await page.getByLabel("Email").fill(uniqueEmail);
  await page.getByLabel("Password").fill("AdminShellPass123");
  await page.getByRole("button", { name: "Create Account" }).click();

  const userId = await waitForUserIdByEmail(uniqueEmail);
  await finishRegisterNavigation(page);
  promoteUserToAdmin(userId);
}

test.describe("Admin shell responsive", () => {
  test("desktop admin uses the signed-in workspace rail without a top-right drawer", async ({ page }) => {
    await stubShellRequests(page);
    await registerAndSimulateAdmin(page);

    await page.goto("/admin");

    const nav = page.getByRole("navigation", { name: "Primary" });
    const workspaceRail = page.getByRole("navigation", { name: "Workspace" });
    const adminGroup = workspaceRail.locator('[data-authenticated-work-rail-admin="true"]');

    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
    await expect(page.locator('aside[aria-label="Admin"]')).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Open navigation menu" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Open account menu" })).toHaveCount(0);
    await expect(page.locator('[data-shell-workspace-menu-trigger="true"]')).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Workspace menu" })).toHaveCount(0);

    await expect(workspaceRail.getByRole("link", { name: "Today" })).toBeVisible();
    await expect(workspaceRail.getByRole("link", { name: "Studio" })).toBeVisible();
    await expect(workspaceRail.getByRole("link", { name: "People" })).toBeVisible();
    await expect(workspaceRail.getByRole("link", { name: "Offers" })).toBeVisible();
    await expect(workspaceRail.getByRole("link", { name: "About" })).toBeVisible();
    await expect(workspaceRail.getByRole("link", { name: "Profile" })).toHaveCount(0);
    await expect(adminGroup.getByRole("link", { name: "Admin" })).toHaveAttribute("aria-current", "page");
    await expect(adminGroup.getByRole("link", { name: "Factory" })).toBeVisible();
    await expect(adminGroup.getByRole("link", { name: "System" })).toBeVisible();
  });

  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("mobile admin pages expose the compact workspace rail", async ({ page }) => {
      await stubShellRequests(page);
      await registerAndSimulateAdmin(page);

      await page.goto("/admin");

      await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
      await expect(page.locator('[data-admin-shell="true"]')).toBeVisible();
      await expect(page.locator('aside[aria-label="Admin"]')).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Open navigation menu" })).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Open account menu" })).toHaveCount(0);

      const workspaceRail = page.getByRole("navigation", { name: "Workspace" });
      await expect(page.locator('[data-shell-workspace-menu-trigger="true"]')).toHaveCount(0);
      await expect(page.getByRole("dialog", { name: "Workspace menu" })).toHaveCount(0);
      await expect(workspaceRail.getByRole("link", { name: "Today" })).toBeVisible();
      await expect(workspaceRail.getByRole("link", { name: "People" })).toBeVisible();
      await expect(workspaceRail.getByRole("link", { name: "Admin" })).toHaveAttribute("aria-current", "page");
      await expect(workspaceRail.getByRole("link", { name: "Factory" })).toBeVisible();
      await expect(workspaceRail.getByRole("link", { name: "System" })).toBeVisible();
    });

    test("mobile admin sub-workspaces keep the same compact governance rail", async ({ page }) => {
      await stubShellRequests(page);
      await registerAndSimulateAdmin(page);

      await page.goto("/admin/leads?view=attention");
      await expect(page.locator(".admin-workspace-nav")).toHaveCount(0);
      await expect(page.locator('[data-shell-workspace-menu-trigger="true"]')).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "Admin" })).toBeVisible();

      await page.goto("/admin/journal/attribution");
      await expect(page.locator(".admin-workspace-nav")).toHaveCount(0);
      await expect(page.locator('[data-shell-workspace-menu-trigger="true"]')).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "Admin" })).toBeVisible();
      await expect(page.getByRole("dialog", { name: "Workspace menu" })).toHaveCount(0);
    });
  });
});
