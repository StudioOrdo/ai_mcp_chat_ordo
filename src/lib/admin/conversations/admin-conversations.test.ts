import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  convFindByIdMock,
  msgListByConversationMock,
  userFindByIdMock,
  findLatestMigrationForTargetIdentityMock,
  getTrustedReferrerContextMock,
  listPromptTurnAuditsMock,
} = vi.hoisted(() => ({
  convFindByIdMock: vi.fn(),
  msgListByConversationMock: vi.fn(),
  userFindByIdMock: vi.fn(),
  findLatestMigrationForTargetIdentityMock: vi.fn(),
  getTrustedReferrerContextMock: vi.fn(),
  listPromptTurnAuditsMock: vi.fn(),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getConversationDataMapper: () => ({
    findById: convFindByIdMock,
  }),
  getMessageDataMapper: () => ({
    listByConversation: msgListByConversationMock,
  }),
  getUserDataMapper: () => ({
    findById: userFindByIdMock,
  }),
  getConversationEventDataMapper: () => ({
    listByConversation: vi.fn().mockResolvedValue([]),
  }),
  getIdentityMigrationRepository: () => ({
    findLatestForTargetIdentity: findLatestMigrationForTargetIdentityMock,
  }),
}));

vi.mock("@/lib/referrals/referral-ledger", () => ({
  getReferralLedgerService: () => ({
    getTrustedReferrerContext: getTrustedReferrerContextMock,
  }),
}));

vi.mock("@/lib/prompts/prompt-provenance-service", () => ({
  listPromptTurnAudits: listPromptTurnAuditsMock,
}));

import { loadAdminConversationDetail } from "./admin-conversations";

describe("loadAdminConversationDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindByIdMock.mockResolvedValue({ id: "user_1", name: "Alice", email: "alice@example.com" });
    findLatestMigrationForTargetIdentityMock.mockResolvedValue(null);
    getTrustedReferrerContextMock.mockResolvedValue(null);
    listPromptTurnAuditsMock.mockResolvedValue([]);
  });

  it("derives a durable transcript view from persisted messages", async () => {
    convFindByIdMock.mockResolvedValue({
      id: "conv_1",
      userId: "user_1",
      title: "Compacted thread",
      status: "active",
      createdAt: "2025-06-01T00:00:00Z",
      updatedAt: "2025-06-01T00:05:00Z",
      convertedFrom: null,
      messageCount: 3,
      firstMessageAt: "2025-06-01T00:00:00Z",
      lastToolUsed: "calculator",
      sessionSource: "web",
      promptVersion: 2,
      routingSnapshot: {
        lane: "development",
        confidence: 0.9,
        recommendedNextStep: null,
        detectedNeedSummary: null,
        lastAnalyzedAt: null,
      },
      referralSource: null,
      deletedAt: null,
      purgeAfter: null,
    });

    msgListByConversationMock.mockResolvedValue([
      {
        id: "msg_1",
        conversationId: "conv_1",
        role: "user",
        content: "What is 6 times 7?",
        parts: [{ type: "text", text: "What is 6 times 7?" }],
        createdAt: "2025-06-01T00:00:00Z",
        tokenEstimate: 5,
      },
      {
        id: "msg_2",
        conversationId: "conv_1",
        role: "assistant",
        content: "Let me calculate that.",
        parts: [{ type: "tool_result", name: "calculator", result: 42 }],
        createdAt: "2025-06-01T00:00:10Z",
        tokenEstimate: 6,
      },
      {
        id: "msg_3",
        conversationId: "conv_1",
        role: "system",
        content: "Compaction completed.",
        parts: [{
          type: "compaction_marker",
          kind: "summary",
          compactedCount: 2,
          coversUpToMessageId: "msg_2",
        }],
        createdAt: "2025-06-01T00:00:20Z",
        tokenEstimate: 2,
      },
    ]);

    const detail = await loadAdminConversationDetail("conv_1");

    expect(detail.totalTokens).toBe(13);
    expect(detail.transcript).toMatchObject({
      entryCount: 5,
      inContextCount: 3,
      toolResultCount: 1,
      compactionMarkerCount: 1,
    });
    expect(detail.transcript.entries.map((entry) => entry.role)).toEqual([
      "user",
      "assistant",
      "tool_result",
      "system",
      "compaction_marker",
    ]);
    expect(detail.transcript.entries[2]).toMatchObject({
      role: "tool_result",
      contentSummary: "calculator: 42",
      sourceMessageId: "msg_2",
    });
    expect(detail.transcript.entries[4]).toMatchObject({
      role: "compaction_marker",
      compactionKind: "summary",
      compactedCount: 2,
      coversUpToMessageId: "msg_2",
    });
    expect(detail.promptProvenance).toEqual([]);
  });

  it("includes prompt provenance audits for admin replay review", async () => {
    convFindByIdMock.mockResolvedValue({
      id: "conv_1",
      userId: "user_1",
      title: "Prompt audit thread",
      status: "active",
      createdAt: "2025-06-01T00:00:00Z",
      updatedAt: "2025-06-01T00:05:00Z",
      convertedFrom: null,
      messageCount: 1,
      firstMessageAt: "2025-06-01T00:00:00Z",
      lastToolUsed: null,
      sessionSource: "web",
      promptVersion: 2,
      routingSnapshot: {
        lane: "development",
        confidence: 0.9,
        recommendedNextStep: null,
        detectedNeedSummary: null,
        lastAnalyzedAt: null,
      },
      referralSource: null,
      deletedAt: null,
      purgeAfter: null,
    });
    msgListByConversationMock.mockResolvedValue([]);
    listPromptTurnAuditsMock.mockResolvedValue([
      {
        record: {
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
          recordedAt: "2025-06-01T00:00:03Z",
        },
        replay: {
          rebuilt: {
            surface: "chat_stream",
            effectiveHash: "hash_a",
            slotRefs: [],
            sections: [],
            warnings: [],
          },
          diff: {
            surfaceChanged: false,
            effectiveHashChanged: false,
            slotRefChanges: [],
            sectionChanges: [],
            warningChanges: [],
            driftWarnings: [],
          },
          matches: true,
        },
        affectedTargets: [
          {
            id: "pb_1",
            surface: "chat_stream",
            targetKind: "message",
            targetId: "msg_user_1",
            sourcePromptBindingId: null,
          },
        ],
      },
    ]);

    const detail = await loadAdminConversationDetail("conv_1");

    expect(detail.promptProvenance).toHaveLength(1);
    expect(detail.promptProvenance[0]?.record.userMessageId).toBe("msg_user_1");
    expect(detail.promptProvenance[0]?.replay.matches).toBe(true);
  });

  it("includes linked identity migration status for admin repair review", async () => {
    convFindByIdMock.mockResolvedValue({
      id: "conv_1",
      userId: "user_1",
      title: "Migrated thread",
      status: "active",
      createdAt: "2025-06-01T00:00:00Z",
      updatedAt: "2025-06-01T00:05:00Z",
      convertedFrom: "anon_seed",
      messageCount: 0,
      firstMessageAt: null,
      lastToolUsed: null,
      sessionSource: "web",
      promptVersion: 2,
      routingSnapshot: {
        lane: "development",
        confidence: 0.9,
        recommendedNextStep: null,
        detectedNeedSummary: null,
        lastAnalyzedAt: null,
      },
      referralSource: null,
      deletedAt: null,
      purgeAfter: null,
    });
    msgListByConversationMock.mockResolvedValue([]);
    findLatestMigrationForTargetIdentityMock.mockResolvedValue({
      id: "idmig_1",
      sourceUserId: "anon_seed",
      targetUserId: "user_1",
      migratedConversationIds: ["conv_1"],
      migratedJobIds: ["job_1"],
      migratedAssetIds: ["file_1"],
      repairedMemoryRefs: ["mem_1"],
      repairedSearchSourceIds: ["anon_seed/conv_1"],
      objectCounts: [],
      repairRefs: [],
      status: "completed",
      currentStage: "completed",
      failureMessage: null,
      createdAt: "2026-04-30T10:00:00.000Z",
      completedAt: "2026-04-30T10:01:00.000Z",
    });

    const detail = await loadAdminConversationDetail("conv_1");

    expect(findLatestMigrationForTargetIdentityMock).toHaveBeenCalledWith("user_1");
    expect(detail.migration).toEqual(expect.objectContaining({ id: "idmig_1", status: "completed" }));
  });
});
