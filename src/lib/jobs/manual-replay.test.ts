import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/tool-composition-root", () => ({
  getToolComposition: () => ({
    registry: {
      getDescriptor: () => ({
        deferred: { dedupeStrategy: "per-conversation-payload" },
      }),
    },
  }),
}));

import { canManualReplayJob, RETRIABLE_JOB_STATUSES } from "./manual-replay";

describe("manual-replay", () => {
  it("treats dead_letter jobs as manually replayable", () => {
    expect(RETRIABLE_JOB_STATUSES.has("dead_letter")).toBe(true);
    expect(canManualReplayJob({
      status: "dead_letter",
      toolName: "compose_media",
    })).toBe(true);
  });
});