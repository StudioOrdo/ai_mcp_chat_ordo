import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_WORKSPACE_RESTORE_RETRY_DELAY_MS,
  restoreWorkspaceByConversationId,
} from "./workspaceRestoreApi";

const fetchMock = vi.fn();

const restoredPayload = {
  workspace: {
    id: "workspace:conv_selected",
    userId: "usr_123",
    conversationId: "conv_selected",
    status: "active",
    title: "Selected thread",
    currentObjective: "Review selected thread",
    recommendedNextStep: "Resume review",
    openLoops: [],
    activeJobRefs: [],
    importantAssetRefs: [],
    workflowContextRef: null,
    operatorTransitionRef: null,
    trustDistributionRef: null,
    relatedBusinessRefs: [],
    latestMemoryRef: null,
    latestPromptBindingRef: null,
    updatedAt: "2026-03-15T10:00:01.000Z",
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
    restoredAt: "2026-03-15T10:00:01.000Z",
    source: "durable_read_model" as const,
  },
  recentTranscript: [],
};

describe("workspaceRestoreApi", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries transient fetch failures before surfacing restore results", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => restoredPayload,
      });

    const resultPromise = restoreWorkspaceByConversationId("conv_selected");

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(DEFAULT_WORKSPACE_RESTORE_RETRY_DELAY_MS);

    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("restored");
    expect(result.payload?.conversationId).toBe("conv_selected");
  });
});