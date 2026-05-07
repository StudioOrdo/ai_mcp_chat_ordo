import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page, type Route } from "@playwright/test";

import { backdateRegisterFormStart, finishRegisterNavigation } from "./helpers/public-form";

test.describe.configure({ timeout: 60_000 });

const PNG_UPLOAD_FIXTURE_PATH = path.join(process.cwd(), "public", "ordo-avatar.png");
const PLAYWRIGHT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:34123";

interface OperationsMediaSeedSpec {
  fileName: string;
  conversationId?: string | null;
  fileType?: "image" | "document";
  mimeType?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
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

function resolveBrowserMediaDataDir(): string {
  const configuredDir = process.env.DATA_DIR?.trim();
  if (configuredDir) {
    return path.isAbsolute(configuredDir)
      ? configuredDir
      : path.resolve(process.cwd(), configuredDir);
  }

  return path.join(process.cwd(), ".playwright-data");
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

async function registerFreshUser(page: Page) {
  const email = `ops-media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await backdateRegisterFormStart(page);
  await page.goto("/register");
  await page.getByLabel("Name").fill("Operations Media User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("OperationsMedia!Pass123");
  await page.getByRole("button", { name: "Create Account" }).click();
  await finishRegisterNavigation(page);

  return { email };
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

function seedOperationsMediaFixture(userId: string) {
  const conversationId = `conv_ops_media_${Date.now()}`;
  const fileName = `ops-media-${Date.now()}.png`;
  const [fixture] = seedOperationsMediaFixtures(userId, [{ fileName, conversationId }]);
  return { conversationId, fileId: fixture.fileId, fileName: fixture.fileName };
}

function seedOperationsMediaFixtures(userId: string, specs: OperationsMediaSeedSpec[]) {
  const db = openBrowserDb();
  const bytes = fs.readFileSync(PNG_UPLOAD_FIXTURE_PATH);
  const seedBatchId = Date.now();
  const userDir = path.join(resolveBrowserMediaDataDir(), "user-files", userId);
  const insertedConversationIds = new Set<string>();

  fs.mkdirSync(userDir, { recursive: true });

  try {
    db.exec("BEGIN IMMEDIATE");

    const fixtures = specs.map((spec, index) => {
      const fileId = `uf_ops_media_${seedBatchId}_${index}`;
      const filePath = path.join(userDir, spec.fileName);
      const conversationId = spec.conversationId ?? null;
      const metadata = {
        width: 512,
        height: 512,
        source: "uploaded",
        retentionClass: "durable",
        ...spec.metadata,
      };

      fs.writeFileSync(filePath, bytes);

      if (conversationId && !insertedConversationIds.has(conversationId)) {
        db.prepare(
          `INSERT INTO conversations (id, user_id, title, status, session_source)
           VALUES (?, ?, ?, 'active', 'authenticated')`,
        ).run(conversationId, userId, `Operations media source ${conversationId}`);
        insertedConversationIds.add(conversationId);
      }

      db.prepare(
        `INSERT INTO user_files (
          id,
          user_id,
          conversation_id,
          content_hash,
          file_type,
          file_name,
          mime_type,
          file_size,
          metadata_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        fileId,
        userId,
        conversationId,
        `hash_${fileId}`,
        spec.fileType ?? "image",
        spec.fileName,
        spec.mimeType ?? "image/png",
        bytes.length,
        JSON.stringify(metadata),
        spec.createdAt ?? new Date().toISOString(),
      );

      return { fileId, fileName: spec.fileName, conversationId };
    });

    db.exec("COMMIT");
    return fixtures;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

function countOperationsMediaFixtures(filters: {
  userId: string;
  search?: string;
  fileType?: string;
  source?: string;
  retentionClass?: string;
  attached?: boolean;
}): number {
  const db = openBrowserDb();

  try {
    const clauses = ["user_id = ?"];
    const params: unknown[] = [filters.userId];

    if (filters.search) {
      clauses.push("(LOWER(file_name) LIKE ? OR LOWER(mime_type) LIKE ?)");
      const like = `%${filters.search.toLowerCase()}%`;
      params.push(like, like);
    }

    if (filters.fileType) {
      clauses.push("file_type = ?");
      params.push(filters.fileType);
    }

    if (filters.source) {
      clauses.push("COALESCE(json_extract(metadata_json, '$.source'), CASE WHEN file_type IN ('audio', 'chart', 'graph', 'subtitle', 'waveform') THEN 'generated' ELSE 'uploaded' END) = ?");
      params.push(filters.source);
    }

    if (filters.retentionClass) {
      clauses.push("COALESCE(json_extract(metadata_json, '$.retentionClass'), CASE WHEN conversation_id IS NULL THEN 'ephemeral' ELSE 'conversation' END) = ?");
      params.push(filters.retentionClass);
    }

    if (filters.attached === true) {
      clauses.push("conversation_id IS NOT NULL");
    } else if (filters.attached === false) {
      clauses.push("conversation_id IS NULL");
    }

    const row = db.prepare(`SELECT COUNT(*) AS total FROM user_files WHERE ${clauses.join(" AND ")}`).get(...params) as { total?: number } | undefined;
    return Number(row?.total ?? 0);
  } finally {
    db.close();
  }
}

async function waitForOperationsMediaCount(
  filters: Parameters<typeof countOperationsMediaFixtures>[0],
  expectedCount: number,
): Promise<void> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if (countOperationsMediaFixtures(filters) === expectedCount) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for ${expectedCount} operations media records for user ${filters.userId}`);
}

async function createRoleScopedPage(browser: Browser, page: Page, role: "STAFF" | "ADMIN") {
  const context = await browser.newContext({
    baseURL: PLAYWRIGHT_BASE_URL,
    storageState: await page.context().storageState(),
  });
  const scopedPage = await context.newPage();

  await stubShellRequests(scopedPage);
  await setSimulatedRole(scopedPage, role);

  return { context, page: scopedPage };
}

async function setSimulatedRole(page: Page, role: "STAFF" | "ADMIN") {
  const response = await page.request.post(`${PLAYWRIGHT_BASE_URL}/api/auth/switch`, {
    data: { role },
  });
  expect(response.ok()).toBe(true);
}

test("operations media route keeps conversation detail admin-only while allowing staff inventory access", async ({ page, browser }) => {
  await stubShellRequests(page);

  const { email } = await registerFreshUser(page);
  const userId = await waitForUserIdByEmail(email);
  const fixture = seedOperationsMediaFixture(userId);
  await waitForOperationsMediaCount({ userId }, 1);

  await setSimulatedRole(page, "STAFF");
  await page.goto(`/operations/media?userId=${userId}`);

  await expect(page.getByRole("heading", { name: /Media inventory for Operations Media User/i })).toBeVisible();
  await expect(page.getByRole("button", { name: fixture.fileName })).toBeVisible();
  await page.getByRole("button", { name: fixture.fileName }).click();
  await expect(page.getByRole("heading", { name: fixture.fileName })).toBeVisible();
  await expect(page.getByText(fixture.conversationId)).toBeVisible();
  await expect(page.getByRole("link", { name: /Open conversation detail/i })).toHaveCount(0);
  await expect(page.getByText(/Conversation detail remains admin-only/i)).toBeVisible();

  const adminSession = await createRoleScopedPage(browser, page, "ADMIN");

  try {
    await adminSession.page.goto(`/operations/media?userId=${userId}`);
    await adminSession.page.getByRole("button", { name: fixture.fileName }).click();

    const detailLink = adminSession.page.getByRole("link", { name: /Open conversation detail/i });
    await expect(detailLink).toBeVisible();
    await expect(detailLink).toHaveAttribute("href", `/admin/conversations/${fixture.conversationId}`);
  } finally {
    await adminSession.context.close();
  }
});

test("operations media route keeps combined filters and pagination stable across pages", async ({ page }) => {
  await stubShellRequests(page);

  const { email } = await registerFreshUser(page);
  const userId = await waitForUserIdByEmail(email);
  const baseConversationId = `conv_ops_media_batch_${Date.now()}`;

  seedOperationsMediaFixtures(userId, [
    ...Array.from({ length: 52 }, (_, index) => ({
      fileName: `batch-match-${String(index + 1).padStart(3, "0")}.png`,
      conversationId: baseConversationId,
      createdAt: new Date(Date.UTC(2026, 3, 15, 12, 0, index + 1)).toISOString(),
    })),
    {
      fileName: "batch-match-generated.png",
      conversationId: baseConversationId,
      metadata: { source: "generated", retentionClass: "durable" },
      createdAt: new Date(Date.UTC(2026, 3, 15, 12, 2, 0)).toISOString(),
    },
    {
      fileName: "batch-match-ephemeral.png",
      conversationId: baseConversationId,
      metadata: { source: "uploaded", retentionClass: "ephemeral" },
      createdAt: new Date(Date.UTC(2026, 3, 15, 12, 2, 1)).toISOString(),
    },
    {
      fileName: "batch-match-document.pdf",
      conversationId: baseConversationId,
      fileType: "document",
      mimeType: "application/pdf",
      metadata: { source: "uploaded", retentionClass: "durable" },
      createdAt: new Date(Date.UTC(2026, 3, 15, 12, 2, 2)).toISOString(),
    },
    {
      fileName: "batch-match-unattached.png",
      conversationId: null,
      metadata: { source: "uploaded", retentionClass: "durable" },
      createdAt: new Date(Date.UTC(2026, 3, 15, 12, 2, 3)).toISOString(),
    },
  ]);
  await waitForOperationsMediaCount({
    userId,
    search: "batch-match",
    fileType: "image",
    source: "uploaded",
    retentionClass: "durable",
    attached: true,
  }, 52);

  await setSimulatedRole(page, "STAFF");
  await page.goto("/operations/media");

  await page.locator('input[name="q"]').fill("batch-match");
  await page.locator('input[name="userId"]').fill(userId);
  await page.locator('select[name="type"]').selectOption("image");
  await page.locator('select[name="source"]').selectOption("uploaded");
  await page.locator('select[name="retention"]').selectOption("durable");
  await page.locator('select[name="attached"]').selectOption("attached");
  await page.getByRole("button", { name: "Apply filters" }).click();

  await page.waitForURL((url) => {
    const params = url.searchParams;
    return url.pathname === "/operations/media"
      && params.get("q") === "batch-match"
      && params.get("userId") === userId
      && params.get("type") === "image"
      && params.get("source") === "uploaded"
      && params.get("retention") === "durable"
      && params.get("attached") === "attached"
      && params.get("page") === null;
  });

  await expect(page.getByText(/52 matching assets · page 1 · showing up to 50/i)).toBeVisible({ timeout: 10000 });
  const nextLink = page.getByRole("link", { name: "Next" });
  await expect(nextLink).toBeVisible();

  const nextHref = await nextLink.getAttribute("href");
  expect(nextHref).toContain("q=batch-match");
  expect(nextHref).toContain(`userId=${userId}`);
  expect(nextHref).toContain("type=image");
  expect(nextHref).toContain("source=uploaded");
  expect(nextHref).toContain("retention=durable");
  expect(nextHref).toContain("attached=attached");
  expect(nextHref).toContain("page=2");

  await nextLink.click();

  await page.waitForURL((url) => {
    const params = url.searchParams;
    return url.pathname === "/operations/media"
      && params.get("q") === "batch-match"
      && params.get("userId") === userId
      && params.get("type") === "image"
      && params.get("source") === "uploaded"
      && params.get("retention") === "durable"
      && params.get("attached") === "attached"
      && params.get("page") === "2";
  });

  await expect(page.getByText(/52 matching assets · page 2 · showing up to 50/i)).toBeVisible();
  await expect(page.locator('input[name="q"]').first()).toHaveValue("batch-match");
  await expect(page.locator('input[name="userId"]').first()).toHaveValue(userId);
  await expect(page.locator('select[name="type"]').first()).toHaveValue("image");
  await expect(page.locator('select[name="source"]').first()).toHaveValue("uploaded");
  await expect(page.locator('select[name="retention"]').first()).toHaveValue("durable");
  await expect(page.locator('select[name="attached"]').first()).toHaveValue("attached");
  await expect(page.getByRole("link", { name: "Previous" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Next" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /batch-match-001\.png/i })).toBeVisible();
});
