import { describe, expect, it, vi } from "vitest";

import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import {
  DEFAULT_OPERATION_PROMPT_GROUNDING_BUDGET,
  type OperationPromptGroundingSnapshot,
} from "@/core/use-cases/operations/OperationPromptGrounding";
import {
  prepareFallbackContext,
  prepareStreamContext,
} from "@/lib/chat/stream-preparation";
import { buildOperationPromptGroundingForConversation } from "@/lib/operations/operation-prompt-grounding-root";

vi.mock("@/lib/operations/operation-prompt-grounding-root", () => ({
  buildOperationPromptGroundingForConversation: vi.fn(),
}));

function createBuilder() {
  const builder = {
    withConversationSummary: vi.fn(() => builder),
    withRoutingContext: vi.fn(() => builder),
    withSection: vi.fn(() => builder),
  };
  return builder;
}

function snapshot(overrides: Partial<OperationPromptGroundingSnapshot> = {}): OperationPromptGroundingSnapshot {
  return {
    generatedAt: "2026-05-03T12:00:00.000Z",
    conversationId: "conv_ops",
    status: "available",
    includeInPrompt: true,
    operations: [],
    toolEvidence: [],
    budget: {
      ...DEFAULT_OPERATION_PROMPT_GROUNDING_BUDGET,
      operationsDropped: 0,
      eventsDropped: 0,
      artifactsDropped: 0,
      actionsDropped: 0,
      toolEvidenceDropped: 0,
    },
    warnings: [],
    ...overrides,
  };
}

describe("stream-preparation operation grounding", () => {
  it("adds operation grounding during primary stream preparation and returns the structured snapshot", async () => {
    const builder = createBuilder();
    const routingSnapshot = createConversationRoutingSnapshot();
    const messages = [
      {
        id: "msg_user",
        conversationId: "conv_ops",
        role: "user" as const,
        content: "check the restore",
        parts: [{ type: "text" as const, text: "check the restore" }],
        createdAt: "2026-05-03T12:00:00.000Z",
        tokenEstimate: 1,
      },
    ];
    const groundingSnapshot = snapshot();
    vi.mocked(buildOperationPromptGroundingForConversation).mockResolvedValueOnce({
      snapshot: groundingSnapshot,
      section: {
        key: "operation_grounding",
        priority: 43,
        content: "[Server operation grounding]\nOperation op_restore (restore_execute)\n- status: running",
        payload: {
          status: "available",
          generatedAt: groundingSnapshot.generatedAt,
          conversationId: "conv_ops",
          operationRefs: [{
            operationId: "op_restore",
            kind: "restore_execute",
            status: "running",
            revision: 1,
            groundingReason: "active",
          }],
          toolEvidenceRefs: [],
          warnings: [],
        },
      },
    });

    const prepared = await prepareStreamContext({
      builder: builder as never,
      interactor: {
        getForStreamingContext: vi.fn().mockResolvedValue({
          conversation: { routingSnapshot },
          messages,
        }),
        updateRoutingSnapshot: vi.fn().mockResolvedValue(undefined),
      } as never,
      routingAnalyzer: {
        analyze: vi.fn().mockResolvedValue(routingSnapshot),
      } as never,
      relationshipMemoryReader: {
        listActiveByConversation: vi.fn().mockResolvedValue([]),
      } as never,
      conversationId: "conv_ops",
      userId: "usr_admin",
      role: "ADMIN",
      incomingMessages: [{ role: "user", content: "check the restore" }],
      latestUserText: "check the restore",
      latestUserContent: "check the restore",
      taskOriginHandoff: null,
      mediaContinuityHandoff: null,
    });

    expect(buildOperationPromptGroundingForConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv_ops",
        userId: "usr_admin",
        role: "ADMIN",
        latestUserText: "check the restore",
        messages,
        contextWindowGuard: expect.objectContaining({ status: "ok" }),
        now: expect.any(String),
      }),
    );
    expect(builder.withSection).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "operation_grounding",
        priority: 43,
        content: expect.stringContaining("Operation op_restore"),
      }),
    );
    expect(prepared.operationGrounding).toBe(groundingSnapshot);
  });

  it("adds an unavailable grounding warning in fallback context for operation questions", async () => {
    const builder = createBuilder();

    const prepared = await prepareFallbackContext({
      builder: builder as never,
      incomingMessages: [{ role: "user", content: "what happened to the restore?" }],
      latestUserContent: "what happened to the restore?",
      taskOriginHandoff: null,
      mediaContinuityHandoff: null,
    });

    expect(builder.withSection).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "operation_grounding",
        priority: 43,
        content: expect.stringContaining("Operation grounding is unavailable"),
      }),
    );
    expect(prepared.operationGrounding?.status).toBe("unavailable");
  });
});
