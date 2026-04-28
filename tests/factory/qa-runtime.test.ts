import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import type { Composition } from "@/core/entities/composition";
import type { FactoryAsset } from "@/core/entities/factory-asset";
import type { ProductBrief } from "@/core/entities/product-brief";
import type { ProductionDAG } from "@/core/entities/production-dag";
import type { QAReport } from "@/core/entities/qa-report";
import type { WorkOrder } from "@/core/entities/work-order";
import { FactoryDataMapper } from "@/adapters/FactoryDataMapper";
import { ensureSchema } from "@/lib/db/schema";
import { DAGPlanner } from "@/lib/factory/dag-planner";
import { createFactoryQACheckRegistry } from "@/lib/factory/factory-qa-root";
import { ProductionOrchestrator } from "@/lib/factory/production-orchestrator";
import { QARemediator } from "@/lib/factory/qa-remediation";
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
    id: "brief_phase4",
    schemaVersion: 1,
    title: "Factory launch page",
    topic: "Launching a solopreneur product",
    description: "A launch campaign for a digital product.",
    assetKinds: ["image", "chart"],
    qaCriteria: ["accuracy", "completeness", "accessibility"],
    targetChannels: ["web", "email"],
    executionPreferences: {
      autoRetryOnFailure: true,
      parallelizeAssets: false,
      maxAssetCount: 2,
    },
    createdAt: "2026-04-27T12:00:00.000Z",
    createdBy: "user_1",
    tone: "precise",
    ...overrides,
  };
}

function createAsset(id: string, kind: FactoryAsset["kind"], generationParams: Record<string, unknown> = {}): FactoryAsset {
  return {
    id,
    schemaVersion: 1,
    workOrderId: "wo_phase4",
    kind,
    uri: `/api/user-files/${id}`,
    generationParams,
    generatedAt: "2026-04-27T12:01:00.000Z",
    provenance: { stageKey: `asset_${kind}_primary` },
    qaStatus: "passed",
    qaFindings: [],
    revision: 1,
  };
}

function createComposition(assetIds: readonly string[], htmlContent?: string): Composition {
  return {
    id: "composition_phase4",
    schemaVersion: 1,
    workOrderId: "wo_phase4",
    title: "Factory launch page",
    sections: [
      { id: "c1", kind: "heading", order: 0, text: "Launch", level: 1 },
      { id: "c2", kind: "image", order: 1, assetId: assetIds[0], caption: "Hero" },
      { id: "c3", kind: "chart", order: 2, assetId: assetIds[1], caption: "Proof" },
    ],
    embeddedAssetIds: [...assetIds],
    htmlContent,
    metadata: { targetChannel: "web" },
    provenance: { draftId: "draft_phase4", assetIds: [...assetIds] },
    createdAt: "2026-04-27T12:02:00.000Z",
    revision: 1,
  };
}

function createWorkOrder(brief: ProductBrief, dag: ProductionDAG, overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "wo_phase4",
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

describe("Phase 4 QA runtime", () => {
  it("auto-remediates missing alt text and materializes a corrected composition", async () => {
    const remediator = new QARemediator(createFactoryQACheckRegistry(), {
      now: (() => {
        let index = 10;
        return () => `2026-04-27T12:00:${String(index++).padStart(2, "0")}.000Z`;
      })(),
      idGenerator: (() => {
        let index = 0;
        return () => `fix_${++index}`;
      })(),
    });
    const brief = createBrief();
    const imageAsset = createAsset("asset_image_1", "image", { assetKind: "image", assetSlot: "hero" });
    const chartAsset = createAsset("asset_chart_1", "chart", {
      assetKind: "chart",
      assetSlot: "proof",
      summary: "Chart summarizing launch performance.",
      validationStatus: "valid",
    });
    const composition = createComposition([imageAsset.id, chartAsset.id]);

    const result = await remediator.remediate({
      brief,
      workOrderId: "wo_phase4",
      assets: [imageAsset, chartAsset],
      composition,
    });

    expect(result.finalReport.status).toBe("passed");
    expect(result.supplementalOutputs.map((output) => output.entityKind)).toEqual(["asset", "composition"]);

    const correctedAsset = result.supplementalOutputs[0]?.entity as FactoryAsset;
    const correctedComposition = result.supplementalOutputs[1]?.entity as Composition;

    expect(correctedAsset.provenance.previousAssetId).toBe(imageAsset.id);
    expect(correctedAsset.generationParams.altText).toBe("Factory launch page image");
    expect(correctedComposition.supersedesEntityId).toBeUndefined();
    expect(correctedComposition.embeddedAssetIds).toContain(correctedAsset.id);
    expect(correctedComposition.htmlContent).toContain("<figure");
    expect(result.assetReport.assetReports.find((report) => report.assetId === correctedAsset.id)?.status).toBe("passed");
    expect(result.pageReport.pageFindings).toEqual([]);
  });

  it("persists remediation outputs before qa_resolution and releases the corrected composition", async () => {
    const db = createDb();
    seedUser(db);
    seedConversation(db);
    const mapper = new FactoryDataMapper(db);
    const brief = createBrief();
    const dag = new DAGPlanner().generateDAG({
      brief,
      idGenerator: () => "dag_phase4",
      now: () => "2026-04-27T12:00:00.000Z",
    });

    await mapper.createWorkOrder(createWorkOrder(brief, dag));
    await mapper.saveProductionDAG("wo_phase4", dag);

    const qaRegistry = createFactoryQACheckRegistry();
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
          image: async () => ({ uri: "/image.png", mimeType: "image/png", fileSizeBytes: 2048, qaStatus: "passed", qaFindings: [] }),
          chart: async () => ({
            uri: "/chart.png",
            mimeType: "image/png",
            fileSizeBytes: 2048,
            qaStatus: "passed",
            qaFindings: [],
            generationParams: { summary: "Chart summarizing launch performance.", validationStatus: "valid" },
          }),
        }),
        new CompositionExecutor({ compose: async () => ({}) }),
        new QAExecutor(qaRegistry),
        new QAResolutionExecutor(qaRegistry),
        new ReleaseExecutor({
          publish: async ({ compositionId, targetChannels }) => ({
            publishedDestinations: targetChannels.map((channel) => ({ channel, url: `https://example.com/${channel}/${compositionId}` })),
          }),
        }),
      ]),
      now: (() => {
        let index = 0;
        return () => `2026-04-27T12:00:${String(index++).padStart(2, "0")}.000Z`;
      })(),
      idGenerator: (() => {
        let index = 0;
        return () => `phase4_${++index}`;
      })(),
    });

    const workOrder = await orchestrator.execute({ workOrderId: "wo_phase4", brief });
    const outputs = await mapper.listOutputsForWorkOrder("wo_phase4");
    const releaseOutput = outputs.find((output) => output.entityKind === "release");
    const stageRuns = await mapper.listStageRunsForWorkOrder("wo_phase4");
    const qaResolutionRun = stageRuns.find((stageRun) => stageRun.stageKey === "qa_resolution");
    const qaResolutionReport = qaResolutionRun?.resultRef
      ? await mapper.findOutputById(qaResolutionRun.resultRef.entityId)
      : null;
    const releasedComposition = releaseOutput
      ? await mapper.findOutputById((releaseOutput.payload as { compositionId: string }).compositionId)
      : null;

    expect(workOrder.status).toBe("succeeded");
    expect(outputs.filter((output) => output.entityKind === "asset")).toHaveLength(3);
    expect(outputs.filter((output) => output.entityKind === "composition")).toHaveLength(2);
    expect((qaResolutionReport?.payload as QAReport | undefined)?.status).toBe("passed");
    expect(releasedComposition?.entityKind).toBe("composition");
    expect(releasedComposition?.supersedesEntityId).toBeTruthy();
  });
});