import { beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";

import { ConversationDataMapper } from "@/adapters/ConversationDataMapper";
import { ConversationEventDataMapper } from "@/adapters/ConversationEventDataMapper";
import { MessageDataMapper } from "@/adapters/MessageDataMapper";
import { PromptBindingDataMapper } from "@/adapters/PromptBindingDataMapper";
import { RelationshipMemoryDataMapper } from "@/adapters/RelationshipMemoryDataMapper";
import { createRelationshipMemoryProjectionService } from "@/core/platform/relationship-memory/RelationshipMemoryProjectionService";
import { RepositoryBackedWorkspaceRestoreReader } from "@/core/platform/conversation-restore/WorkspaceRestoreReader";
import { RepositoryBackedWorkspaceSnapshotReader } from "@/core/platform/conversation-workspace/WorkspaceSnapshotReader";
import type { AssetCatalogReader } from "@/core/use-cases/AssetCatalogReader";
import type { JobStatusQuery } from "@/core/use-cases/JobStatusQuery";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import { ensureSchema } from "@/lib/db/schema";

import { ConversationEventRecorder } from "./ConversationEventRecorder";
import { ConversationInteractor } from "./ConversationInteractor";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedUser(db: Database.Database): void {
  db.prepare(`INSERT OR IGNORE INTO roles (id, name) VALUES ('role_authenticated', 'authenticated')`).run();
  db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES ('usr_test', 'test@example.com', 'Test User')`).run();
  db.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('usr_test', 'role_authenticated')`).run();
}

describe("ConversationInteractor relationship memory projection", () => {
  let db: Database.Database;
  let conversationRepo: ConversationDataMapper;
  let messageRepo: MessageDataMapper;
  let relationshipMemoryRepo: RelationshipMemoryDataMapper;
  let promptBindingRepo: PromptBindingDataMapper;
  let interactor: ConversationInteractor;

  beforeEach(async () => {
    db = createDb();
    seedUser(db);

    conversationRepo = new ConversationDataMapper(db);
    messageRepo = new MessageDataMapper(db);
    relationshipMemoryRepo = new RelationshipMemoryDataMapper(db);
    promptBindingRepo = new PromptBindingDataMapper(db);
    const eventRecorder = new ConversationEventRecorder(new ConversationEventDataMapper(db));
    const relationshipMemoryProjectionService = createRelationshipMemoryProjectionService({
      messageRepository: messageRepo,
      relationshipMemoryRepository: relationshipMemoryRepo,
      promptBindingRepository: promptBindingRepo,
    });

    interactor = new ConversationInteractor(
      conversationRepo,
      messageRepo,
      eventRecorder,
      undefined,
      relationshipMemoryProjectionService,
    );

    await conversationRepo.create({ id: "conv_1", userId: "usr_test", title: "Phase 6" });
  });

  it("projects canonical memory on append and exposes it through workspace restore", async () => {
    await interactor.appendMessage(
      {
        conversationId: "conv_1",
        role: "user",
        content: "I want to launch the new offer. I prefer short videos. Can you review the outline?",
        parts: [],
      },
      "usr_test",
    );

    await promptBindingRepo.record({
      id: "pb_root",
      userId: "usr_test",
      conversationId: "conv_1",
      surface: "chat_stream",
      targetKind: "message",
      targetId: "msg_user_prompt",
      sourcePromptBindingId: null,
      effectiveHash: "hash_prompt_root",
      slotRefs: [],
      overlayRefs: [],
      decisionSourceRefs: [],
      evidenceRefs: [],
      createdAt: "2026-04-29T10:01:00.000Z",
    });

    await interactor.appendMessage(
      {
        conversationId: "conv_1",
        role: "user",
        content: "I don't care about short videos anymore. I've decided to start with a worksheet.",
        parts: [],
      },
      "usr_test",
      { sourcePromptBindingId: "pb_root" },
    );

    await interactor.appendMessage(
      {
        conversationId: "conv_1",
        role: "assistant",
        content: "The media is ready.",
        parts: [
          {
            type: "job_status",
            jobId: "job_1",
            toolName: "compose_media",
            label: "Compose media",
            status: "succeeded",
            summary: "Final promo video ready",
            updatedAt: "2026-04-29T10:10:00.000Z",
            resultPayload: {
              assetId: "file_video_1",
              title: "Final promo video",
              assetKind: "video",
            },
          },
          {
            type: "attachment",
            assetId: "file_video_1",
            fileName: "promo-final.mp4",
            mimeType: "video/mp4",
            fileSize: 1200,
            assetKind: "video",
          },
        ],
      },
      "usr_test",
    );

    const activeMemory = await relationshipMemoryRepo.listActiveByConversation("conv_1");
    expect(activeMemory.map((record) => record.memoryType)).toEqual(["milestone", "asset_context", "decision", "goal", "open_question"]);
    expect(activeMemory.find((record) => record.memoryType === "decision")).toEqual(
      expect.objectContaining({ summary: "Decision: start with a worksheet" }),
    );
    expect(activeMemory.find((record) => record.memoryType === "milestone")).toEqual(
      expect.objectContaining({ summary: "Milestone: compose_media succeeded - Final promo video ready" }),
    );
    expect(activeMemory.find((record) => record.memoryType === "asset_context")).toEqual(
      expect.objectContaining({ summary: "Asset context: promo-final.mp4 (video asset file_video_1)" }),
    );
    const decisionMemory = activeMemory.find((record) => record.memoryType === "decision");
    expect(decisionMemory).toBeDefined();
    expect(await promptBindingRepo.findByTarget("relationship_memory", decisionMemory?.id ?? "")).toEqual(
      expect.objectContaining({
        surface: "memory_projection",
        sourcePromptBindingId: "pb_root",
      }),
    );

    const workspaceReader = new RepositoryBackedWorkspaceSnapshotReader({
      conversationRepository: conversationRepo,
      jobQueueRepository: {
        listJobsByConversation: vi.fn().mockResolvedValue([]),
      } as unknown as JobQueueRepository,
      assetCatalogReader: {
        listConversationAssets: vi.fn().mockResolvedValue([]),
        listReusableMediaAssets: vi.fn().mockResolvedValue([]),
        findByAssetId: vi.fn().mockResolvedValue(null),
      } as unknown as AssetCatalogReader,
      relationshipMemoryReader: relationshipMemoryRepo,
    });
    const workspace = await workspaceReader.findActiveByUser("usr_test");

    expect(workspace?.latestMemoryRef).toBe(activeMemory[0]?.id ?? null);

    const restoreReader = new RepositoryBackedWorkspaceRestoreReader({
      workspaceSnapshotReader: workspaceReader,
      jobStatusQuery: {
        listConversationJobSnapshots: vi.fn().mockResolvedValue([]),
      } as unknown as JobStatusQuery,
      messageRepository: messageRepo,
      relationshipMemoryReader: relationshipMemoryRepo,
    });
    const restorePayload = await restoreReader.findActiveByUser("usr_test");

    expect(restorePayload.memory).toEqual(
      expect.objectContaining({
        id: activeMemory[0]?.id,
        summary: "Milestone: compose_media succeeded - Final promo video ready",
      }),
    );
  });
});