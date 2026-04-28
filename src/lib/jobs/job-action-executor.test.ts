import { describe, expect, it, vi } from "vitest";

import { executeJobAction } from "./job-action-executor";
import type { DeferredJobConversationProjector } from "./deferred-job-conversation-projector";
import { jobEventBus } from "./job-event-bus";

describe("job-action-executor", () => {
  it("emits job_canceled after a successful cancel write", async () => {
    const repository = {
      findLatestRenderableEventForJob: vi.fn().mockResolvedValue({
        payload: {
          progressPercent: 80,
          progressLabel: "Publishing",
        },
      }),
      cancelJob: vi.fn().mockResolvedValue({
        id: "job_1",
        conversationId: "conv_1",
        status: "canceled",
      }),
      appendEvent: vi.fn().mockResolvedValue({ sequence: 9 }),
    } as const;
    const projector = {
      project: vi.fn().mockResolvedValue(undefined),
    } as unknown as DeferredJobConversationProjector;

    const canceled = new Promise<{ jobId: string; canceledBy: string }>((resolve) => {
      const unsubscribe = jobEventBus.onJobCanceled("job_1", (payload) => {
        unsubscribe();
        resolve(payload);
      });
    });

    const result = await executeJobAction({
      repository: repository as never,
      projector,
      job: {
        id: "job_1",
        conversationId: "conv_1",
        userId: "usr_owner",
        toolName: "publish_content",
        status: "running",
      } as never,
      action: "cancel",
      actorId: "usr_owner",
    });

    expect(result.ok).toBe(true);
    await expect(canceled).resolves.toEqual({
      jobId: "job_1",
      canceledBy: "usr_owner",
    });
  });
});