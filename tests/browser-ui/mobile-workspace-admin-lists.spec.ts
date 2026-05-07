import Database from "better-sqlite3";
import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

import { JobQueueDataMapper } from "../../src/adapters/JobQueueDataMapper";
import { backdateRegisterFormStart, finishRegisterNavigation } from "./helpers/public-form";

test.describe.configure({ timeout: 60_000 });

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

async function switchActualRole(page: Page, role: "ADMIN") {
  const response = await page.request.post(new URL("/api/auth/switch", page.url()).toString(), {
    data: { role },
  });
  expect(response.ok()).toBe(true);
}

function seedConversation(db: Database.Database, conversationId: string, userId: string, title: string) {
  db.prepare(
    `INSERT INTO conversations (id, user_id, title, status, session_source)
     VALUES (?, ?, ?, 'active', 'authenticated')`,
  ).run(conversationId, userId, title);
}

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

async function registerUser(
  page: Page,
  {
    emailPrefix,
    displayName,
    password,
    admin = false,
  }: {
    emailPrefix: string;
    displayName: string;
    password: string;
    admin?: boolean;
  },
): Promise<{ seedKey: string; userId: string; email: string }> {
  const seedKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${emailPrefix}-${seedKey}@example.com`;

  await backdateRegisterFormStart(page);
  await page.goto("/register");
  await page.getByLabel("Name").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();

  const userId = await waitForUserIdByEmail(email);
  await finishRegisterNavigation(page);

  if (admin) {
    await switchActualRole(page, "ADMIN");
  }

  return {
    seedKey,
    userId,
    email,
  };
}

function enableAffiliateProfile(userId: string, seedKey: string): string {
  const referralCode = `MENTOR${seedKey.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(-16)}`;
  const db = openBrowserDb();

  try {
    db.prepare(
      `UPDATE users
       SET affiliate_enabled = 1,
           referral_code = ?,
           credential = COALESCE(NULLIF(credential, ''), ?)
       WHERE id = ?`,
    ).run(referralCode, "AI strategist", userId);
    return referralCode;
  } finally {
    db.close();
  }
}

type SeededWorkspaceJobs = {
  runningJobId: string;
  completedJobId: string;
};

async function seedWorkspaceJobs(userId: string, seedKey: string): Promise<SeededWorkspaceJobs> {
  const db = openBrowserDb();
  const repo = new JobQueueDataMapper(db);
  const runningConversationId = `conv_mobile_workspace_running_${seedKey}`;
  const completedConversationId = `conv_mobile_workspace_complete_${seedKey}`;

  try {
    seedConversation(db, runningConversationId, userId, "Mobile workspace running");
    seedConversation(db, completedConversationId, userId, "Mobile workspace complete");

    const runningJob = await repo.createJob({
      conversationId: runningConversationId,
      userId,
      toolName: "produce_blog_article",
      requestPayload: {
        brief: `Mobile workspace ${seedKey}`,
        audience: "Operators",
      },
    });
    await repo.appendEvent({
      jobId: runningJob.id,
      conversationId: runningConversationId,
      eventType: "queued",
    });
    await repo.updateJobStatus(runningJob.id, {
      status: "running",
      startedAt: new Date().toISOString(),
      progressLabel: "Generating outline",
      progressPercent: 18,
    });

    const completedJob = await repo.createJob({
      conversationId: completedConversationId,
      userId,
      toolName: "publish_content",
      requestPayload: {
        post_id: `mobile-workspace-${seedKey}`,
      },
    });
    await repo.appendEvent({
      jobId: completedJob.id,
      conversationId: completedConversationId,
      eventType: "queued",
    });
    await repo.updateJobStatus(completedJob.id, {
      status: "succeeded",
      resultPayload: {
        slug: `mobile-workspace-${seedKey}`,
        status: "published",
      },
      completedAt: new Date().toISOString(),
    });

    return {
      runningJobId: runningJob.id,
      completedJobId: completedJob.id,
    };
  } finally {
    db.close();
  }
}

type SeededAdminJobs = {
  runningJobId: string;
  failedJobId: string;
};

async function seedAdminJobs(userId: string, seedKey: string): Promise<SeededAdminJobs> {
  const db = openBrowserDb();
  const repo = new JobQueueDataMapper(db);
  const now = new Date();
  const startedAt = new Date(now.getTime() - 45_000).toISOString();
  const completedAt = new Date(now.getTime() - 10_000).toISOString();

  const runningConversationId = `conv_mobile_admin_running_${seedKey}`;
  const failedConversationId = `conv_mobile_admin_failed_${seedKey}`;

  try {
    seedConversation(db, runningConversationId, userId, "Mobile admin running");
    seedConversation(db, failedConversationId, userId, "Mobile admin failed");

    const runningJob = await repo.createJob({
      conversationId: runningConversationId,
      userId,
      toolName: "produce_blog_article",
      requestPayload: {
        brief: `Mobile admin jobs ${seedKey}`,
        audience: "Operators",
      },
    });
    await repo.appendEvent({
      jobId: runningJob.id,
      conversationId: runningConversationId,
      eventType: "queued",
    });
    await repo.updateJobStatus(runningJob.id, {
      status: "running",
      startedAt,
      progressLabel: "Rendering brief",
      progressPercent: 43,
    });

    const failedJob = await repo.createJob({
      conversationId: failedConversationId,
      userId,
      toolName: "publish_content",
      requestPayload: {
        post_id: `mobile-admin-${seedKey}`,
      },
    });
    await repo.appendEvent({
      jobId: failedJob.id,
      conversationId: failedConversationId,
      eventType: "queued",
    });
    await repo.updateJobStatus(failedJob.id, {
      status: "failed",
      startedAt,
      completedAt,
      errorMessage: "Publish target missing",
    });

    return {
      runningJobId: runningJob.id,
      failedJobId: failedJob.id,
    };
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

async function expectTopWithinViewport(page: Page, selector: string) {
  const metrics = await measureElement(page, selector);

  expect(metrics).not.toBeNull();

  if (!metrics) {
    throw new Error(`Metrics were unavailable for ${selector}`);
  }

  expect(metrics.top).toBeGreaterThanOrEqual(0);
  expect(metrics.top).toBeLessThanOrEqual(metrics.viewportHeight - 24);
}

async function expectOverflowContainer(page: Page, selector: string) {
  const overflowX = await page.evaluate((currentSelector) => {
    const element = document.querySelector(currentSelector);

    if (!element) {
      return null;
    }

    return getComputedStyle(element).overflowX;
  }, selector);

  expect(overflowX).not.toBeNull();
  expect(["auto", "scroll"]).toContain(overflowX);
}

test.describe("Mobile workspace and admin list routes", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("workspace routes keep the first task surface inside the opening viewport", async ({ page }) => {
    await stubShellRequests(page);
    const user = await registerUser(page, {
      emailPrefix: "mobile-workspace",
      displayName: "Mobile Workspace User",
      password: "MobileWorkspacePass123",
    });

    enableAffiliateProfile(user.userId, user.seedKey);
    const seededJobs = await seedWorkspaceJobs(user.userId, user.seedKey);

    await page.goto("/jobs");

    await expect(page.locator('[data-jobs-summary-strip="true"]')).toBeVisible();
    await expect(page.locator('[data-jobs-summary-card]')).toHaveCount(3);
    await expect(page.locator(`[data-testid="job-card-${seededJobs.runningJobId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="job-card-${seededJobs.completedJobId}"]`)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTopWithinViewport(page, `[data-testid="job-card-${seededJobs.runningJobId}"]`);

    await page.goto("/profile");

    await expect(page.locator('[data-profile-page="true"]')).toBeVisible();
    await expect(page.locator('[data-profile-page="true"]')).toHaveAttribute("data-profile-mobile-state", "list");
    await expect(page.locator('[data-profile-account-nav="true"]')).toBeVisible();
    await page.getByRole("link", { name: /User info/i }).click();
    await expect(page.locator('[data-profile-page="true"]')).toHaveAttribute("data-profile-mobile-state", "detail");
    await expect(page.locator('[data-profile-primary-surface="true"]')).toBeVisible();
    await expect(page.locator('[data-profile-form="true"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to account sections" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTopWithinViewport(page, '[data-profile-primary-surface="true"]');
    await page.getByRole("link", { name: "Back to account sections" }).click();
    await expect(page.locator('[data-profile-page="true"]')).toHaveAttribute("data-profile-mobile-state", "list");
    await expect(page.locator('[data-profile-account-nav="true"]')).toBeVisible();

    await page.goto("/profile?section=password");

    await expect(page.locator('[data-profile-page="true"]')).toHaveAttribute("data-profile-mobile-state", "detail");
    await expect(page.locator('[data-profile-section="password"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to account sections" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("link", { name: "Back to account sections" }).click();
    await expect(page.locator('[data-profile-account-nav="true"]')).toBeVisible();

    await page.goto("/referrals");

    await expect(page.locator('[data-referrals-summary-strip="true"]')).toBeVisible();
    await expect(page.locator('[data-referrals-summary-card="true"]')).toHaveCount(5);
    await expect(page.locator('[data-referrals-primary-surface="share-tools"]')).toBeVisible();
    await expect(page.locator('.referrals-link-field')).toBeVisible();
    await expect(page.getByRole("button", { name: "Download QR" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTopWithinViewport(page, '[data-referrals-primary-surface="share-tools"]');
  });

  test("admin mobile routes keep list chrome compact and wide data overflow-safe", async ({ page }) => {
    await stubShellRequests(page);
    const admin = await registerUser(page, {
      emailPrefix: "mobile-admin",
      displayName: "Mobile Admin User",
      password: "MobileAdminPass123",
      admin: true,
    });

    enableAffiliateProfile(admin.userId, admin.seedKey);
    const seededJobs = await seedAdminJobs(admin.userId, admin.seedKey);

    await page.goto("/admin");

    await expect(page.locator('[data-admin-dashboard="true"]')).toBeVisible();
    await expect(page.locator('[data-admin-card="true"]').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTopWithinViewport(page, '[data-admin-card="true"]');

    await page.goto("/admin/leads?view=attention");

    await expect(page.locator('[data-admin-status-counts="true"]')).toHaveCount(1);
    await expect(page.locator('[data-admin-card="true"]').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTopWithinViewport(page, '[data-admin-card="true"]');

    await page.goto("/admin/jobs");

    await expect(page.locator('[data-admin-status-counts="true"]')).toHaveCount(1);
    await expect(page.locator('[data-admin-browse-filters="true"]')).toBeVisible();
    await expect(page.getByLabel("Status")).toHaveCount(0);
    await expect(page.locator(`[data-admin-record-card="true"] a[href="/admin/jobs/${seededJobs.runningJobId}"]`)).toBeVisible();
    await expect(page.locator(`[data-admin-record-card="true"] a[href="/admin/jobs/${seededJobs.failedJobId}"]`)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTopWithinViewport(page, '[data-admin-record-card="true"]');

    await page.locator('[data-admin-status-counts="true"]').getByRole("link", { name: /Failed/ }).click();

    await expect(page).toHaveURL(/\/admin\/jobs\?status=failed(?:&|$)/);
    await expect(page.getByLabel("Status")).toHaveCount(0);
    await expect(page.locator(`[data-admin-record-card="true"] a[href="/admin/jobs/${seededJobs.failedJobId}"]`)).toBeVisible();
    await expect(page.locator(`[data-admin-record-card="true"] a[href="/admin/jobs/${seededJobs.runningJobId}"]`)).toHaveCount(0);

    await page.goto("/admin/system");

    await expect(page.locator('.admin-mono-value').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTopWithinViewport(page, '[data-admin-card="true"]');

    await page.goto("/admin/affiliates?view=leaderboard");

    await expect(page.locator('.admin-pill-nav')).toBeVisible();
    await expect(page.getByRole("table", { name: "Affiliate leaderboard" })).toBeVisible();
    await expect(page.locator('[data-admin-scroll-shell="affiliate-leaderboard"]')).toBeVisible();
    await expectOverflowContainer(page, '[data-admin-scroll-shell="affiliate-leaderboard"]');
    await expectNoHorizontalOverflow(page);
    await expectTopWithinViewport(page, '[data-admin-scroll-shell="affiliate-leaderboard"]');
  });
});
