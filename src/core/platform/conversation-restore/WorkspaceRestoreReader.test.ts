import { describe, expect, it, vi } from "vitest";

import type { Message } from "@/core/entities/conversation";
import type { WorkspaceSnapshot } from "@/core/entities/conversation-workspace";
import type { MessageRepository } from "@/core/use-cases/MessageRepository";
import type { WorkspaceSnapshotReader } from "@/core/use-cases/WorkspaceSnapshotRepository";
import type { JobStatusQuery } from "@/core/use-cases/JobStatusQuery";
import type { BusinessWorkflowContextReader } from "@/core/use-cases/BusinessWorkflowContextRepository";
import type { OperatorTransitionReader } from "@/core/use-cases/OperatorTransitionRepository";
import type { RelationshipMemoryReader } from "@/core/use-cases/RelationshipMemoryRepository";
import type { TrustDistributionReader } from "@/core/use-cases/TrustDistributionRepository";
import type { AssetCatalogReader } from "@/core/use-cases/AssetCatalogReader";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";

import { RepositoryBackedWorkspaceRestoreReader } from "./WorkspaceRestoreReader";

function makeWorkspace(overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  return {
    id: "workspace:conv_1",
    userId: "usr_1",
    conversationId: "conv_1",
    status: "active",
    title: "Workspace",
    currentObjective: "Keep momentum",
    recommendedNextStep: "Review the queue",
    openLoops: [],
    activeJobRefs: [],
    importantAssetRefs: [
      {
        assetId: "file_1",
        kind: "image",
        status: "ready",
        producedByJobId: null,
        materializationKey: null,
        updatedAt: "2026-04-28T20:59:00.000Z",
      },
    ],
    workflowContextRef: "bwc_conv_1",
    operatorTransitionRef: "otp_usr_1",
    trustDistributionRef: "tdc_usr_1",
    relatedBusinessRefs: [],
    latestMemoryRef: null,
    latestPromptBindingRef: null,
    updatedAt: "2026-04-28T21:00:00.000Z",
    ...overrides,
  };
}

function makeMessage(id: string): Message {
  return {
    id,
    conversationId: "conv_1",
    role: "assistant",
    content: `Message ${id}`,
    parts: [],
    createdAt: "2026-04-28T21:00:00.000Z",
    tokenEstimate: 10,
  };
}

function makePendingComposeMessage(): Message {
  return {
    id: "msg_compose",
    conversationId: "conv_1",
    role: "assistant",
    content: "Composing media",
    parts: [
      {
        type: "tool_call",
        name: "compose_media",
        toolInvocationId: "toolu_compose_1",
        args: {
          plan: {
            id: "plan_1",
            outputFormat: "mp4",
            resolution: { width: 720, height: 1280 },
          },
        },
      },
      {
        type: "tool_result",
        name: "compose_media",
        toolInvocationId: "toolu_compose_1",
        result: {
          generationStatus: "client_fetch_pending",
          route: "browser_wasm",
          outputFormat: "mp4",
          resolution: { width: 720, height: 1280 },
        },
      },
    ],
    createdAt: "2026-04-28T21:00:00.000Z",
    tokenEstimate: 10,
  };
}

function makeJobSnapshot(overrides: Partial<CanonicalJobSnapshot> = {}): CanonicalJobSnapshot {
  return {
    jobId: "job_1",
    conversationId: "conv_1",
    userId: "usr_1",
    toolName: "compose_media",
    label: "Compose",
    status: "queued",
    sequence: 1,
    createdAt: "2026-04-28T21:00:00.000Z",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-04-28T21:00:00.000Z",
    origin: { fallback: "job_created_at" },
    inputSnapshot: {},
    resultEnvelope: null,
    artifactRefs: [],
    materializationRefs: [],
    ownership: {
      userId: "usr_1",
      visibility: "owner",
      initiatorType: "user",
    },
    failure: {
      failureClass: null,
      recoveryMode: null,
      nextRetryAt: null,
      lastCheckpointId: null,
      replayedFromJobId: null,
      supersededByJobId: null,
    },
    ...overrides,
  };
}

describe("RepositoryBackedWorkspaceRestoreReader", () => {
  it("returns an empty payload when the user has no active workspace", async () => {
    const reader = new RepositoryBackedWorkspaceRestoreReader({
      workspaceSnapshotReader: {
        findActiveByUser: vi.fn().mockResolvedValue(null),
      } as unknown as WorkspaceSnapshotReader,
      jobStatusQuery: {} as JobStatusQuery,
      messageRepository: {} as MessageRepository,
    });

    const payload = await reader.findActiveByUser("usr_missing");

    expect(payload.workspace).toBeNull();
    expect(payload.activeJobs).toEqual([]);
    expect(payload.reusableMediaAssets).toEqual([]);
    expect(payload.recentTranscript).toEqual([]);
  });

  it("includes latest migration status even when no active workspace exists yet", async () => {
    const findLatestForTargetIdentity = vi.fn().mockResolvedValue({
      id: "idmig_1",
      sourceUserId: "anon_seed",
      targetUserId: "usr_missing",
      migratedConversationIds: ["conv_1"],
      migratedJobIds: [],
      migratedAssetIds: [],
      repairedMemoryRefs: [],
      repairedSearchSourceIds: [],
      objectCounts: [],
      repairRefs: [],
      status: "completed",
      currentStage: "completed",
      failureMessage: null,
      createdAt: "2026-04-28T20:59:00.000Z",
      completedAt: "2026-04-28T21:00:00.000Z",
    });
    const reader = new RepositoryBackedWorkspaceRestoreReader({
      workspaceSnapshotReader: {
        findActiveByUser: vi.fn().mockResolvedValue(null),
      } as unknown as WorkspaceSnapshotReader,
      jobStatusQuery: {} as JobStatusQuery,
      messageRepository: {} as MessageRepository,
      identityMigrationReader: {
        findById: vi.fn(),
        findLatestForSourceIdentity: vi.fn(),
        findLatestForTargetIdentity,
      },
    });

    const payload = await reader.findActiveByUser("usr_missing");

    expect(findLatestForTargetIdentity).toHaveBeenCalledWith("usr_missing");
    expect(payload.migration).toEqual(expect.objectContaining({ id: "idmig_1", status: "completed" }));
  });

  it("hydrates a durable restore payload from the workspace identity", async () => {
    const listConversationJobSnapshots = vi
      .fn()
      .mockResolvedValueOnce([makeJobSnapshot()])
      .mockResolvedValueOnce([
        makeJobSnapshot({
          jobId: "job_2",
          status: "failed",
          sequence: 2,
          updatedAt: "2026-04-28T21:00:01.000Z",
          failure: {
            failureClass: "transient",
            recoveryMode: "rerun",
            nextRetryAt: null,
            lastCheckpointId: null,
            replayedFromJobId: null,
            supersededByJobId: null,
          },
        }),
      ]);

    const reader = new RepositoryBackedWorkspaceRestoreReader({
      workspaceSnapshotReader: {
        findActiveByUser: vi.fn().mockResolvedValue(makeWorkspace()),
      } as unknown as WorkspaceSnapshotReader,
      jobStatusQuery: {
        listConversationJobSnapshots,
      } as unknown as JobStatusQuery,
      messageRepository: {
        listRecentByConversation: vi.fn().mockResolvedValue([makeMessage("msg_1")]),
      } as unknown as MessageRepository,
      assetCatalogReader: {
        listReusableMediaAssets: vi.fn().mockResolvedValue([
          {
            assetId: "file_audio_1",
            kind: "audio",
            ownerUserId: "usr_1",
            sourceType: "user_file",
            status: "ready",
            label: "voiceover.mp3",
            fileName: "voiceover.mp3",
            mimeType: "audio/mpeg",
            source: "generated",
            retentionClass: "conversation",
            createdAt: "2026-04-28T20:59:00.000Z",
            updatedAt: "2026-04-28T20:59:00.000Z",
            conversationId: "conv_1",
            producedByJobId: "job_audio_1",
            materializationKey: "generate_audio:key_1",
            toolName: "generate_audio",
            durationSeconds: 12,
          },
        ]),
      } as unknown as AssetCatalogReader,
      workflowReader: {
        findByConversationId: vi.fn().mockResolvedValue({ id: "bwc_conv_1", userId: "usr_1", conversationId: "conv_1", primaryMode: "revenue", origin: null, relatedRefs: [], lifecycleRefs: [], notificationRefs: [], interruptedTurnRefs: [], healthRefs: [], recommendedAction: null, updatedAt: "2026-04-28T21:00:00.000Z" }),
      } as unknown as BusinessWorkflowContextReader,
      operatorTransitionReader: {
        findByConversationId: vi.fn().mockResolvedValue({ id: "otp_usr_1", userId: "usr_1", conversationId: "conv_1", status: "sharing", operatorMode: "community_affiliate", expertiseRefs: [], audienceRefs: [], offerRefs: [], trustDistributionRef: "tdc_usr_1", recommendedAction: null, updatedAt: "2026-04-28T21:00:00.000Z" }),
      } as unknown as OperatorTransitionReader,
      trustDistributionReader: {
        findByConversationId: vi.fn().mockResolvedValue({ id: "tdc_usr_1", userId: "usr_1", conversationId: "conv_1", referralCode: "ORDO-42", referralUrl: "/r/ORDO-42", qrCodeUrl: "/api/qr/ORDO-42", physicalShareAssets: [], introScripts: [], activeCampaignRefs: [], recentReferralRefs: [], recommendedAction: null, updatedAt: "2026-04-28T21:00:00.000Z" }),
      } as unknown as TrustDistributionReader,
      relationshipMemoryReader: {
        listActiveByConversation: vi.fn().mockResolvedValue([
          { id: "mem_2", userId: "usr_1", conversationId: "conv_1", memoryType: "goal", summary: "Latest", evidenceRefs: [], status: "active", confidence: 0.9, createdAt: "2026-04-28T20:00:00.000Z", updatedAt: "2026-04-28T21:00:00.000Z" },
        ]),
      } as unknown as RelationshipMemoryReader,
    });

    const payload = await reader.findActiveByUser("usr_1");

    expect(payload.workspace?.id).toBe("workspace:conv_1");
    expect(payload.assets).toEqual([
      expect.objectContaining({ assetId: "file_1", kind: "image" }),
    ]);
    expect(payload.reusableMediaAssets).toEqual([
      expect.objectContaining({
        assetId: "file_audio_1",
        assetKind: "audio",
        producedByJobId: "job_audio_1",
        materializationKey: "generate_audio:key_1",
      }),
    ]);
    expect(payload.activeJobs).toHaveLength(1);
    expect(payload.attentionNeededJobs).toHaveLength(1);
    expect(payload.workflow).toEqual(expect.objectContaining({ id: "bwc_conv_1" }));
    expect(payload.operatorTransition).toEqual(expect.objectContaining({ id: "otp_usr_1" }));
    expect(payload.trustDistribution).toEqual(expect.objectContaining({ id: "tdc_usr_1" }));
    expect(payload.memory).toEqual(expect.objectContaining({ id: "mem_2" }));
    expect(payload.recentTranscript).toEqual([expect.objectContaining({ id: "msg_1" })]);
  });

  it("rejects by-id restore when the workspace is owned by another user", async () => {
    const reader = new RepositoryBackedWorkspaceRestoreReader({
      workspaceSnapshotReader: {
        findByConversationId: vi.fn().mockResolvedValue(makeWorkspace({ userId: "usr_other" })),
      } as unknown as WorkspaceSnapshotReader,
      jobStatusQuery: {} as JobStatusQuery,
      messageRepository: {} as MessageRepository,
    });

    await expect(reader.findByConversationId("usr_1", "conv_1")).resolves.toBeNull();
  });

  it("degrades gracefully when optional restore enrichment readers fail", async () => {
    const reader = new RepositoryBackedWorkspaceRestoreReader({
      workspaceSnapshotReader: {
        findActiveByUser: vi.fn().mockResolvedValue(makeWorkspace()),
      } as unknown as WorkspaceSnapshotReader,
      jobStatusQuery: {
        listConversationJobSnapshots: vi.fn().mockResolvedValue([]),
      } as unknown as JobStatusQuery,
      messageRepository: {
        listRecentByConversation: vi.fn().mockResolvedValue([makeMessage("msg_1")]),
      } as unknown as MessageRepository,
      workflowReader: {
        findByConversationId: vi.fn().mockRejectedValue(new Error("workflow unavailable")),
      } as unknown as BusinessWorkflowContextReader,
      operatorTransitionReader: {
        findByConversationId: vi.fn().mockRejectedValue(new Error("operator unavailable")),
      } as unknown as OperatorTransitionReader,
      trustDistributionReader: {
        findByConversationId: vi.fn().mockRejectedValue(new Error("trust unavailable")),
      } as unknown as TrustDistributionReader,
      relationshipMemoryReader: {
        listActiveByConversation: vi.fn().mockRejectedValue(new Error("memory unavailable")),
      } as unknown as RelationshipMemoryReader,
    });

    await expect(reader.findActiveByUser("usr_1")).resolves.toEqual(
      expect.objectContaining({
        workspace: expect.objectContaining({ id: "workspace:conv_1" }),
        workflow: null,
        operatorTransition: null,
        trustDistribution: null,
        memory: null,
        recentTranscript: [expect.objectContaining({ id: "msg_1" })],
      }),
    );
  });

  it("does not mutate restored compose media transcript results", async () => {
    const message = makePendingComposeMessage();
    const reader = new RepositoryBackedWorkspaceRestoreReader({
      workspaceSnapshotReader: {
        findActiveByUser: vi.fn().mockResolvedValue(makeWorkspace()),
      } as unknown as WorkspaceSnapshotReader,
      jobStatusQuery: {
        listConversationJobSnapshots: vi.fn().mockResolvedValue([]),
      } as unknown as JobStatusQuery,
      messageRepository: {
        listRecentByConversation: vi.fn().mockResolvedValue([message]),
      } as unknown as MessageRepository,
    });

    const payload = await reader.findActiveByUser("usr_1");

    expect(payload.recentTranscript[0]?.parts[1]).toEqual(message.parts[1]);
  });
});
