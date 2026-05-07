import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

import { backdateRegisterFormStart, finishRegisterNavigation } from "./helpers/public-form";

test.describe.configure({ timeout: 60_000 });

const PNG_UPLOAD_FIXTURE_PATH = path.join(process.cwd(), "public", "ordo-avatar.png");
const PLAYWRIGHT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:34123";

interface MediaSeedSpec {
  fileName: string;
  conversationId?: string | null;
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
  const email = `media-phase4-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await backdateRegisterFormStart(page);
  await page.goto("/register");
  await page.getByLabel("Name").fill("Media Phase Four User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("MediaPhase4!Pass123");
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

function seedMediaFixtures(userId: string, specs: MediaSeedSpec[]) {
  const db = openBrowserDb();
  const bytes = fs.readFileSync(PNG_UPLOAD_FIXTURE_PATH);
  const userDir = path.join(resolveBrowserMediaDataDir(), "user-files", userId);
  const insertedConversationIds = new Set<string>();

  fs.mkdirSync(userDir, { recursive: true });

  try {
    const fixtures = specs.map((spec, index) => {
      const fileId = `uf_media_phase4_${Date.now()}_${index}`;
      const filePath = path.join(userDir, spec.fileName);
      const conversationId = spec.conversationId ?? null;
      const metadata = {
        width: 512,
        height: 512,
        source: "uploaded",
        retentionClass: conversationId ? "conversation" : "ephemeral",
        ...spec.metadata,
      };

      fs.writeFileSync(filePath, bytes);

      if (conversationId && !insertedConversationIds.has(conversationId)) {
        db.prepare(
          `INSERT INTO conversations (id, user_id, title, status, session_source)
           VALUES (?, ?, ?, 'active', 'authenticated')`,
        ).run(conversationId, userId, `Media phase 4 source ${conversationId}`);
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
        ) VALUES (?, ?, ?, ?, 'image', ?, 'image/png', ?, ?, ?)`,
      ).run(
        fileId,
        userId,
        conversationId,
        `hash_${fileId}`,
        spec.fileName,
        bytes.length,
        JSON.stringify(metadata),
        spec.createdAt ?? new Date().toISOString(),
      );

      return { fileId, fileName: spec.fileName, conversationId };
    });

    return fixtures;
  } finally {
    db.close();
  }
}

async function setSimulatedRole(page: Page, role: "STAFF" | "ADMIN") {
  const response = await page.request.post(`${PLAYWRIGHT_BASE_URL}/api/auth/switch`, {
    data: { role },
  });
  expect(response.ok()).toBe(true);
}

test("my media route shows quota messaging without leaking host-capacity metrics", async ({ page }) => {
  await stubShellRequests(page);

  const { email } = await registerFreshUser(page);
  const userId = await waitForUserIdByEmail(email);
  const [fixture] = seedMediaFixtures(userId, [
    {
      fileName: `quota-proof-${Date.now()}.png`,
      conversationId: null,
      createdAt: new Date(Date.UTC(2026, 3, 15, 12, 0, 0)).toISOString(),
    },
  ]);

  await page.goto("/my/media");

  await expect(page.getByRole("heading", { name: "Governed media", exact: true })).toBeVisible();
  await expect(page.getByText(/Storage budget/i)).toBeVisible();
  await expect(page.getByText(/of 10 GB used/i)).toBeVisible();
  await expect(page.getByText("Storage is healthy. Uploads are still available.", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: fixture.fileName })).toBeVisible();
  await expect(page.getByText(/Storage volume capacity/i)).toHaveCount(0);
  await expect(page.getByText(/total on the writable media volume/i)).toHaveCount(0);

  await page.getByRole("button", { name: fixture.fileName }).click();
  await expect(page.getByRole("heading", { name: fixture.fileName })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Governed media", exact: true })).toHaveCount(0);
});

test("operations media route shows writable-volume capacity to staff viewers", async ({ page }) => {
  await stubShellRequests(page);

  const { email } = await registerFreshUser(page);
  const userId = await waitForUserIdByEmail(email);
  const conversationId = `conv_media_phase4_${Date.now()}`;
  const [fixture] = seedMediaFixtures(userId, [
    {
      fileName: `capacity-proof-${Date.now()}.png`,
      conversationId,
      createdAt: new Date(Date.UTC(2026, 3, 15, 12, 0, 1)).toISOString(),
    },
  ]);

  await setSimulatedRole(page, "STAFF");
  await page.goto(`/operations/media?userId=${userId}`);

  await expect(page.getByRole("heading", { name: /Media inventory for Media Phase Four User/i })).toBeVisible();
  await expect(page.getByText(/Storage volume capacity/i)).toBeVisible();
  await expect(page.getByText(/Measured from the shared `.data` mount/i)).toBeVisible();
  await expect(page.getByText(/total on the writable media volume/i)).toBeVisible();
  await expect(page.getByText(/of the writable volume is consumed/i)).toBeVisible();
  await expect(page.getByRole("button", { name: fixture.fileName })).toBeVisible();
  await expect(page.getByText(/Storage budget/i)).toHaveCount(0);
  await expect(page.getByText(/of 10 GB used/i)).toHaveCount(0);
});
