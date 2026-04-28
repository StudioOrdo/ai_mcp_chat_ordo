import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { FactoryDataMapper } from "@/adapters/FactoryDataMapper";
import type { JobRequest } from "@/core/entities/job";
import type { ProductBrief } from "@/core/entities/product-brief";
import { ensureSchema } from "@/lib/db/schema";
import { DAGPlanner } from "@/lib/factory/dag-planner";
import { ProduceProductDeferredJobHandler } from "@/lib/factory/produce-product-deferred-job";
import { ProductionOrchestrator } from "@/lib/factory/production-orchestrator";
import { StageExecutorRegistry } from "@/lib/factory/stage-executor-registry";
import { AssetGenerationExecutor } from "@/lib/factory/stage-executors/asset-generation-executor";
import { CompositionExecutor } from "@/lib/factory/stage-executors/composition-executor";
import { DraftExecutor } from "@/lib/factory/stage-executors/draft-executor";
import { QAExecutor } from "@/lib/factory/stage-executors/qa-executor";
import { QAResolutionExecutor } from "@/lib/factory/stage-executors/qa-resolution-executor";
import { ReleaseExecutor } from "@/lib/factory/stage-executors/release-executor";
import { ResearchExecutor } from "@/lib/factory/stage-executors/research-executor";

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedUser(db: Database.Database, userId = "usr_factory") {
  db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)`).run(userId, `${userId}@example.com`, "Factory User");
  db.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'role_authenticated')`).run(userId);
}

function seedConversation(db: Database.Database, conversationId = "conv_factory", userId = "usr_factory") {
  db.prepare(`INSERT OR IGNORE INTO conversations (id, user_id, title) VALUES (?, ?, 'Factory thread')`).run(conversationId, userId);
}

function createBrief(overrides: Partial<ProductBrief> = {}): ProductBrief {
  return {
    id: "brief_1",
    schemaVersion: 1,
    title: "Factory launch page",
    topic: "Launching a solopreneur product",
    description: "A launch campaign for a digital product.",
    assetKinds: ["chart", "audio"],
    qaCriteria: ["accuracy", "accessibility"],
    targetChannels: ["blog"],
    executionPreferences: {
      autoRetryOnFailure: true,
      parallelizeAssets: true,
      maxAssetCount: 3,
    },
    createdAt: "2026-04-27T12:00:00.000Z",
    createdBy: "user_1",
    ...overrides,
  };
}

function createJob(brief: ProductBrief): JobRequest {
  return {
    id: "job_1",
    conversationId: "conv_factory",
    userId: "usr_factory",
    toolName: "produce_product",
    status: "queued",
    priority: 100,
    dedupeKey: null,
    initiatorType: "user",
    requestPayload: { brief },
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
    createdAt: "2026-04-27T12:00:00.000Z",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-04-27T12:00:00.000Z",
  };
}

describe("ProduceProductDeferredJobHandler", () => {
  it("creates a work order, persists the DAG, and returns final output ids", async () => {
    const db = createDb();
    seedUser(db);
    seedConversation(db);
    const repository = new FactoryDataMapper(db);
    const brief = createBrief();
    const progressUpdates: Array<{ progressPercent?: number | null; activePhaseKey?: string | null }> = [];
    const orchestrator = new ProductionOrchestrator({
      repository,
      executorRegistry: new StageExecutorRegistry([
        new ResearchExecutor({
          research: async () => ({
            summary: "Enough evidence was found.",
            confidenceScore: 0.9,
            sources: [{ id: "src_1", title: "Benchmarks", url: "https://example.com", retrievedAt: "2026-04-27T12:00:00.000Z", relevanceScore: 0.8 }],
            claims: [{ id: "claim_1", text: "Email converts well.", supportingSourceIds: ["src_1"], confidence: 0.7 }],
          }),
        }),
        new DraftExecutor({
          compose: async () => ({
            sections: [
              { id: "d1", kind: "heading", order: 0, text: "Launch", level: 1 },
              { id: "d2", kind: "paragraph", order: 1, text: "Build with owned channels." },
            ],
          }),
        }),
        new AssetGenerationExecutor({
          chart: async () => ({ uri: "/chart.png", mimeType: "image/png", fileSizeBytes: 2048, qaStatus: "passed", qaFindings: [] }),
          audio: async () => ({ uri: "/audio.mp3", mimeType: "audio/mpeg", fileSizeBytes: 4096, qaStatus: "passed", qaFindings: [] }),
        }),
        new CompositionExecutor({ compose: async () => ({ htmlContent: "<main>launch</main>" }) }),
        new QAExecutor(),
        new QAResolutionExecutor(),
        new ReleaseExecutor({ publish: async ({ compositionId }) => ({ publishedDestinations: [{ channel: "blog", url: `https://example.com/blog/${compositionId}` }] }) }),
      ]),
      idGenerator: (() => {
        let index = 0;
        return () => `id_${++index}`;
      })(),
      reportProgress: async (update) => {
        progressUpdates.push({ progressPercent: update.progressPercent, activePhaseKey: update.activePhaseKey });
      },
    });

    const handler = new ProduceProductDeferredJobHandler({
      planner: new DAGPlanner(),
      orchestrator,
      repository,
      idGenerator: (() => {
        let index = 100;
        return () => `job_${++index}`;
      })(),
    });

    const result = await handler.handle(createJob(brief), {
      abortSignal: new AbortController().signal,
      reportProgress: async (update) => {
        progressUpdates.push({ progressPercent: update.progressPercent, activePhaseKey: update.activePhaseKey });
      },
    });

    const workOrder = await repository.findWorkOrderById(result.workOrderId);
    const dag = await repository.findCurrentProductionDAGForWorkOrder(result.workOrderId);

    expect(workOrder?.status).toBe("succeeded");
    expect(dag?.briefId).toBe(brief.id);
    expect(result.outputIds.length).toBeGreaterThanOrEqual(1);
    expect(result.releaseId).toMatch(/^release_/);
    expect(result.compositionId).toMatch(/^composition_/);
    expect(progressUpdates.at(-1)?.progressPercent).toBe(100);
  });
});