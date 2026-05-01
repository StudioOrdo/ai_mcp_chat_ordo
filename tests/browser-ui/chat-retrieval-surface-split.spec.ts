import { expect, test, type Page, type Route } from "@playwright/test";

import { registerFreshUser } from "./helpers/media-eval";

const ACTIVE_CONVERSATION_PAYLOAD = {
  conversation: {
    id: "conv_phase7_split",
    userId: "usr_phase7_split",
    title: "Phase 7 retrieval split",
    status: "active",
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:05:00.000Z",
    convertedFrom: null,
    messageCount: 2,
    firstMessageAt: "2026-04-29T00:00:00.000Z",
    lastToolUsed: "search_relationship_memory",
    sessionSource: "authenticated",
    promptVersion: null,
    routingSnapshot: { lane: "member", confidence: 0.92 },
    referralSource: null,
  },
  messages: [
    {
      id: "msg_transcript_recall",
      role: "assistant",
      content: "I checked prior conversation turns.",
      createdAt: "2026-04-29T00:01:00.000Z",
      parts: [
        { type: "tool_call", name: "search_my_conversations", args: { query: "pricing", max_results: 3 } },
        {
          type: "tool_result",
          name: "search_my_conversations",
          result: "1. [high] (turn 4) We discussed pricing assumptions for the launch.",
        },
      ],
    },
    {
      id: "msg_relationship_memory",
      role: "assistant",
      content: "I checked continuity memory.",
      createdAt: "2026-04-29T00:02:00.000Z",
      parts: [
        { type: "tool_call", name: "search_relationship_memory", args: { query: "launch", memory_types: ["goal"] } },
        {
          type: "tool_result",
          name: "search_relationship_memory",
          result: "1. [goal] Launch the revenue triage offer this month.",
        },
      ],
    },
  ],
};

async function stubSignedInConversation(page: Page) {
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

  await page.route("**/api/workspace/restore", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ACTIVE_CONVERSATION_PAYLOAD),
    });
  });

  await page.route("**/api/workspace/restore?conversationId=conv_phase7_split", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ACTIVE_CONVERSATION_PAYLOAD),
    });
  });
}

test.describe("Chat retrieval surface split", () => {
  test("renders transcript recall and relationship memory with distinct signed-in cards", async ({ page }) => {
    await registerFreshUser(page, { emailPrefix: "phase7-retrieval" });
    await stubSignedInConversation(page);

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Transcript Recall" })).toBeVisible();
    await expect(page.getByText("Transcript matches")).toBeVisible();
    await expect(page.getByRole("button", { name: "Transcript excerpts" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Relationship Memory" })).toBeVisible();
    await expect(page.getByText("Memory matches")).toBeVisible();
    await expect(page.getByRole("button", { name: "Memory details" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Result details" })).toHaveCount(0);
    await expect(page.locator('[data-capability-card="true"]')).toHaveCount(2);
  });
});