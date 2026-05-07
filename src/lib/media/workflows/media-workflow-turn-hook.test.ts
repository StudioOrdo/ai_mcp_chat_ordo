import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWorkflow: vi.fn(),
  listWorkflowsByConversation: vi.fn(),
  reconcileRunnableWorkflows: vi.fn(),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getMediaWorkflowRepository: () => ({
    createWorkflow: mocks.createWorkflow,
    listWorkflowsByConversation: mocks.listWorkflowsByConversation,
  }),
  getMediaWorkflowOrchestrator: () => ({
    reconcileRunnableWorkflows: mocks.reconcileRunnableWorkflows,
  }),
}));

import type { TurnCompletionSuccessHookState } from "@/lib/chat/runtime-hooks";

import { MediaWorkflowTurnHook } from "./media-workflow-turn-hook";

function createState(overrides: Partial<TurnCompletionSuccessHookState> = {}): TurnCompletionSuccessHookState {
  return {
    routeContext: null,
    conversationId: "conv_1",
    userId: "usr_1",
    role: "AUTHENTICATED",
    streamId: "turn_1",
    status: "completed",
    assistantText: "The chart and audio are ready; I will combine them into a video.",
    persistedMessageId: "msg_1",
    assistantParts: [
      {
        type: "tool_call",
        name: "generate_chart",
        args: { title: "The LLM Paradox" },
        toolInvocationId: "toolu_chart",
      },
      {
        type: "tool_result",
        name: "generate_chart",
        result: {
          assetId: "uf_chart_1",
          title: "The LLM Paradox",
        },
        toolInvocationId: "toolu_chart",
      },
      {
        type: "tool_call",
        name: "generate_audio",
        args: {
          title: "The Struggle of an LLM",
          text: "Narration text",
        },
        toolInvocationId: "toolu_audio",
      },
      {
        type: "tool_result",
        name: "generate_audio",
        result: {
          deferred_job: {
            jobId: "job_audio_1",
          },
        },
        toolInvocationId: "toolu_audio",
      },
    ],
    meta: {},
    ...overrides,
  };
}

describe("MediaWorkflowTurnHook", () => {
  beforeEach(() => {
    mocks.createWorkflow.mockReset();
    mocks.listWorkflowsByConversation.mockReset();
    mocks.reconcileRunnableWorkflows.mockReset();
    mocks.listWorkflowsByConversation.mockReturnValue([]);
    mocks.reconcileRunnableWorkflows.mockResolvedValue([]);
  });

  it("reconciles eligible turns without creating prose-derived workflows", async () => {
    await new MediaWorkflowTurnHook().afterTurnCompletion(createState());

    expect(mocks.createWorkflow).not.toHaveBeenCalled();
    expect(mocks.reconcileRunnableWorkflows).toHaveBeenCalledWith({
      conversationId: "conv_1",
      userId: "usr_1",
      limit: 5,
    });
  });

  it("reconciles an existing workflow from the same assistant message", async () => {
    mocks.listWorkflowsByConversation.mockReturnValue([
      { workflow: { originMessageId: "msg_1" } },
    ]);

    await new MediaWorkflowTurnHook().afterTurnCompletion(createState());

    expect(mocks.createWorkflow).not.toHaveBeenCalled();
    expect(mocks.reconcileRunnableWorkflows).toHaveBeenCalledWith({
      conversationId: "conv_1",
      userId: "usr_1",
      limit: 5,
    });
  });
});
