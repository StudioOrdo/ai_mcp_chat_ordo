import Database from "better-sqlite3";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { ensureInstalledCookie } from "./helpers/public-form";

const mobileViewports = [
  { name: "360x800", viewport: { width: 360, height: 800 } },
  { name: "390x844", viewport: { width: 390, height: 844 } },
  { name: "430x932", viewport: { width: 430, height: 932 } },
] as const;

function getActiveReferralCode(): string {
  const dbPath = path.resolve(
    process.cwd(),
    process.env.STUDIO_ORDO_DB_PATH ?? path.join(process.env.DATA_DIR ?? ".data", "local.db"),
  );
  const db = new Database(dbPath, { readonly: true });

  try {
    const row = db.prepare(`
      SELECT referral_code
      FROM users
      WHERE affiliate_enabled = 1
        AND referral_code IS NOT NULL
      ORDER BY id
      LIMIT 1
    `).get() as { referral_code: string } | undefined;

    if (!row) {
      throw new Error("No active referral code is available in the local database.");
    }

    return row.referral_code;
  } finally {
    db.close();
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    documentWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
    viewportWidth: window.innerWidth,
  }));

  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 2);
}

async function measureElement(page: Page, selector: string) {
  return page.evaluate((currentSelector) => {
    const element = document.querySelector(currentSelector);

    if (!element) {
      return null;
    }

    const rect = element.getBoundingClientRect();

    return {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      viewportHeight: window.innerHeight,
    };
  }, selector);
}

async function expectTitleAndPrimaryActionAboveFold(page: Page) {
  const titleMetrics = await measureElement(page, '[data-public-entry-title="true"]');
  const actionMetrics = await measureElement(page, '[data-public-entry-primary-action="true"]');

  expect(titleMetrics).not.toBeNull();
  expect(actionMetrics).not.toBeNull();

  if (!titleMetrics || !actionMetrics) {
    throw new Error("Public entry title or primary action metrics were unavailable.");
  }

  expect(titleMetrics.top).toBeGreaterThanOrEqual(0);
  expect(actionMetrics.bottom).toBeLessThanOrEqual(actionMetrics.viewportHeight + 8);
}

async function expectLauncherClearOf(page: Page, selector: string) {
  const launcher = page.locator('[data-chat-fab-launcher="true"]');

  if (await launcher.count() === 0) {
    return;
  }

  const metrics = await page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    const launcherElement = document.querySelector('[data-chat-fab-launcher="true"]');

    if (!target || !launcherElement) {
      return null;
    }

    return {
      targetBottom: target.getBoundingClientRect().bottom,
      launcherTop: launcherElement.getBoundingClientRect().top,
    };
  }, selector);

  expect(metrics).not.toBeNull();

  if (!metrics) {
    throw new Error("Floating chat clearance metrics were unavailable.");
  }

  expect(metrics.targetBottom).toBeLessThanOrEqual(metrics.launcherTop - 8);
}

async function expectLauncherAbovePublicDock(page: Page) {
  const launcher = page.locator('[data-chat-fab-launcher="true"]');

  if (await launcher.count() === 0) {
    return;
  }

  const metrics = await page.evaluate(() => {
    const dock = document.querySelector('[data-public-mobile-route-dock="true"]');
    const launcherElement = document.querySelector('[data-chat-fab-launcher="true"]');

    if (!dock || !launcherElement) {
      return null;
    }

    return {
      dockTop: dock.getBoundingClientRect().top,
      launcherBottom: launcherElement.getBoundingClientRect().bottom,
    };
  });

  expect(metrics).not.toBeNull();

  if (!metrics) {
    throw new Error("Public dock and floating chat metrics were unavailable.");
  }

  expect(metrics.launcherBottom).toBeLessThanOrEqual(metrics.dockTop - 8);
}

for (const scenario of mobileViewports) {
  test.describe(`Mobile public entry and reading surfaces ${scenario.name}`, () => {
    test.use({ viewport: scenario.viewport });
    test.beforeEach(async ({ page }) => {
      await ensureInstalledCookie(page);
    });

    test("login and register keep the primary action inside the first viewport", async ({ page }) => {
      for (const route of ["/login", "/register"]) {
        await page.goto(route);

        await expect(page.locator('[data-public-entry-title="true"]')).toBeVisible();
        await expect(page.locator('[data-public-entry-primary-action="true"]')).toBeVisible();

        await expectNoHorizontalOverflow(page);
        await expectTitleAndPrimaryActionAboveFold(page);
        await expectLauncherClearOf(page, '[data-public-entry-primary-action="true"]');
      }
    });

    test("status and invalid referral routes keep recovery actions above the fold", async ({ page }) => {
      for (const route of ["/access-denied", "/r/missing-referral-code"]) {
        await page.goto(route);

        await expect(page.locator('[data-public-status-page="true"]')).toBeVisible();
        await expect(page.locator('[data-public-entry-title="true"]')).toBeVisible();
        await expect(page.locator('[data-public-entry-primary-action="true"]')).toBeVisible();

        await expectNoHorizontalOverflow(page);
        await expectTitleAndPrimaryActionAboveFold(page);
        await expectLauncherClearOf(page, '[data-public-entry-primary-action="true"]');
      }
    });

    test("active referral landing keeps the invitation and CTA above the fold", async ({ page }) => {
      const activeReferralCode = getActiveReferralCode();

      await page.goto(`/r/${activeReferralCode}`);

      await expect(page.locator('[data-referral-landing="true"]')).toBeVisible();
      await expect(page.locator('[data-referral-summary="true"]')).toBeVisible();

      await expectNoHorizontalOverflow(page);
      await expectTitleAndPrimaryActionAboveFold(page);
      await expectLauncherClearOf(page, '[data-public-entry-primary-action="true"]');
    });

    test("feed, offers, and about keep public route chrome and floating chat separated", async ({ page }) => {
      const routes = [
        { href: "/feed", heading: "Public feed", activeDockLabel: null },
        { href: "/offers", heading: "Offers", activeDockLabel: "Offers" },
        { href: "/about", heading: "Run your business like you have a team.", activeDockLabel: "About" },
      ] as const;

      for (const route of routes) {
        await page.goto(route.href);

        const publicDock = page.getByRole("navigation", { name: "Public navigation" });

        await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
        await expect(publicDock).toBeVisible();
        await expect(publicDock.getByRole("link", { name: "Chat" })).toHaveAttribute("href", "/");
        await expect(publicDock.getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
        await expect(publicDock.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
        await expect(publicDock.getByRole("link", { name: "Feed" })).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
        await expectLauncherAbovePublicDock(page);

        if (route.activeDockLabel) {
          await expect(publicDock.getByRole("link", { name: route.activeDockLabel })).toHaveAttribute("aria-current", "page");
        }
      }
    });
  });
}
