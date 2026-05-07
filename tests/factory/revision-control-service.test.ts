import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { FactoryDataMapper } from "@/adapters/FactoryDataMapper";
import type { Composition } from "@/core/entities/composition";
import type { Draft } from "@/core/entities/draft";
import type { FactoryAsset } from "@/core/entities/factory-asset";
import type { ProductBrief } from "@/core/entities/product-brief";
import type { QAReport } from "@/core/entities/qa-report";
import type { Release } from "@/core/entities/release";
import type { ResearchPacket } from "@/core/entities/research-packet";
import type { StageRunRecord, StageResultEntityKind } from "@/core/entities/stage-run-record";
import type { UserFile } from "@/core/entities/user-file";
import type { WorkOrder } from "@/core/entities/work-order";
import { ensureSchema } from "@/lib/db/schema";
import { DAGPlanner } from "@/lib/factory/dag-planner";
import { AssetRefinementService } from "@/lib/factory/asset-refinement-service";
import { ProductionOrchestrator } from "@/lib/factory/production-orchestrator";
import { PauseWorkOrderService } from "@/lib/factory/pause-work-order-service";
import { FactoryResumeFrontierPlanner } from "@/lib/factory/resume-frontier-planner";
import { ResumeWorkOrderService } from "@/lib/factory/resume-work-order-service";
import { StageExecutorRegistry } from "@/lib/factory/stage-executor-registry";
import { AssetGenerationExecutor } from "@/lib/factory/stage-executors/asset-generation-executor";
import { CompositionExecutor } from "@/lib/factory/stage-executors/composition-executor";
import { DraftExecutor } from "@/lib/factory/stage-executors/draft-executor";
import { QAExecutor } from "@/lib/factory/stage-executors/qa-executor";
import { QAResolutionExecutor } from "@/lib/factory/stage-executors/qa-resolution-executor";
import { ReleaseExecutor } from "@/lib/factory/stage-executors/release-executor";
import { ResearchExecutor } from "@/lib/factory/stage-executors/research-executor";

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

function createWorkOrder(brief: ProductBrief, overrides: Partial<WorkOrder> = {}): WorkOrder {
  const dag = new DAGPlanner().generateDAG({
    brief,
    idGenerator: () => "dag_1",
    now: () => "2026-04-27T12:00:00.000Z",
  });

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
    operationId: overrides.operationId ?? "op_wo_1",
  };
}

function createResearchPacket(overrides: Partial<ResearchPacket> = {}): ResearchPacket {
  return {
    id: "rp_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    queryUsed: "solopreneur launch metrics",
    searchTimestamp: "2026-04-27T12:00:00.000Z",
    summary: "Sufficient evidence was found across multiple sources.",
    confidenceScore: 0.9,
    sources: [
      {
        id: "src_1",
        title: "Launch Benchmarks",
        url: "https://example.com/benchmarks",
        retrievedAt: "2026-04-27T12:00:00.000Z",
        relevanceScore: 0.8,
      },
    ],
    claims: [
      {
        id: "claim_1",
        text: "Email remains the highest-converting owned channel.",
        supportingSourceIds: ["src_1"],
        confidence: 0.7,
      },
    ],
    searchEngine: "hybrid",
    ...overrides,
  };
}

function createDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: "draft_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    title: "Factory launch page",
    sections: [
      { id: "section_1", kind: "heading", order: 0, text: "Launch", level: 1 },
      { id: "section_2", kind: "paragraph", order: 1, text: "Start with owned channels." },
    ],
    createdAt: "2026-04-27T12:01:00.000Z",
    revision: 1,
    sourceResearchPacketId: "rp_1",
    ...overrides,
  };
}

function createFactoryAsset(overrides: Partial<FactoryAsset> = {}): FactoryAsset {
  return {
    id: "asset_chart_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    kind: "chart",
    label: "Primary chart",
    uri: "/api/user-files/asset_chart_1",
    mimeType: "image/png",
    fileSizeBytes: 2048,
    generationParams: { chartType: "line" },
    generatedAt: "2026-04-27T12:02:00.000Z",
    generationDurationMs: 3000,
    provenance: { stageKey: "asset_chart_primary" },
    qaStatus: "passed",
    qaFindings: [],
    revision: 1,
    ...overrides,
  };
}

function createAudioAsset(overrides: Partial<FactoryAsset> = {}): FactoryAsset {
  return {
    id: "asset_audio_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    kind: "audio",
    label: "Primary audio",
    uri: "/api/user-files/asset_audio_1",
    mimeType: "audio/mpeg",
    fileSizeBytes: 4096,
    generationParams: { voice: "neutral" },
    generatedAt: "2026-04-27T12:02:30.000Z",
    generationDurationMs: 2200,
    provenance: { stageKey: "asset_audio_primary" },
    qaStatus: "passed",
    qaFindings: [],
    revision: 1,
    ...overrides,
  };
}

function createComposition(overrides: Partial<Composition> = {}): Composition {
  return {
    id: "composition_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    title: "Factory page",
    sections: [
      { id: "c1", kind: "heading", order: 0, text: "Launch", level: 1 },
      { id: "c2", kind: "chart", order: 1, assetId: "asset_chart_1", caption: "Primary chart" },
      { id: "c3", kind: "audio", order: 2, assetId: "asset_audio_1", caption: "Primary audio" },
    ],
    embeddedAssetIds: ["asset_chart_1", "asset_audio_1"],
    provenance: { draftId: "draft_1", assetIds: ["asset_chart_1", "asset_audio_1"] },
    metadata: { targetChannel: "blog" },
    htmlContent: "<main>launch</main>",
    createdAt: "2026-04-27T12:03:00.000Z",
    revision: 1,
    ...overrides,
  };
}

function createQAReport(id: string, overrides: Partial<QAReport> = {}): QAReport {
  return {
    id,
    schemaVersion: 1,
    workOrderId: "wo_1",
    status: "passed",
    totalFindings: 0,
    passedCriteria: ["accuracy", "accessibility"],
    failedCriteria: [],
    assetReports: [],
    pageFindings: [],
    recommendedFixes: [],
    autoResolvableCount: 0,
    requiresUserDecision: false,
    createdAt: "2026-04-27T12:04:00.000Z",
    ...overrides,
  };
}

function createRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: "release_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    version: "1.0.0",
    releaseNumber: 1,
    compositionId: "composition_1",
    publishedDestinations: [{ channel: "blog", url: "https://example.com/post" }],
    releasedAt: "2026-04-27T12:05:00.000Z",
    releasedBy: "usr_factory",
    ...overrides,
  };
}

async function persistSucceededStage<TEntity extends ResearchPacket | Draft | FactoryAsset | Composition | QAReport | Release>(
  mapper: FactoryDataMapper,
  options: {
    workOrderId: string;
    stageRunId: string;
    stageKey: string;
    entityKind: StageResultEntityKind;
    entity: TEntity;
  },
) {
  await mapper.upsertStageRun(options.workOrderId, {
    id: options.stageRunId,
    stageKey: options.stageKey,
    status: "pending",
    attemptCount: 0,
  });

  const output = await mapper.appendOutput({
    entityKind: options.entityKind,
    entity: options.entity as never,
    workOrderId: options.workOrderId,
    stageRunId: options.stageRunId,
  });

  await mapper.upsertStageRun(options.workOrderId, {
    id: options.stageRunId,
    stageKey: options.stageKey,
    status: "succeeded",
    startedAt: "2026-04-27T12:00:00.000Z",
    completedAt: "2026-04-27T12:00:30.000Z",
    attemptCount: 1,
    resultRef: {
      entityKind: options.entityKind,
      entityId: output.entityId,
    },
  });

  return output;
}

async function seedPausedReleaseFailure(mapper: FactoryDataMapper, brief: ProductBrief): Promise<void> {
  const workOrder = createWorkOrder(brief);
  await mapper.createWorkOrder(workOrder);
  await mapper.saveProductionDAG(workOrder.id, workOrder.currentDag);

  const research = await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_research",
    stageKey: "research",
    entityKind: "research_packet",
    entity: createResearchPacket(),
  });
  const draft = await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_draft",
    stageKey: "draft",
    entityKind: "draft",
    entity: createDraft({ sourceResearchPacketId: research.entityId }),
  });
  const chartAsset = await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_asset_chart",
    stageKey: "asset_chart_primary",
    entityKind: "asset",
    entity: createFactoryAsset(),
  });
  const audioAsset = await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_asset_audio",
    stageKey: "asset_audio_primary",
    entityKind: "asset",
    entity: createAudioAsset(),
  });
  await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_composition",
    stageKey: "composition",
    entityKind: "composition",
    entity: createComposition({
      provenance: { draftId: draft.entityId, assetIds: [chartAsset.entityId, audioAsset.entityId] },
      embeddedAssetIds: [chartAsset.entityId, audioAsset.entityId],
      sections: [
        { id: "c1", kind: "heading", order: 0, text: "Launch", level: 1 },
        { id: "c2", kind: "chart", order: 1, assetId: chartAsset.entityId, caption: "Primary chart" },
        { id: "c3", kind: "audio", order: 2, assetId: audioAsset.entityId, caption: "Primary audio" },
      ],
    }),
  });
  await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_qa_asset",
    stageKey: "qa_asset",
    entityKind: "qa_report",
    entity: createQAReport("qa_asset_1", {
      assetReports: [
        { assetId: chartAsset.entityId, assetKind: "chart", findings: [], status: "passed" },
        { assetId: audioAsset.entityId, assetKind: "audio", findings: [], status: "passed" },
      ],
    }),
  });
  await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_qa_page",
    stageKey: "qa_page",
    entityKind: "qa_report",
    entity: createQAReport("qa_page_1"),
  });
  await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_qa_resolution",
    stageKey: "qa_resolution",
    entityKind: "qa_report",
    entity: createQAReport("qa_resolution_1"),
  });

  await mapper.upsertStageRun(workOrder.id, {
    id: "sr_release",
    stageKey: "release",
    status: "failed",
    startedAt: "2026-04-27T12:06:00.000Z",
    completedAt: "2026-04-27T12:06:05.000Z",
    attemptCount: 1,
    errorCode: "stage_failed",
    errorMessage: "Publishing destination returned a terminal error.",
  });

  const stageRuns = await mapper.listStageRunsForWorkOrder(workOrder.id);
  await mapper.updateWorkOrder({
    ...workOrder,
    revision: 2,
    status: "paused",
    stageRuns,
    startedAt: "2026-04-27T12:00:00.000Z",
    pausedState: {
      pausedAt: "2026-04-27T12:06:05.000Z",
      reason: "Publishing destination returned a terminal error.",
      resumeFromStageKey: "release",
    },
  });

  await mapper.createCheckpoint({
    checkpointId: "checkpoint_release_failure",
    workOrderId: workOrder.id,
    stageRunId: "sr_release",
    pauseState: {
      pausedAt: "2026-04-27T12:06:05.000Z",
      reason: "Publishing destination returned a terminal error.",
      resumeFromStageKey: "release",
    },
    resumeFromStageKey: "release",
    createdAt: "2026-04-27T12:06:05.000Z",
  });
}

describe("Phase 5 revision services", () => {
  let db: Database.Database;
  let mapper: FactoryDataMapper;

  beforeEach(() => {
    db = createDb();
    seedUser(db);
    seedConversation(db);
    mapper = new FactoryDataMapper(db);
  });

  it("plans composition as the safe frontier when a refinement happens after composition exists", async () => {
    const brief = createBrief();
    const workOrder = createWorkOrder(brief, {
      status: "paused",
      pausedState: {
        pausedAt: "2026-04-27T12:06:05.000Z",
        reason: "Need revision",
        resumeFromStageKey: "release",
      },
    });
    const planner = new FactoryResumeFrontierPlanner();

    const plan = planner.plan({
      workOrder,
      outputs: [
        {
          entityId: "composition_1",
          entityKind: "composition",
          workOrderId: workOrder.id,
          stageRunId: "sr_composition",
          supersedesEntityId: null,
          createdAt: "2026-04-27T12:03:00.000Z",
          payload: createComposition(),
        },
      ],
      mode: "metadata_fix",
    });

    expect(plan.stageKey).toBe("composition");
    const earlierPlan = planner.plan({
      workOrder,
      outputs: [
        {
          entityId: "composition_1",
          entityKind: "composition",
          workOrderId: workOrder.id,
          stageRunId: "sr_composition",
          supersedesEntityId: null,
          createdAt: "2026-04-27T12:03:00.000Z",
          payload: createComposition(),
        },
      ],
      mode: "metadata_fix",
      requestedStageKey: "draft",
    });

    expect(earlierPlan.stageKey).toBe("draft");
    expect(() => planner.plan({
      workOrder,
      outputs: [
        {
          entityId: "composition_1",
          entityKind: "composition",
          workOrderId: workOrder.id,
          stageRunId: "sr_composition",
          supersedesEntityId: null,
          createdAt: "2026-04-27T12:03:00.000Z",
          payload: createComposition(),
        },
      ],
      mode: "metadata_fix",
      requestedStageKey: "release",
    })).toThrow(/later than the safe frontier/);
  });

  it("requires the current brief when regenerate mode is requested", async () => {
    const brief = createBrief();
    await seedPausedReleaseFailure(mapper, brief);

    const service = new AssetRefinementService({
      repository: mapper,
      frontierPlanner: new FactoryResumeFrontierPlanner(),
      regenerateAsset: async ({ brief: inputBrief }) => ({
        label: `${inputBrief.title} regenerated`,
        uri: "/regenerated/chart.svg",
        mimeType: "image/svg+xml",
        fileSizeBytes: 10_000,
        generationParams: { regenerated: true },
      }),
      now: (() => {
        let index = 0;
        return () => `2026-04-27T12:11:${String(index++).padStart(2, "0")}.000Z`;
      })(),
      idGenerator: (() => {
        let index = 0;
        return () => `regen_${++index}`;
      })(),
    });

    await expect(service.refine({
      workOrderId: "wo_1",
      assetId: "asset_chart_1",
      mode: "regenerate",
      requestedBy: "usr_factory",
    })).rejects.toThrow(/requires the current ProductBrief/);

    const result = await service.refine({
      workOrderId: "wo_1",
      assetId: "asset_chart_1",
      mode: "regenerate",
      requestedBy: "usr_factory",
      brief,
      parameterOverrides: { palette: "warm" },
    });

    const regenerated = requireValue(await mapper.findOutputById(result.newAssetId));
    expect((regenerated.payload as FactoryAsset).uri).toBe("/regenerated/chart.svg");
    expect((regenerated.payload as FactoryAsset).generationParams).toMatchObject({
      regenerated: true,
      palette: "warm",
    });
  });

  it("pauses immediately when a work order is between stage boundaries", async () => {
    const brief = createBrief();
    const workOrder = createWorkOrder(brief);
    await mapper.createWorkOrder(workOrder);
    await mapper.saveProductionDAG(workOrder.id, workOrder.currentDag);

    const service = new PauseWorkOrderService({
      repository: mapper,
      now: (() => {
        let index = 0;
        return () => `2026-04-27T12:40:${String(index++).padStart(2, "0")}.000Z`;
      })(),
      idGenerator: (() => {
        let index = 0;
        return () => `pause_${++index}`;
      })(),
    });

    const result = await service.requestPause({
      workOrderId: workOrder.id,
      requestedBy: "usr_factory",
      reason: "Operator requested review before execution.",
    });

    const paused = requireValue(await mapper.findWorkOrderById(workOrder.id));
    const checkpoint = requireValue(await mapper.findLatestActiveCheckpoint(workOrder.id));

    expect(result).toMatchObject({
      outcome: "paused",
      resumeFromStageKey: "research",
    });
    expect(paused.status).toBe("paused");
    expect(paused.pausedState?.resumeFromStageKey).toBe("research");
    expect(checkpoint.resumeFromStageKey).toBe("research");
  });

  it("records a deferred pause request while a stage is still running", async () => {
    const brief = createBrief();
    const runningStageRun: StageRunRecord = {
      id: "sr_research_running",
      stageKey: "research",
      status: "running",
      startedAt: "2026-04-27T12:41:00.000Z",
      attemptCount: 1,
    };
    const workOrder = createWorkOrder(brief, {
      status: "running",
      startedAt: "2026-04-27T12:41:00.000Z",
      stageRuns: [runningStageRun],
    });
    await mapper.createWorkOrder(workOrder);
    await mapper.saveProductionDAG(workOrder.id, workOrder.currentDag);
    await mapper.upsertStageRun(workOrder.id, runningStageRun);

    const service = new PauseWorkOrderService({ repository: mapper });
    const result = await service.requestPause({
      workOrderId: workOrder.id,
      requestedBy: "usr_factory",
      reason: "Pause after the current stage finishes.",
    });

    const events = await mapper.listEventsForWorkOrder(workOrder.id);

    expect(result).toMatchObject({
      outcome: "pause_requested",
      resumeFromStageKey: "research",
    });
    expect(events.at(-1)?.eventType).toBe("revision_pause_requested");
  });

  it("honors a pending pause request at the next stage boundary", async () => {
    const brief = createBrief();
    const workOrder = createWorkOrder(brief, {
      status: "running",
      startedAt: "2026-04-27T12:42:00.000Z",
    });
    await mapper.createWorkOrder(workOrder);
    await mapper.saveProductionDAG(workOrder.id, workOrder.currentDag);
    await persistSucceededStage(mapper, {
      workOrderId: workOrder.id,
      stageRunId: "sr_research",
      stageKey: "research",
      entityKind: "research_packet",
      entity: createResearchPacket(),
    });
    await mapper.appendEvent({
      workOrderId: workOrder.id,
      eventType: "revision_pause_requested",
      payload: {
        requestedBy: "usr_factory",
        reason: "Pause before drafting begins.",
      },
      createdAt: "2026-04-27T12:42:30.000Z",
    });

    const stageRuns = await mapper.listStageRunsForWorkOrder(workOrder.id);
    await mapper.updateWorkOrder({
      ...workOrder,
      status: "running",
      revision: 2,
      startedAt: "2026-04-27T12:42:00.000Z",
      stageRuns,
    });

    const orchestrator = new ProductionOrchestrator({
      repository: mapper,
      executorRegistry: new StageExecutorRegistry([
        new ResearchExecutor({ research: async () => createResearchPacket() }),
        new DraftExecutor({ compose: async () => ({ sections: createDraft().sections }) }),
      ]),
      now: (() => {
        let index = 0;
        return () => `2026-04-27T12:43:${String(index++).padStart(2, "0")}.000Z`;
      })(),
      idGenerator: (() => {
        let index = 0;
        return () => `orch_${++index}`;
      })(),
    });

    const paused = await orchestrator.execute({
      workOrderId: workOrder.id,
      brief,
    });

    const checkpoint = requireValue(await mapper.findLatestActiveCheckpoint(workOrder.id));
    const events = await mapper.listEventsForWorkOrder(workOrder.id);

    expect(paused.status).toBe("paused");
    expect(paused.pausedState?.resumeFromStageKey).toBe("draft");
    expect(checkpoint.resumeFromStageKey).toBe("draft");
    expect(events.some((event) => event.eventType === "revision_pause_honored")).toBe(true);
  });

  it("creates immutable asset supersessions from replacement uploads and updates the paused frontier", async () => {
    const brief = createBrief();
    await seedPausedReleaseFailure(mapper, brief);

    const service = new AssetRefinementService({
      repository: mapper,
      frontierPlanner: new FactoryResumeFrontierPlanner(),
      userFileRepository: {
        findById: async (id: string) => id === "uf_chart_replacement"
          ? {
              id,
              userId: "usr_factory",
              conversationId: "conv_factory",
              status: "ready",
              contentHash: "hash_chart",
              fileType: "chart",
              fileName: "replacement-chart.svg",
              mimeType: "image/svg+xml",
              fileSize: 8192,
              metadata: { assetKind: "chart", source: "uploaded" },
              createdAt: "2026-04-27T12:10:00.000Z",
            } satisfies UserFile
          : null,
      },
      now: (() => {
        let index = 0;
        return () => `2026-04-27T12:10:${String(index++).padStart(2, "0")}.000Z`;
      })(),
      idGenerator: (() => {
        let index = 0;
        return () => `phase5_${++index}`;
      })(),
    });

    const result = await service.refine({
      workOrderId: "wo_1",
      assetId: "asset_chart_1",
      mode: "replace_with_upload",
      requestedBy: "usr_factory",
      userFileId: "uf_chart_replacement",
    });

    const outputs = await mapper.listOutputsForWorkOrder("wo_1", "asset");
    const replacement = requireValue(outputs.find((output) => output.entityId === result.newAssetId));
    const latestCheckpoint = requireValue(await mapper.findLatestActiveCheckpoint("wo_1"));
    const workOrder = requireValue(await mapper.findWorkOrderById("wo_1"));

    expect(result.resumeFromStageKey).toBe("composition");
    expect(replacement.supersedesEntityId).toBe("asset_chart_1");
    expect((replacement.payload as FactoryAsset).uri).toBe("/api/user-files/uf_chart_replacement");
    expect(latestCheckpoint.resumeFromStageKey).toBe("composition");
    expect(workOrder.pausedState?.resumeFromStageKey).toBe("composition");
  });

  it("rewinds composition and downstream stages to resume with the refined asset", async () => {
    const brief = createBrief();
    await seedPausedReleaseFailure(mapper, brief);

    const frontierPlanner = new FactoryResumeFrontierPlanner();
    const refinementService = new AssetRefinementService({
      repository: mapper,
      frontierPlanner,
      now: (() => {
        let index = 0;
        return () => `2026-04-27T12:20:${String(index++).padStart(2, "0")}.000Z`;
      })(),
      idGenerator: (() => {
        let index = 0;
        return () => `phase5_${++index}`;
      })(),
    });

    const refinement = await refinementService.refine({
      workOrderId: "wo_1",
      assetId: "asset_chart_1",
      mode: "metadata_fix",
      requestedBy: "usr_factory",
      parameterOverrides: { altText: "Updated chart alt text" },
    });

    const orchestrator = new ProductionOrchestrator({
      repository: mapper,
      executorRegistry: new StageExecutorRegistry([
        new ResearchExecutor({
          research: async () => createResearchPacket(),
        }),
        new DraftExecutor({
          compose: async () => ({
            sections: createDraft().sections,
          }),
        }),
        new AssetGenerationExecutor({
          chart: async () => ({ uri: "/chart.png", mimeType: "image/png", fileSizeBytes: 2048, qaStatus: "passed", qaFindings: [] }),
          audio: async () => ({ uri: "/audio.mp3", mimeType: "audio/mpeg", fileSizeBytes: 4096, qaStatus: "passed", qaFindings: [] }),
        }),
        new CompositionExecutor({
          compose: async ({ draft, assets }) => ({
            title: draft.title,
            htmlContent: `<main>${assets.map((asset) => asset.id).join(",")}</main>`,
          }),
        }),
        new QAExecutor(),
        new QAResolutionExecutor(),
        new ReleaseExecutor({
          publish: async ({ compositionId }) => ({
            publishedDestinations: [{ channel: "blog", url: `https://example.com/releases/${compositionId}` }],
          }),
        }),
      ]),
      now: (() => {
        let index = 0;
        return () => `2026-04-27T12:30:${String(index++).padStart(2, "0")}.000Z`;
      })(),
      idGenerator: (() => {
        let index = 0;
        return () => `resume_${++index}`;
      })(),
    });
    const resumeService = new ResumeWorkOrderService({
      repository: mapper,
      orchestrator,
      frontierPlanner,
      now: (() => {
        let index = 0;
        return () => `2026-04-27T12:25:${String(index++).padStart(2, "0")}.000Z`;
      })(),
    });

    const resumed = await resumeService.resume({
      workOrderId: "wo_1",
      brief,
    });

    const stageRuns = await mapper.listStageRunsForWorkOrder("wo_1");
    const outputs = await mapper.listOutputsForWorkOrder("wo_1");
    const currentComposition = requireValue(outputs.filter((output) => output.entityKind === "composition").at(-1));
    const currentRelease = requireValue(outputs.filter((output) => output.entityKind === "release").at(-1));

    expect(refinement.resumeFromStageKey).toBe("composition");
    expect(resumed.status).toBe("succeeded");
    expect(requireValue(stageRuns.find((stageRun) => stageRun.stageKey === "composition")).status).toBe("succeeded");
    expect(requireValue(stageRuns.find((stageRun) => stageRun.stageKey === "qa_asset")).status).toBe("succeeded");
    expect(requireValue(stageRuns.find((stageRun) => stageRun.stageKey === "qa_page")).status).toBe("succeeded");
    expect(requireValue(stageRuns.find((stageRun) => stageRun.stageKey === "qa_resolution")).status).toBe("succeeded");
    expect(requireValue(stageRuns.find((stageRun) => stageRun.stageKey === "release")).status).toBe("succeeded");
    expect((currentComposition.payload as Composition).embeddedAssetIds).toContain(refinement.newAssetId);
    expect((currentRelease.payload as Release).compositionId).toBe(currentComposition.entityId);
  });
});
