import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { FactoryDataMapper } from "@/adapters/FactoryDataMapper";
import { ensureSchema } from "@/lib/db/schema";
import type { ProductBrief } from "@/core/entities/product-brief";
import type { ProductionDAG } from "@/core/entities/production-dag";
import type { WorkOrder } from "@/core/entities/work-order";
import { DAGPlanner } from "@/lib/factory/dag-planner";
import { ProductionOrchestrator } from "@/lib/factory/production-orchestrator";
import { StageExecutorRegistry } from "@/lib/factory/stage-executor-registry";
import { ResearchExecutor } from "@/lib/factory/stage-executors/research-executor";
import { DraftExecutor } from "@/lib/factory/stage-executors/draft-executor";
import { AssetGenerationExecutor } from "@/lib/factory/stage-executors/asset-generation-executor";
import { CompositionExecutor } from "@/lib/factory/stage-executors/composition-executor";
import { QAExecutor } from "@/lib/factory/stage-executors/qa-executor";
import { QAResolutionExecutor } from "@/lib/factory/stage-executors/qa-resolution-executor";
import { ReleaseExecutor } from "@/lib/factory/stage-executors/release-executor";

function requireValue<T>(value: T | null | undefined): T {
  expect(value).toBeTruthy();
  if (value == null) {
    throw new Error("Expected value to be present.");
  }
  return value;
}

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedUser(db: Database.Database, userId = "usr_factory") {
  db.prepare(
    `INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)`,
  ).run(userId, `${userId}@example.com`, "Factory User");
  db.prepare(
    `INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'role_authenticated')`,
  ).run(userId);
}

function seedConversation(db: Database.Database, conversationId = "conv_factory", userId = "usr_factory") {
  db.prepare(
    `INSERT OR IGNORE INTO conversations (id, user_id, title) VALUES (?, ?, 'Factory thread')`,
  ).run(conversationId, userId);
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

function createWorkOrder(brief: ProductBrief, dag: ProductionDAG, overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "wo_1",
    schemaVersion: 1,
    briefId: brief.id,
    status: "planned",
    currentDag: dag,
    stageRuns: [],
    executionLog: [],
    revision: 1,
    previousWorkOrderIds: [],
    createdAt: "2026-04-27T12:00:00.000Z",
    userId: "usr_factory",
    conversationId: "conv_factory",
    initiatedBy: "batch_automation",
    ...overrides,
  };
}

describe("ProductionOrchestrator", () => {
  let db: Database.Database;
  let mapper: FactoryDataMapper;

  beforeEach(() => {
    db = createDb();
    seedUser(db);
    seedConversation(db);
    mapper = new FactoryDataMapper(db);
  });

  it("executes the full happy path and persists outputs", async () => {
    const brief = createBrief();
    const dag = new DAGPlanner().generateDAG({
      brief,
      idGenerator: () => "dag_1",
      now: () => "2026-04-27T12:00:00.000Z",
    });
    await mapper.createWorkOrder(createWorkOrder(brief, dag));
    await mapper.saveProductionDAG("wo_1", dag);

    const progressUpdates: Array<{ progressPercent?: number | null; activePhaseKey?: string | null }> = [];
    const orchestrator = new ProductionOrchestrator({
      repository: mapper,
      executorRegistry: new StageExecutorRegistry([
        new ResearchExecutor({
          research: async () => ({
            summary: "Enough evidence was found.",
            confidenceScore: 0.9,
            sources: [{ id: "src_1", title: "Benchmarks", url: "https://example.com", retrievedAt: "2026-04-27T12:00:00.000Z", relevanceScore: 0.8 }],
            claims: [{ id: "claim_1", text: "Email converts well.", supportingSourceIds: ["src_1"], confidence: 0.7 }],
            searchEngine: "hybrid",
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
        new CompositionExecutor({
          compose: async () => ({ htmlContent: "<main>launch</main>" }),
        }),
        new QAExecutor(),
        new QAResolutionExecutor(),
        new ReleaseExecutor({
          publish: async ({ compositionId }) => ({
            publishedDestinations: [{ channel: "blog", url: `https://example.com/blog/${compositionId}` }],
          }),
        }),
      ]),
      now: (() => {
        let index = 0;
        return () => `2026-04-27T12:00:${String(index++).padStart(2, "0")}.000Z`;
      })(),
      idGenerator: (() => {
        let index = 0;
        return () => `id_${++index}`;
      })(),
      reportProgress: async (update) => {
        progressUpdates.push({
          progressPercent: update.progressPercent,
          activePhaseKey: update.activePhaseKey,
        });
      },
    });

    const workOrder = await orchestrator.execute({ workOrderId: "wo_1", brief });
    const outputs = await mapper.listOutputsForWorkOrder("wo_1");

    expect(workOrder.status).toBe("succeeded");
    expect(outputs.map((output) => output.entityKind).sort()).toEqual([
      "asset",
      "asset",
      "composition",
      "draft",
      "research_packet",
      "qa_report",
      "qa_report",
      "qa_report",
      "release",
    ].sort());
    expect(await mapper.findLatestActiveCheckpoint("wo_1")).toBeNull();
    expect(progressUpdates.at(-1)?.progressPercent).toBe(100);
    expect(progressUpdates.some((update) => update.activePhaseKey === "release")).toBe(true);
  });

  it("retries a transient failure once and then succeeds", async () => {
    const brief = createBrief();
    const dag = new DAGPlanner().generateDAG({ brief, idGenerator: () => "dag_1" });
    await mapper.createWorkOrder(createWorkOrder(brief, dag));
    await mapper.saveProductionDAG("wo_1", dag);

    let chartAttempts = 0;
    const orchestrator = new ProductionOrchestrator({
      repository: mapper,
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
          chart: async () => {
            chartAttempts += 1;
            if (chartAttempts === 1) {
              throw new Error("Temporary network timeout while generating chart asset.");
            }
            return { uri: "/chart.png", mimeType: "image/png", fileSizeBytes: 2048, qaStatus: "passed", qaFindings: [] };
          },
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
    });

    const workOrder = await orchestrator.execute({ workOrderId: "wo_1", brief });
    const stageRuns = await mapper.listStageRunsForWorkOrder("wo_1");
    const chartRun = requireValue(stageRuns.find((stageRun) => stageRun.stageKey === "asset_chart_primary"));

    expect(workOrder.status).toBe("succeeded");
    expect(chartRun.attemptCount).toBe(2);
    expect(chartAttempts).toBe(2);
  });

  it("pauses and checkpoints when a stage fails terminally", async () => {
    const brief = createBrief({ executionPreferences: { autoRetryOnFailure: true, parallelizeAssets: true, maxAssetCount: 3 } });
    const dag = new DAGPlanner().generateDAG({ brief, idGenerator: () => "dag_1" });
    await mapper.createWorkOrder(createWorkOrder(brief, dag));
    await mapper.saveProductionDAG("wo_1", dag);

    const orchestrator = new ProductionOrchestrator({
      repository: mapper,
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
          chart: async () => {
            throw new Error("Required chart data is missing for this brief.");
          },
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
    });

    const workOrder = await orchestrator.execute({ workOrderId: "wo_1", brief });
    const checkpoint = requireValue(await mapper.findLatestActiveCheckpoint("wo_1"));
    const stageRuns = await mapper.listStageRunsForWorkOrder("wo_1");
    const chartRun = requireValue(stageRuns.find((stageRun) => stageRun.stageKey === "asset_chart_primary"));

    expect(workOrder.status).toBe("paused");
    expect(workOrder.pausedState?.resumeFromStageKey).toBe("asset_chart_primary");
    expect(checkpoint.resumeFromStageKey).toBe("asset_chart_primary");
    expect(chartRun.status).toBe("failed");
  });
});
