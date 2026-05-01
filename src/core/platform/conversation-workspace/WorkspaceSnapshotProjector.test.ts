import { describe, expect, it } from "vitest";

import type { Conversation } from "@/core/entities/conversation";
import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type { JobRequest } from "@/core/entities/job";
import type { MaterializationRecord } from "@/core/entities/materialization";
import type { PromptBinding } from "@/core/entities/prompt-binding";
import type { RelationshipMemoryRecord } from "@/core/entities/relationship-memory";
import type { UserFile } from "@/core/entities/user-file";

import { projectWorkspaceSnapshot } from "./WorkspaceSnapshotProjector";

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv_1",
    userId: "usr_1",
    title: "Current work",
    status: "active",
    createdAt: "2026-04-28T10:00:00.000Z",
    updatedAt: "2026-04-28T10:01:00.000Z",
    convertedFrom: null,
    messageCount: 4,
    firstMessageAt: "2026-04-28T10:00:00.000Z",
    lastToolUsed: null,
    sessionSource: "chat",
    promptVersion: null,
    routingSnapshot: createConversationRoutingSnapshot({
      detectedNeedSummary: "Finish the customer follow-up",
      recommendedNextStep: "Review the latest output",
      lastAnalyzedAt: "2026-04-28T10:02:00.000Z",
    }),
    referralSource: null,
    ...overrides,
  };
}

function makeMaterialization(overrides: Partial<MaterializationRecord> = {}): MaterializationRecord {
  return {
    id: "mat_1",
    userId: "usr_1",
    conversationId: "conv_1",
    materializationKey: "compose_media:key_1",
    toolName: "compose_media",
    pipelineVersion: "compose_media:v1",
    status: "ready",
    reusePolicy: "same_user",
    inputSourceRefs: [],
    outputRefs: [{ kind: "asset", id: "file_media", userId: "usr_1", conversationId: "conv_1" }],
    evidenceRefs: [],
    producedByJobId: "job_materialized_1",
    supersededByRecordId: null,
    createdAt: "2026-04-28T10:10:00.000Z",
    updatedAt: "2026-04-28T10:10:00.000Z",
    ...overrides,
  };
}

function makeJob(status: JobRequest["status"], updatedAt: string): JobRequest {
  return {
    id: `job_${status}_${updatedAt}`,
    conversationId: "conv_1",
    userId: "usr_1",
    toolName: "compose_media",
    status,
    priority: 0,
    dedupeKey: null,
    initiatorType: "user",
    requestPayload: { materializationKey: "mat_key_1" },
    resultPayload: null,
    errorMessage: null,
    progressPercent: null,
    progressLabel: null,
    attemptCount: 0,
    leaseExpiresAt: null,
    claimedBy: null,
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: null,
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: updatedAt,
    startedAt: null,
    completedAt: null,
    updatedAt,
  };
}

function makeUserFile(overrides: Partial<UserFile> = {}): UserFile {
  return {
    id: "file_1",
    userId: "usr_1",
    conversationId: "conv_1",
    status: "ready",
    contentHash: "hash_1",
    fileType: "image",
    fileName: "mock.png",
    mimeType: "image/png",
    fileSize: 42,
    metadata: { assetKind: "image" },
    createdAt: "2026-04-28T10:03:00.000Z",
    ...overrides,
  };
}

function makeMemory(overrides: Partial<RelationshipMemoryRecord> = {}): RelationshipMemoryRecord {
  return {
    id: "mem_1",
    userId: "usr_1",
    conversationId: "conv_1",
    memoryType: "goal",
    summary: "Close the opportunity",
    evidenceRefs: [],
    status: "active",
    confidence: 0.8,
    createdAt: "2026-04-28T10:04:00.000Z",
    updatedAt: "2026-04-28T10:04:00.000Z",
    ...overrides,
  };
}

function makePromptBinding(overrides: Partial<PromptBinding> = {}): PromptBinding {
  return {
    id: "pb_1",
    userId: "usr_1",
    conversationId: "conv_1",
    surface: "chat_stream",
    targetKind: "message",
    targetId: "msg_1",
    sourcePromptBindingId: null,
    effectiveHash: "hash_1",
    slotRefs: [],
    overlayRefs: [],
    requestRefs: [],
    decisionSourceRefs: [],
    evidenceRefs: [],
    createdAt: "2026-04-28T10:05:00.000Z",
    ...overrides,
  };
}

describe("projectWorkspaceSnapshot", () => {
  it("projects active work, durable assets, and compact refs without transcript state", () => {
    const snapshot = projectWorkspaceSnapshot({
      conversation: makeConversation(),
      activeJobs: [
        makeJob("running", "2026-04-28T10:07:00.000Z"),
        makeJob("failed", "2026-04-28T10:08:00.000Z"),
      ],
      userFiles: [
        makeUserFile({ id: "file_media" }),
        makeUserFile({
          id: "file_doc",
          fileType: "document",
          fileName: "notes.pdf",
          mimeType: "application/pdf",
          metadata: {},
          createdAt: "2026-04-28T10:06:00.000Z",
        }),
      ],
      workflowContext: {
        id: "bwc_conv_1",
        userId: "usr_1",
        conversationId: "conv_1",
        primaryMode: "revenue",
        origin: null,
        relatedRefs: [{ kind: "lead", id: "lead_1", userId: null, conversationId: "conv_1", label: "Lead", status: "submitted" }],
        lifecycleRefs: [],
        notificationRefs: [],
        interruptedTurnRefs: [],
        healthRefs: [],
        recommendedAction: null,
        updatedAt: "2026-04-28T10:09:00.000Z",
      },
      operatorTransition: {
        id: "otp_usr_1",
        userId: "usr_1",
        conversationId: "conv_1",
        status: "sharing",
        operatorMode: "community_affiliate",
        expertiseRefs: [],
        audienceRefs: [],
        offerRefs: [],
        trustDistributionRef: "tdc_usr_1",
        recommendedAction: null,
        updatedAt: "2026-04-28T10:10:00.000Z",
      },
      trustDistribution: {
        id: "tdc_usr_1",
        userId: "usr_1",
        conversationId: "conv_1",
        referralCode: "ORDO-42",
        referralUrl: "/r/ORDO-42",
        qrCodeUrl: "/api/qr/ORDO-42",
        physicalShareAssets: [],
        introScripts: [],
        activeCampaignRefs: [],
        recentReferralRefs: [],
        recommendedAction: null,
        updatedAt: "2026-04-28T10:11:00.000Z",
      },
      activeMemory: [makeMemory()],
      promptBindings: [makePromptBinding()],
      materializationsByAssetId: new Map([
        ["file_media", makeMaterialization()],
      ]),
    });
    expect(snapshot.importantAssetRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: "file_media", kind: "image", producedByJobId: "job_materialized_1", materializationKey: "compose_media:key_1" }),
      expect.objectContaining({ assetId: "file_doc", kind: "document", producedByJobId: null, materializationKey: null }),
    ]));

    expect(snapshot.id).toBe("workspace:conv_1");
    expect(snapshot.currentObjective).toBe("Finish the customer follow-up");
    expect(snapshot.recommendedNextStep).toBe("Review the latest output");
    expect(snapshot.activeJobRefs).toEqual([
      expect.objectContaining({ status: "running", materializationKey: "mat_key_1" }),
    ]);
    expect(snapshot.importantAssetRefs.map((asset) => asset.kind)).toEqual(["image", "document"]);
    expect(snapshot.workflowContextRef).toBe("bwc_conv_1");
    expect(snapshot.operatorTransitionRef).toBe("otp_usr_1");
    expect(snapshot.trustDistributionRef).toBe("tdc_usr_1");
    expect(snapshot.relatedBusinessRefs).toEqual([
      expect.objectContaining({ kind: "lead", id: "lead_1" }),
    ]);
    expect(snapshot.latestMemoryRef).toBe("mem_1");
    expect(snapshot.latestPromptBindingRef).toBe("pb_1");
    expect(snapshot.updatedAt).toBe("2026-04-28T10:11:00.000Z");
  });

  it("projects deleted conversations deterministically", () => {
    const snapshot = projectWorkspaceSnapshot({
      conversation: makeConversation({
        status: "archived",
        deletedAt: "2026-04-28T10:12:00.000Z",
        routingSnapshot: createConversationRoutingSnapshot(),
      }),
      activeJobs: [],
      userFiles: [],
    });

    expect(snapshot.status).toBe("deleted");
    expect(snapshot.currentObjective).toBeNull();
    expect(snapshot.recommendedNextStep).toBeNull();
    expect(snapshot.updatedAt).toBe("2026-04-28T10:01:00.000Z");
  });
});
