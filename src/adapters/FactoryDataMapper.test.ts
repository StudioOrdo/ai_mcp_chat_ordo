import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { ensureSchema } from "../lib/db/schema";
import { FactoryDataMapper } from "./FactoryDataMapper";
import type { WorkOrder } from "@/core/entities/work-order";
import type { ProductionDAG } from "@/core/entities/production-dag";
import type { StageRunRecord } from "@/core/entities/stage-run-record";
import type { ResearchPacket } from "@/core/entities/research-packet";
import type { Draft } from "@/core/entities/draft";
import type { FactoryAsset } from "@/core/entities/factory-asset";
import type { Composition } from "@/core/entities/composition";
import type { Release } from "@/core/entities/release";
import type { Outcome } from "@/core/entities/outcome";

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

function createProductionDAG(overrides: Partial<ProductionDAG> = {}): ProductionDAG {
  return {
    id: "dag_1",
    schemaVersion: 1,
    briefId: "brief_1",
    version: 1,
    autoParallelize: true,
    generatedAt: "2026-04-27T12:00:00.000Z",
    generatedBy: "planner_service",
    generationReason: "batch_automation",
    stages: [
      {
        key: "research",
        kind: "research",
        label: "Research",
        dependencyKeys: [],
        parallelizable: false,
        config: { kind: "research", queryHint: "solopreneur publishing" },
      },
      {
        key: "draft",
        kind: "draft",
        label: "Draft",
        dependencyKeys: ["research"],
        parallelizable: false,
        config: { kind: "draft", outlineHint: "narrative" },
      },
      {
        key: "asset_chart_1",
        kind: "asset_generation",
        label: "Generate chart",
        dependencyKeys: ["draft"],
        parallelizable: true,
        config: { kind: "asset_generation", assetKind: "chart", assetSlot: "hero-chart" },
      },
      {
        key: "compose",
        kind: "composition",
        label: "Compose page",
        dependencyKeys: ["draft", "asset_chart_1"],
        parallelizable: false,
        config: { kind: "composition", template: "landing" },
      },
      {
        key: "release",
        kind: "release",
        label: "Release",
        dependencyKeys: ["compose"],
        parallelizable: false,
        config: { kind: "release", channels: ["blog"] },
      },
    ],
    ...overrides,
  };
}

function createStageRunRecord(overrides: Partial<StageRunRecord> = {}): StageRunRecord {
  return {
    id: "sr_1",
    stageKey: "research",
    status: "running",
    startedAt: "2026-04-27T12:00:00.000Z",
    attemptCount: 1,
    ...overrides,
  };
}

function createWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  const dag = createProductionDAG();

  return {
    id: "wo_1",
    schemaVersion: 1,
    briefId: dag.briefId,
    status: "running",
    currentDag: dag,
    stageRuns: [],
    executionLog: [],
    revision: 1,
    previousWorkOrderIds: [],
    createdAt: "2026-04-27T12:00:00.000Z",
    startedAt: "2026-04-27T12:00:00.000Z",
    userId: "usr_factory",
    conversationId: "conv_factory",
    initiatedBy: "batch_automation",
    ...overrides,
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
    id: "asset_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    kind: "chart",
    uri: "/api/user-files/asset_1",
    mimeType: "image/png",
    fileSizeBytes: 2048,
    generationParams: { chartType: "line" },
    generatedAt: "2026-04-27T12:02:00.000Z",
    generationDurationMs: 3000,
    provenance: { stageKey: "asset_chart_1" },
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
      { id: "c2", kind: "chart", order: 1, assetId: "asset_1" },
    ],
    embeddedAssetIds: ["asset_1"],
    provenance: { draftId: "draft_1", assetIds: ["asset_1"] },
    metadata: {},
    createdAt: "2026-04-27T12:03:00.000Z",
    revision: 1,
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
    releasedAt: "2026-04-27T12:04:00.000Z",
    releasedBy: "usr_factory",
    ...overrides,
  };
}

function createOutcome(overrides: Partial<Outcome> = {}): Outcome {
  return {
    id: "outcome_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    releaseId: "release_1",
    observedAt: "2026-04-28T12:04:00.000Z",
    metrics: { viewCount: 100, engagementByChannel: { blog: 12 }, conversionCount: 3 },
    ...overrides,
  };
}

describe("FactoryDataMapper", () => {
  let db: Database.Database;
  let mapper: FactoryDataMapper;

  beforeEach(() => {
    db = createDb();
    seedUser(db);
    seedConversation(db);
    mapper = new FactoryDataMapper(db);
  });

  it("creates and reloads work orders with multi-parent lineage", async () => {
    const parentA = createWorkOrder({ id: "wo_parent_a", conversationId: undefined, currentDag: createProductionDAG({ id: "dag_parent_a" }) });
    const parentB = createWorkOrder({ id: "wo_parent_b", conversationId: undefined, currentDag: createProductionDAG({ id: "dag_parent_b" }) });
    await mapper.createWorkOrder(parentA);
    await mapper.createWorkOrder(parentB);

    const workOrder = createWorkOrder({ previousWorkOrderIds: ["wo_parent_a", "wo_parent_b"] });
    await mapper.createWorkOrder(workOrder);

    const found = requireValue(await mapper.findWorkOrderById("wo_1"));
    expect(found.previousWorkOrderIds).toEqual(["wo_parent_a", "wo_parent_b"]);
    expect(await mapper.listParentWorkOrderIds("wo_1")).toEqual(["wo_parent_a", "wo_parent_b"]);
  });

  it("persists DAG snapshots and resolves the current DAG for a work order", async () => {
    await mapper.createWorkOrder(createWorkOrder());
    const dag = createProductionDAG({ id: "dag_current", version: 2 });

    await mapper.saveProductionDAG("wo_1", dag);

    const found = requireValue(await mapper.findProductionDAGById("dag_current"));
    expect(found.version).toBe(2);
    expect(requireValue(await mapper.findCurrentProductionDAGForWorkOrder("wo_1")).id).toBe("dag_current");
    expect(requireValue(await mapper.findWorkOrderById("wo_1")).currentDag.id).toBe("dag_current");
  });

  it("upserts stage runs and keeps durable ids stable per stage key", async () => {
    await mapper.createWorkOrder(createWorkOrder());
    await mapper.saveProductionDAG("wo_1", createProductionDAG());

    await mapper.upsertStageRun("wo_1", createStageRunRecord({ id: "sr_research", stageKey: "research" }));
    await mapper.appendOutput({ entityKind: "research_packet", entity: createResearchPacket(), workOrderId: "wo_1" });
    const updated = await mapper.upsertStageRun(
      "wo_1",
      createStageRunRecord({
        id: "sr_research",
        stageKey: "research",
        status: "succeeded",
        completedAt: "2026-04-27T12:01:00.000Z",
        resultRef: { entityKind: "research_packet", entityId: "rp_1" },
      }),
    ).catch((error: unknown) => {
      expect(error).toBeInstanceOf(Error);
      throw error;
    });

    expect(updated.id).toBe("sr_research");
    expect((await mapper.listStageRunsForWorkOrder("wo_1")).map((stageRun) => stageRun.id)).toEqual(["sr_research"]);
    expect(requireValue(await mapper.findWorkOrderById("wo_1")).stageRuns.map((stageRun) => stageRun.id)).toEqual(["sr_research"]);
  });

  it("persists outputs and cross-checks result references against canonical entity ids", async () => {
    await mapper.createWorkOrder(createWorkOrder());
    await mapper.saveProductionDAG("wo_1", createProductionDAG());
    await mapper.appendOutput({ entityKind: "research_packet", entity: createResearchPacket(), workOrderId: "wo_1" });
    await mapper.upsertStageRun(
      "wo_1",
      createStageRunRecord({
        id: "sr_research",
        stageKey: "research",
        status: "succeeded",
        completedAt: "2026-04-27T12:01:00.000Z",
        resultRef: { entityKind: "research_packet", entityId: "rp_1" },
      }),
    );

    const output = requireValue(await mapper.findOutputById("rp_1"));
    expect(output.entityKind).toBe("research_packet");
    expect(output.entityId).toBe("rp_1");
  });

  it("stores composition asset ordering as a queryable projection", async () => {
    await mapper.createWorkOrder(createWorkOrder());
    await mapper.saveProductionDAG("wo_1", createProductionDAG());
    await mapper.appendOutput({ entityKind: "research_packet", entity: createResearchPacket(), workOrderId: "wo_1" });
    await mapper.appendOutput({ entityKind: "draft", entity: createDraft(), workOrderId: "wo_1" });
    await mapper.appendOutput({ entityKind: "asset", entity: createFactoryAsset(), workOrderId: "wo_1" });
    await mapper.appendOutput({ entityKind: "composition", entity: createComposition(), workOrderId: "wo_1" });

    const links = db.prepare(
      `SELECT asset_id, ordinal FROM factory_composition_assets WHERE composition_id = ? ORDER BY ordinal ASC`,
    ).all("composition_1") as Array<{ asset_id: string; ordinal: number }>;

    expect(links).toEqual([{ asset_id: "asset_1", ordinal: 0 }]);
  });

  it("creates, fetches, and consumes checkpoints", async () => {
    await mapper.createWorkOrder(createWorkOrder({ status: "paused", pausedState: { pausedAt: "2026-04-27T12:05:00.000Z", reason: "Need review", resumeFromStageKey: "draft" } }));
    await mapper.saveProductionDAG("wo_1", createProductionDAG());
    await mapper.upsertStageRun("wo_1", createStageRunRecord({ id: "sr_research", stageKey: "research" }));

    await mapper.createCheckpoint({
      checkpointId: "checkpoint_1",
      workOrderId: "wo_1",
      stageRunId: "sr_research",
      pauseState: { pausedAt: "2026-04-27T12:05:00.000Z", reason: "Need review", resumeFromStageKey: "draft" },
      resumeFromStageKey: "draft",
      createdAt: "2026-04-27T12:05:00.000Z",
    });

    const checkpoint = requireValue(await mapper.findLatestActiveCheckpoint("wo_1"));
    expect(checkpoint.checkpointId).toBe("checkpoint_1");
    expect(requireValue(await mapper.findWorkOrderById("wo_1")).pausedState).toEqual({
      pausedAt: "2026-04-27T12:05:00.000Z",
      reason: "Need review",
      resumeFromStageKey: "draft",
    });

    await mapper.markCheckpointConsumed("checkpoint_1", "2026-04-27T12:06:00.000Z");
    expect(await mapper.findLatestActiveCheckpoint("wo_1")).toBeNull();
  });

  it("appends ordered event streams scoped to a work order", async () => {
    await mapper.createWorkOrder(createWorkOrder());
    await mapper.saveProductionDAG("wo_1", createProductionDAG());
    await mapper.upsertStageRun("wo_1", createStageRunRecord({ id: "sr_research", stageKey: "research" }));

    const first = await mapper.appendEvent({
      workOrderId: "wo_1",
      stageRunId: "sr_research",
      eventType: "stage_started",
      payload: { stageKey: "research" },
      createdAt: "2026-04-27T12:00:00.000Z",
    });
    const second = await mapper.appendEvent({
      workOrderId: "wo_1",
      eventType: "stage_progress",
      payload: { percent: 50 },
      createdAt: "2026-04-27T12:00:30.000Z",
    });

    expect([first.sequence, second.sequence]).toEqual([1, 2]);
    expect((await mapper.listEventsForWorkOrder("wo_1")).map((event) => event.sequence)).toEqual([1, 2]);
  });

  it("rejects outputs whose references cross work orders", async () => {
    await mapper.createWorkOrder(createWorkOrder());
    await mapper.createWorkOrder(
      createWorkOrder({
        id: "wo_2",
        currentDag: createProductionDAG({ id: "dag_2", briefId: "brief_2" }),
        briefId: "brief_2",
        userId: "usr_factory",
      }),
    );
    await mapper.appendOutput({ entityKind: "research_packet", entity: createResearchPacket({ id: "rp_other", workOrderId: "wo_2" }), workOrderId: "wo_2" });

    await expect(
      mapper.appendOutput({
        entityKind: "draft",
        entity: createDraft({ sourceResearchPacketId: "rp_other" }),
        workOrderId: "wo_1",
      }),
    ).rejects.toThrow(/must belong to work order/);
  });

  it("persists output lineage through supersedesEntityId", async () => {
    await mapper.createWorkOrder(createWorkOrder());
    await mapper.appendOutput({ entityKind: "asset", entity: createFactoryAsset({ id: "asset_1" }), workOrderId: "wo_1" });
    const newer = await mapper.appendOutput({
      entityKind: "asset",
      entity: createFactoryAsset({ id: "asset_2", revision: 2, provenance: { stageKey: "asset_chart_1", previousAssetId: "asset_1" } }),
      workOrderId: "wo_1",
      supersedesEntityId: "asset_1",
    });

    expect(newer.supersedesEntityId).toBe("asset_1");
  });

  it("supports release and outcome output chains", async () => {
    await mapper.createWorkOrder(createWorkOrder());
    await mapper.appendOutput({ entityKind: "research_packet", entity: createResearchPacket(), workOrderId: "wo_1" });
    await mapper.appendOutput({ entityKind: "draft", entity: createDraft(), workOrderId: "wo_1" });
    await mapper.appendOutput({ entityKind: "asset", entity: createFactoryAsset(), workOrderId: "wo_1" });
    await mapper.appendOutput({ entityKind: "composition", entity: createComposition(), workOrderId: "wo_1" });
    await mapper.appendOutput({ entityKind: "release", entity: createRelease(), workOrderId: "wo_1" });
    await mapper.appendOutput({ entityKind: "outcome", entity: createOutcome(), workOrderId: "wo_1" });

    const outputs = await mapper.listOutputsForWorkOrder("wo_1");
    expect(outputs.map((output) => output.entityKind)).toEqual([
      "research_packet",
      "draft",
      "asset",
      "composition",
      "release",
      "outcome",
    ]);
  });
});