import Database from "better-sqlite3";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { JobQueueDataMapper } from "../../src/adapters/JobQueueDataMapper";
import { backdateRegisterFormStart, finishRegisterNavigation } from "./helpers/public-form";

test.describe.configure({ timeout: 60_000 });

const PLAYWRIGHT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:34123";

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

function seedConversation(db: Database.Database, conversationId: string, userId: string, title: string) {
  db.prepare(
    `INSERT INTO conversations (id, user_id, title, status, session_source)
     VALUES (?, ?, ?, 'active', 'authenticated')`,
  ).run(conversationId, userId, title);
}

function seedAnonymousConversation(db: Database.Database, conversationId: string, anonUserId: string, title: string) {
  db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)`)
    .run(anonUserId, `${anonUserId}@anonymous.local`, "Anonymous");
  db.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'role_anonymous')`)
    .run(anonUserId);
  db.prepare(
    `INSERT INTO conversations (id, user_id, title, status, session_source)
     VALUES (?, ?, ?, 'active', 'anonymous_cookie')`,
  ).run(conversationId, anonUserId, title);
}

type SeededJobs = {
  runningConversationId: string;
  runningJobId: string;
  completedConversationId: string;
  completedJobId: string;
};

async function seedUserJobs(userId: string, seedKey: string): Promise<SeededJobs> {
  const db = openBrowserDb();
  const repo = new JobQueueDataMapper(db);
  const runningConversationId = `conv_jobs_running_${seedKey}`;
  const completedConversationId = `conv_jobs_done_${seedKey}`;

  try {
    seedConversation(db, runningConversationId, userId, "Jobs running");
    seedConversation(db, completedConversationId, userId, "Jobs complete");

    const runningJob = await repo.createJob({
      conversationId: runningConversationId,
      userId,
      toolName: "produce_blog_article",
      requestPayload: {
        brief: "AI Governance Playbook",
        audience: "Operations leaders",
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
    await repo.appendEvent({
      jobId: runningJob.id,
      conversationId: runningConversationId,
      eventType: "progress",
      payload: {
        progressLabel: "Generating outline",
        progressPercent: 18,
      },
    });

    const completedJob = await repo.createJob({
      conversationId: completedConversationId,
      userId,
      toolName: "publish_content",
      requestPayload: {
        post_id: "post_1",
      },
    });

    await repo.appendEvent({
      jobId: completedJob.id,
      conversationId: completedConversationId,
      eventType: "queued",
    });

    const resultPayload = {
      slug: "deferred-queue-post",
      title: "Deferred Queue Post",
      status: "published",
    };

    await repo.updateJobStatus(completedJob.id, {
      status: "succeeded",
      resultPayload,
      completedAt: new Date().toISOString(),
    });
    await repo.appendEvent({
      jobId: completedJob.id,
      conversationId: completedConversationId,
      eventType: "result",
      payload: {
        result: resultPayload,
      },
    });

    return {
      runningConversationId,
      runningJobId: runningJob.id,
      completedConversationId,
      completedJobId: completedJob.id,
    };
  } finally {
    db.close();
  }
}

async function seedAnonymousMigratingJob(sessionId: string, seedKey: string): Promise<{
  conversationId: string;
  jobId: string;
}> {
  const db = openBrowserDb();
  const repo = new JobQueueDataMapper(db);
  const anonUserId = `anon_${sessionId}`;
  const conversationId = `conv_jobs_migrate_${seedKey}`;

  try {
    seedAnonymousConversation(db, conversationId, anonUserId, "Anonymous jobs");

    const runningJob = await repo.createJob({
      conversationId,
      userId: anonUserId,
      toolName: "produce_blog_article",
      initiatorType: "anonymous_session",
      requestPayload: {
        brief: "Inherited migration brief",
        audience: "Queue recovery operators",
      },
    });

    await repo.appendEvent({
      jobId: runningJob.id,
      conversationId,
      eventType: "queued",
    });
    await repo.updateJobStatus(runningJob.id, {
      status: "running",
      startedAt: new Date().toISOString(),
      progressLabel: "Awaiting sign-in recovery",
      progressPercent: 12,
    });
    await repo.appendEvent({
      jobId: runningJob.id,
      conversationId,
      eventType: "progress",
      payload: {
        progressLabel: "Awaiting sign-in recovery",
        progressPercent: 12,
      },
    });

    return {
      conversationId,
      jobId: runningJob.id,
    };
  } finally {
    db.close();
  }
}

test.describe("Jobs page", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("renders active and recent jobs from the signed-in jobs feed", async ({ page }) => {
    await page.addInitScript(() => {
      class MockEventSource {
        static instances: MockEventSource[] = [];

        url: string;
        onopen: (() => void) | null = null;
        onmessage: ((event: { data: string }) => void) | null = null;
        onerror: (() => void) | null = null;
        readyState = 1;

        constructor(url: string | URL) {
          this.url = String(url);
          MockEventSource.instances.push(this);
          queueMicrotask(() => this.onopen?.());
        }

        close() {
          this.readyState = 2;
        }

        dispatch(payload: unknown) {
          this.onmessage?.({ data: JSON.stringify(payload) });
        }
      }

      Object.defineProperty(window, "EventSource", {
        configurable: true,
        writable: true,
        value: MockEventSource,
      });

      Object.defineProperty(window, "__dispatchJobsEvent", {
        configurable: true,
        writable: true,
        value: (payload: unknown) => {
          for (const instance of MockEventSource.instances) {
            if (instance.url.includes("/api/jobs/events")) {
              instance.dispatch(payload);
            }
          }
        },
      });
    });

    await page.route("**/api/preferences", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            preferences: [{ key: "push_notifications", value: "disabled" }],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ preferences: [] }),
      });
    });

    await backdateRegisterFormStart(page);
    await page.goto("/register");

    const seedKey = Date.now().toString(36);
    const uniqueEmail = `jobs-page-${Date.now()}@example.com`;
    await page.getByLabel("Name").fill("Jobs Page User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("JobsPass123");
    await page.getByRole("button", { name: "Create Account" }).click();

    const userId = await waitForUserIdByEmail(uniqueEmail);
    await finishRegisterNavigation(page);
    const seededJobs = await seedUserJobs(userId, seedKey);

    await page.goto("/jobs");

    const activeJobCard = page.getByTestId(`job-card-${seededJobs.runningJobId}`);
    const recentJobCard = page.getByTestId(`job-card-${seededJobs.completedJobId}`);

    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByRole("heading", { name: "Work Index", exact: true })).toBeVisible();
    await expect(page.getByText("Live updates connected.")).toBeVisible();
    await expect(activeJobCard).toBeVisible();
    await expect(recentJobCard).toBeVisible();
    await expect(activeJobCard).toContainText("AI Governance Playbook");
    await expect(recentJobCard).toContainText("Publish journal draft post_1");
    await expect(activeJobCard).toContainText("Generating outline");
    await expect(activeJobCard).toContainText("18%");
    await expect(page.getByText("Sequence 2")).toBeVisible();
    await expect(page.getByTestId("job-detail-panel").getByRole("link", { name: "Open conversation" })).toHaveAttribute(
      "href",
      `/?conversationId=${seededJobs.runningConversationId}`,
    );

    await page.evaluate((payload) => {
      const dispatcher = (
        window as typeof window & { __dispatchJobsEvent?: (eventPayload: unknown) => void }
      ).__dispatchJobsEvent;
      dispatcher?.(payload);
    }, {
      type: "job_progress",
      jobId: seededJobs.runningJobId,
      conversationId: seededJobs.runningConversationId,
      sequence: 8,
      toolName: "produce_blog_article",
      label: "Produce Blog Article",
      title: "AI Governance Playbook",
      subtitle: "Audience: Operations leaders",
      progressLabel: "Reviewing article",
      progressPercent: 42,
      updatedAt: "2026-03-25T03:00:07.000Z",
    });

    await expect(activeJobCard).toContainText("Reviewing article", { timeout: 5000 });
    await expect(activeJobCard).toContainText("42%", { timeout: 5000 });
    await expect(page.getByText("Sequence 8")).toBeVisible();

    await recentJobCard.getByRole("button", { name: "Open details for Publish journal draft post_1" }).click();
    await expect(page).toHaveURL(new RegExp(`/jobs\\?jobId=${seededJobs.completedJobId}$`));
    await expect(page.getByRole("link", { name: "Open artifact" })).toHaveAttribute(
      "href",
      "/journal/deferred-queue-post",
    );
    await expect(page.getByRole("button", { name: "Copy summary for Publish journal draft post_1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export log for Publish journal draft post_1" })).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(new RegExp(`/jobs\\?jobId=${seededJobs.completedJobId}$`));
    await expect(page.getByRole("heading", { name: "Work Index", exact: true })).toBeVisible();
    await expect(activeJobCard).toBeVisible();
    await expect(page.getByRole("link", { name: "Open artifact" })).toBeVisible();
    await expect(page.getByTestId("job-detail-panel").getByRole("link", { name: "Open conversation" })).toHaveAttribute(
      "href",
      `/?conversationId=${seededJobs.completedConversationId}`,
    );
  });

  test("shows anonymous-session jobs in /jobs after registration migrates ownership", async ({ page }) => {
    await page.addInitScript(() => {
      class MockEventSource {
        static instances: MockEventSource[] = [];

        url: string;
        onopen: (() => void) | null = null;
        onmessage: ((event: { data: string }) => void) | null = null;
        onerror: (() => void) | null = null;
        readyState = 1;

        constructor(url: string | URL) {
          this.url = String(url);
          MockEventSource.instances.push(this);
          queueMicrotask(() => this.onopen?.());
        }

        close() {
          this.readyState = 2;
        }
      }

      Object.defineProperty(window, "EventSource", {
        configurable: true,
        writable: true,
        value: MockEventSource,
      });
    });

    await page.route("**/api/preferences", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            preferences: [{ key: "push_notifications", value: "disabled" }],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ preferences: [] }),
      });
    });

    const seedKey = Date.now().toString(36);
    const anonSessionId = `anon_jobs_${seedKey}`;
    const migratedJob = await seedAnonymousMigratingJob(anonSessionId, seedKey);

    await page.context().addCookies([{
      name: "lms_anon_session",
      value: anonSessionId,
      url: PLAYWRIGHT_BASE_URL,
    }]);

    await backdateRegisterFormStart(page);
    await page.goto("/register");

    const uniqueEmail = `jobs-migrate-${Date.now()}@example.com`;
    await page.getByLabel("Name").fill("Migrated Jobs User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("JobsPass123");
    await page.getByRole("button", { name: "Create Account" }).click();
    await finishRegisterNavigation(page);

    await page.goto("/jobs");

    const migratedJobCard = page.getByTestId(`job-card-${migratedJob.jobId}`);

    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByRole("heading", { name: "Work Index", exact: true })).toBeVisible();
    await expect(page.getByText("Live updates connected.")).toBeVisible();
    await expect(migratedJobCard).toBeVisible();
    await expect(migratedJobCard).toContainText("Inherited migration brief");
    await expect(migratedJobCard).toContainText("Awaiting sign-in recovery");
    await expect(migratedJobCard).toContainText("12%");
    await expect(page.getByTestId("job-detail-panel").getByRole("link", { name: "Open conversation" })).toHaveAttribute(
      "href",
      `/?conversationId=${migratedJob.conversationId}`,
    );

    await page.reload();

    await expect(migratedJobCard).toBeVisible();
    await expect(migratedJobCard).toContainText("Inherited migration brief");
  });
});
