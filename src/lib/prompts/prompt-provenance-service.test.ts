import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listByConversationMock,
  listBySourcePromptBindingMock,
  listByConversationBindingsMock,
} = vi.hoisted(() => ({
  listByConversationMock: vi.fn(),
  listBySourcePromptBindingMock: vi.fn(),
  listByConversationBindingsMock: vi.fn(),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getPromptProvenanceDataMapper: () => ({
    listByConversation: listByConversationMock,
  }),
  getPromptBindingRepository: () => ({
    listByConversation: listByConversationBindingsMock,
    listBySourcePromptBinding: listBySourcePromptBindingMock,
  }),
}));

vi.mock("@/lib/chat/prompt-runtime", () => ({
  getPromptRuntime: vi.fn(),
  replayPromptRuntime: vi.fn(async () => ({
    surface: "chat_stream",
    text: "ignored",
    effectiveHash: "hash_a",
    slotRefs: [],
    sections: [],
    warnings: [],
  })),
}));

import { listPromptTurnAudits } from "./prompt-provenance-service";

describe("prompt-provenance-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enumerates affected durable targets for replay diagnostics", async () => {
    listByConversationMock.mockResolvedValue([
      {
        id: "pprov_1",
        conversationId: "conv_1",
        userMessageId: "msg_user_1",
        assistantMessageId: "msg_assistant_1",
        surface: "chat_stream",
        effectiveHash: "hash_a",
        slotRefs: [],
        sections: [],
        warnings: [],
        replayContext: {
          surface: "chat_stream",
          role: "ADMIN",
        },
        recordedAt: "2026-04-29T12:00:00.000Z",
      },
    ]);
    listByConversationBindingsMock.mockResolvedValue([
      {
        id: "pb_root",
        userId: "usr_1",
        conversationId: "conv_1",
        surface: "chat_stream",
        targetKind: "message",
        targetId: "msg_user_1",
        sourcePromptBindingId: null,
        effectiveHash: "hash_a",
        slotRefs: [],
        overlayRefs: [],
        decisionSourceRefs: [
          {
            sourceKind: "prompt_provenance",
            sourceId: "pprov_1",
            userId: "usr_1",
            conversationId: "conv_1",
          },
        ],
        evidenceRefs: [],
        createdAt: "2026-04-29T12:00:00.000Z",
      },
    ]);
    listBySourcePromptBindingMock.mockResolvedValue([
      {
        id: "pb_job_1",
        userId: "usr_1",
        conversationId: "conv_1",
        surface: "job_execution",
        targetKind: "job",
        targetId: "job_1",
        sourcePromptBindingId: "pb_root",
        effectiveHash: "hash_a",
        slotRefs: [],
        overlayRefs: [],
        decisionSourceRefs: [],
        evidenceRefs: [],
        createdAt: "2026-04-29T12:01:00.000Z",
      },
      {
        id: "pb_mem_1",
        userId: "usr_1",
        conversationId: "conv_1",
        surface: "memory_projection",
        targetKind: "relationship_memory",
        targetId: "mem_1",
        sourcePromptBindingId: "pb_root",
        effectiveHash: "hash_a",
        slotRefs: [],
        overlayRefs: [],
        decisionSourceRefs: [],
        evidenceRefs: [],
        createdAt: "2026-04-29T12:02:00.000Z",
      },
    ]);

    const audits = await listPromptTurnAudits("conv_1");

    expect(audits).toHaveLength(1);
    expect(audits[0]?.affectedTargets).toEqual([
      {
        id: "pb_root",
        surface: "chat_stream",
        targetKind: "message",
        targetId: "msg_user_1",
        sourcePromptBindingId: null,
      },
      {
        id: "pb_job_1",
        surface: "job_execution",
        targetKind: "job",
        targetId: "job_1",
        sourcePromptBindingId: "pb_root",
      },
      {
        id: "pb_mem_1",
        surface: "memory_projection",
        targetKind: "relationship_memory",
        targetId: "mem_1",
        sourcePromptBindingId: "pb_root",
      },
    ]);
  });
});