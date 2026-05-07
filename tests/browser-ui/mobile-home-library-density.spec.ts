import { expect, test } from "@playwright/test";
import { ensureInstalledCookie } from "./helpers/public-form";

const mobileViewports = [
  { name: "390x844", viewport: { width: 390, height: 844 } },
  { name: "430x932", viewport: { width: 430, height: 932 } },
] as const;

for (const scenario of mobileViewports) {
  test.describe(`Mobile home and public route density ${scenario.name}`, () => {
    test.use({ viewport: scenario.viewport });
    test.beforeEach(async ({ page }) => {
      await ensureInstalledCookie(page);
    });

    test("home keeps composer and public route dock separated inside the first viewport", async ({ page }) => {
      await page.goto("/");

      await expect(page.locator('[data-homepage-chat-intro="true"]')).toBeVisible();
      await expect(page.locator('[data-chat-composer-form="true"]')).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
      await expect(page.locator('[data-chat-fab-launcher="true"]')).toHaveCount(0);

      const metrics = await page.evaluate(() => {
        const intro = document.querySelector('[data-homepage-chat-intro="true"]');
        const composer = document.querySelector('[data-chat-composer-form="true"]');
        const dock = document.querySelector('[data-public-mobile-route-dock="true"]');

        return {
          composerBottom: composer?.getBoundingClientRect().bottom ?? null,
          dockTop: dock?.getBoundingClientRect().top ?? null,
          introTop: intro?.getBoundingClientRect().top ?? null,
          scrollWidth: document.body.scrollWidth,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
        };
      });

      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 2);
      expect(metrics.introTop).not.toBeNull();
      expect(metrics.composerBottom).not.toBeNull();
      expect(metrics.dockTop).not.toBeNull();

      if (metrics.introTop == null || metrics.composerBottom == null || metrics.dockTop == null) {
        throw new Error("Home route density metrics were not available.");
      }

      expect(metrics.introTop).toBeGreaterThanOrEqual(0);
      expect(metrics.dockTop).toBeLessThanOrEqual(metrics.viewportHeight);
      expect(metrics.composerBottom).toBeLessThanOrEqual(metrics.dockTop - 8);
    });

    test("offers keeps the public route dock clear of the floating chat launcher", async ({ page }) => {
      await page.goto("/offers");

      await expect(page.getByRole("heading", { name: "Offers" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
      await expect(page.locator('[data-chat-fab-launcher="true"]')).toBeVisible();

      const mainClearance = await page.locator('[data-shell-main-surface="default"][data-shell-floating-chat-clearance="true"]').evaluate((node) => {
        return Number.parseFloat(getComputedStyle(node).paddingBottom);
      });

      expect(mainClearance).toBeGreaterThanOrEqual(128);

      await page.evaluate(() => {
        document.body.scrollTo({ top: document.body.scrollHeight, behavior: "instant" as ScrollBehavior });
      });

      const overlapMetrics = await page.evaluate(() => {
        const launcher = document.querySelector('[data-chat-fab-launcher="true"]');
        const dock = document.querySelector('[data-public-mobile-route-dock="true"]');

        return {
          bodyScrollTop: document.body.scrollTop,
          dockTop: dock?.getBoundingClientRect().top ?? null,
          launcherBottom: launcher?.getBoundingClientRect().bottom ?? null,
          scrollWidth: document.body.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });

      expect(overlapMetrics.scrollWidth).toBeLessThanOrEqual(overlapMetrics.viewportWidth + 2);
      expect(overlapMetrics.bodyScrollTop).toBeGreaterThan(0);
      expect(overlapMetrics.dockTop).not.toBeNull();
      expect(overlapMetrics.launcherBottom).not.toBeNull();

      if (overlapMetrics.dockTop == null || overlapMetrics.launcherBottom == null) {
        throw new Error("Public route overlap metrics were not available.");
      }

      expect(overlapMetrics.launcherBottom).toBeLessThanOrEqual(overlapMetrics.dockTop - 8);
    });
  });
}
