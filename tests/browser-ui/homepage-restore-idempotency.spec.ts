import { expect, test, type Page, type Route } from "@playwright/test";

test.describe.configure({ timeout: 45_000 });

async function stubPhase3RestoreShell(page: Page) {
  let workspaceRestoreCalls = 0;
  let legacyActiveRestoreCalls = 0;
  let chatJobPostCalls = 0;

  await page.route("**/api/preferences", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ preferences: [] }),
    });
  });

  await page.route("**/api/referral/visit", async (route: Route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "No referral visit" }),
    });
  });

  await page.route("**/api/conversations/active", async (route: Route) => {
    legacyActiveRestoreCalls += 1;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Legacy restore endpoint must not be used" }),
    });
  });

  await page.route("**/api/workspace/restore**", async (route: Route) => {
    workspaceRestoreCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        workspace: {
          id: "workspace:conv_phase3_restore",
          userId: "usr_123",
          conversationId: "conv_phase3_restore",
          status: "active",
          title: "Restored media history",
          currentObjective: "Review restored media",
          recommendedNextStep: "Inspect the asset shelf",
          openLoops: [],
          activeJobRefs: [],
          importantAssetRefs: [],
          workflowContextRef: null,
          operatorTransitionRef: null,
          trustDistributionRef: null,
          relatedBusinessRefs: [],
          latestMemoryRef: null,
          latestPromptBindingRef: null,
          updatedAt: "2026-04-28T21:00:00.000Z",
        },
        activeJobs: [],
        attentionNeededJobs: [],
        assets: [],
        workflow: null,
        operatorTransition: null,
        trustDistribution: null,
        memory: null,
        migration: null,
        restoreMeta: {
          schemaVersion: 1,
          restoredAt: "2026-04-28T21:00:00.000Z",
          source: "durable_read_model",
        },
        recentTranscript: [
          {
            id: "msg_phase3_restore_history",
            conversationId: "conv_phase3_restore",
            role: "assistant",
            content: "Historical compose media result.",
            parts: [
              { type: "tool_call", name: "compose_media", args: { plan: { id: "plan_restore" } } },
              { type: "tool_result", name: "compose_media", result: { plan: { id: "plan_restore" } } },
            ],
            createdAt: "2026-04-28T21:00:00.000Z",
            tokenEstimate: 0,
          },
        ],
      }),
    });
  });

  await page.route("**/api/chat/jobs?**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ jobs: [] }),
    });
  });

  await page.route("**/api/chat/jobs", async (route: Route) => {
    if (route.request().method() === "POST") {
      chatJobPostCalls += 1;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ jobs: [] }),
    });
  });

  await page.route("**/api/chat/events**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
      body: "",
    });
  });

  return {
    getWorkspaceRestoreCalls: () => workspaceRestoreCalls,
    getLegacyActiveRestoreCalls: () => legacyActiveRestoreCalls,
    getChatJobPostCalls: () => chatJobPostCalls,
  };
}

test("repeated homepage restore does not create jobs from restored historical browser-runtime candidates", async ({ page }) => {
  const counters = await stubPhase3RestoreShell(page);
  const appShell = page.locator("main").first();

  await page.goto("/");
  await expect(appShell).toContainText("Historical compose media result.");
  await expect(page.getByText("Queued for local execution")).toHaveCount(0);

  await page.reload();
  await expect(appShell).toContainText("Historical compose media result.");
  await expect(page.getByText("Queued for local execution")).toHaveCount(0);

  expect(counters.getWorkspaceRestoreCalls()).toBeGreaterThanOrEqual(2);
  expect(counters.getLegacyActiveRestoreCalls()).toBe(0);
  expect(counters.getChatJobPostCalls()).toBe(0);
});