import Database from "better-sqlite3";
import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

import { JobQueueDataMapper } from "../../src/adapters/JobQueueDataMapper";
import { backdateRegisterFormStart, finishRegisterNavigation } from "./helpers/public-form";

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

async function switchActualRole(page: Page, role: "STAFF" | "ADMIN") {
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

async function registerAndSimulateAdmin(page: Page): Promise<{ seedKey: string; userId: string }> {
  const seedKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const uniqueEmail = `admin-jobs-${seedKey}@example.com`;

  await backdateRegisterFormStart(page);
  await page.goto("/register");
  await page.getByLabel("Name").fill("Admin Jobs User");
  await page.getByLabel("Email").fill(uniqueEmail);
  await page.getByLabel("Password").fill("AdminJobsPass123");
  await page.getByRole("button", { name: "Create Account" }).click();

  const userId = await waitForUserIdByEmail(uniqueEmail);
  await finishRegisterNavigation(page);

  await switchActualRole(page, "ADMIN");

  return {
    seedKey,
    userId,
  };
}

type SeededAdminJobs = {
  runningJobId: string;
  failedJobId: string;
  hiddenJobId: string;
};

async function seedAdminJobs(userId: string, seedKey: string): Promise<SeededAdminJobs> {
  const db = openBrowserDb();
  const repo = new JobQueueDataMapper(db);
  const now = new Date();
  const startedAt = new Date(now.getTime() - 45_000).toISOString();
  const completedAt = new Date(now.getTime() - 10_000).toISOString();

  const runningConversationId = `conv_admin_jobs_running_${seedKey}`;
  const failedConversationId = `conv_admin_jobs_failed_${seedKey}`;
  const hiddenConversationId = `conv_admin_jobs_hidden_${seedKey}`;

  try {
    seedConversation(db, runningConversationId, userId, "Admin jobs running");
    seedConversation(db, failedConversationId, userId, "Admin jobs failed");
    seedConversation(db, hiddenConversationId, userId, "Admin jobs hidden");

    const runningJob = await repo.createJob({
      conversationId: runningConversationId,
      userId,
      toolName: "produce_blog_article",
      requestPayload: {
        brief: `Admin jobs smoke ${seedKey}`,
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
    await repo.appendEvent({
      jobId: runningJob.id,
      conversationId: runningConversationId,
      eventType: "progress",
      payload: {
        progressLabel: "Rendering brief",
        progressPercent: 43,
      },
    });

    const failedJob = await repo.createJob({
      conversationId: failedConversationId,
      userId,
      toolName: "publish_content",
      requestPayload: {
        post_id: `admin-jobs-smoke-${seedKey}`,
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
    await repo.appendEvent({
      jobId: failedJob.id,
      conversationId: failedConversationId,
      eventType: "failed",
      payload: {
        error: "Publish target missing",
      },
    });

    const hiddenJob = await repo.createJob({
      conversationId: hiddenConversationId,
      userId,
      toolName: `unknown_admin_smoke_${seedKey}`,
      requestPayload: {
        task: "Hidden admin smoke row",
      },
    });
    await repo.appendEvent({
      jobId: hiddenJob.id,
      conversationId: hiddenConversationId,
      eventType: "queued",
    });

    return {
      runningJobId: runningJob.id,
      failedJobId: failedJob.id,
      hiddenJobId: hiddenJob.id,
    };
  } finally {
    db.close();
  }
}

test.describe("Admin jobs", () => {
  test("redirects anonymous visitors to login", async ({ page }) => {
    await page.goto("/admin/jobs");

    await expect(page).toHaveURL(/\/login$/);
  });

  test.describe("desktop", () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test("renders only registered capabilities and exposes status-driven detail actions", async ({ page }) => {
      await stubShellRequests(page);
      const { seedKey, userId } = await registerAndSimulateAdmin(page);
      const seededJobs = await seedAdminJobs(userId, seedKey);

      await page.goto("/admin/jobs");

      const desktopTable = page.locator('[data-admin-data-table="desktop"]');

      await expect(page.getByRole("heading", { name: "Jobs", exact: true })).toBeVisible();
      await expect(page.locator('[data-admin-browse-filters="true"]')).toBeVisible();
      await expect(desktopTable.locator(`a[href="/admin/jobs/${seededJobs.runningJobId}"]`)).toBeVisible();
      await expect(desktopTable.locator(`a[href="/admin/jobs/${seededJobs.failedJobId}"]`)).toBeVisible();
      await expect(desktopTable.locator(`a[href="/admin/jobs/${seededJobs.hiddenJobId}"]`)).toHaveCount(0);

      await page.locator('[data-admin-status-counts="true"]').getByRole("link", { name: /Failed/ }).click();

      await expect(page).toHaveURL(/\/admin\/jobs\?status=failed(&|$)/);
      await expect(desktopTable.locator(`a[href="/admin/jobs/${seededJobs.failedJobId}"]`)).toBeVisible();
      await expect(desktopTable.locator(`a[href="/admin/jobs/${seededJobs.runningJobId}"]`)).toHaveCount(0);

      await desktopTable.locator(`a[href="/admin/jobs/${seededJobs.failedJobId}"]`).click();

      await expect(page).toHaveURL(new RegExp(`/admin/jobs/${seededJobs.failedJobId}$`));
      await expect(page.getByRole("heading", { name: "Publish Content", exact: true })).toBeVisible();
      await expect(page.getByText("Publish target missing", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Retry job" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Cancel job" })).toHaveCount(0);

      await page.goto(`/admin/jobs/${seededJobs.runningJobId}`);

      await expect(page.getByRole("heading", { name: "Produce Blog Article", exact: true })).toBeVisible();
      await expect(page.getByText(/43%.*Rendering brief/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Cancel job" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Retry job" })).toHaveCount(0);
    });
  });

  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("renders the jobs list as a mobile card stack with bulk-selection affordances", async ({ page }) => {
      await stubShellRequests(page);
      const { seedKey, userId } = await registerAndSimulateAdmin(page);
      const seededJobs = await seedAdminJobs(userId, seedKey);

      await page.goto("/admin/jobs");

      const mobileTable = page.locator('[data-admin-data-table="mobile"]');

      await expect(page.getByRole("heading", { name: "Jobs", exact: true })).toBeVisible();
      await expect(mobileTable).toBeVisible();
      await expect(page.locator('[data-admin-data-table="desktop"]')).toBeHidden();
      await expect(mobileTable.locator(`a[href="/admin/jobs/${seededJobs.runningJobId}"]`)).toBeVisible();

      await mobileTable.getByLabel(`Select row ${seededJobs.runningJobId}`).check();

      await expect(page.locator('[data-admin-bulk-action-bar="true"]')).toBeVisible();
      await expect(page.getByText("1 selected")).toBeVisible();
      await expect(page.getByRole("button", { name: "Cancel selected" })).toBeVisible();
    });
  });
});
