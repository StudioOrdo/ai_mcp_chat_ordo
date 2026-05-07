import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { FactoryDataMapper } from "@/adapters/FactoryDataMapper";
import { OperationDataMapper } from "@/adapters/OperationDataMapper";
import type { ProductBrief } from "@/core/entities/product-brief";
import type { ResearchPacket } from "@/core/entities/research-packet";
import type { WorkOrder } from "@/core/entities/work-order";
import { ensureSchema } from "@/lib/db/schema";

import { DAGPlanner } from "./dag-planner";
import { FactoryWorkOrderOperationReconciler } from "./factory-work-order-operation-reconciler";

const NOW = "2026-05-03T12:00:00.000Z";

function db() {
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");
  ensureSchema(database);
  database.prepare("INSERT OR IGNORE INTO users (id, email, name) VALUES ('usr_1', 'u@example.com', 'User')").run();
  database.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('usr_1', 'role_admin')").run();
  database.prepare("INSERT OR IGNORE INTO conversations (id, user_id, title) VALUES ('conv_1', 'usr_1', 'Factory')").run();
  return database;
}

function brief(): ProductBrief {
  return {
    id: "brief_1",
    schemaVersion: 1,
    title: "Factory launch page",
    topic: "Solopreneur launch",
    assetKinds: ["chart"],
    qaCriteria: ["accuracy"],
    targetChannels: ["blog"],
    executionPreferences: {
      autoRetryOnFailure: true,
      parallelizeAssets: true,
    },
    createdAt: NOW,
    createdBy: "usr_1",
  };
}

function workOrder(input: { operationId: string; brief: ProductBrief }): WorkOrder {
  const dag = new DAGPlanner().generateDAG({
    brief: input.brief,
    now: () => NOW,
    idGenerator: () => "dag_1",
  });

  return {
    id: "wo_1",
    schemaVersion: 1,
    operationId: input.operationId,
    briefId: input.brief.id,
    status: "succeeded",
    currentDag: dag,
    stageRuns: [{
      id: "sr_research",
      stageKey: "research",
      status: "succeeded",
      startedAt: NOW,
      completedAt: NOW,
      resultRef: { entityKind: "research_packet", entityId: "rp_1" },
      attemptCount: 1,
    }],
    executionLog: [],
    revision: 1,
    previousWorkOrderIds: [],
    createdAt: NOW,
    startedAt: NOW,
    completedAt: NOW,
    userId: "usr_1",
    conversationId: "conv_1",
    initiatedBy: "batch_automation",
  };
}

function researchPacket(): ResearchPacket {
  return {
    id: "rp_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    queryUsed: "launch",
    searchTimestamp: NOW,
    summary: "Evidence collected from the primary source.",
    confidenceScore: 0.9,
    sources: [{
      id: "source_1",
      title: "Launch source",
      url: "https://example.com/launch",
      retrievedAt: NOW,
      relevanceScore: 0.86,
    }],
    claims: [{
      id: "claim_1",
      text: "Solopreneur launch pages need clear positioning and QA.",
      supportingSourceIds: ["source_1"],
      confidence: 0.84,
    }],
    searchEngine: "hybrid",
  };
}

describe("FactoryWorkOrderOperationReconciler", () => {
  it("projects work-order stages, events, and outputs into operation read models idempotently", async () => {
    const database = db();
    const operations = new OperationDataMapper(database);
    const factory = new FactoryDataMapper(database);
    const productBrief = brief();

    await operations.createOperation({
      id: "op_1",
      kind: "factory_work_order",
      title: "Factory work order",
      status: "running",
      riskLevel: "medium",
      conversationId: "conv_1",
      createdByUserId: "usr_1",
      createdByRole: "ADMIN",
      visibility: "staff",
      input: { request: { brief: productBrief } },
      now: NOW,
    });
    const seededWorkOrder = workOrder({ operationId: "op_1", brief: productBrief });
    await factory.createWorkOrder(seededWorkOrder);
    await factory.saveProductionDAG("wo_1", seededWorkOrder.currentDag);
    await factory.upsertStageRun("wo_1", {
      id: "sr_research",
      stageKey: "research",
      status: "running",
      startedAt: NOW,
      attemptCount: 1,
    });
    await factory.appendOutput({ entityKind: "research_packet", entity: researchPacket(), workOrderId: "wo_1", stageRunId: "sr_research" });
    await factory.upsertStageRun("wo_1", seededWorkOrder.stageRuns[0]);
    await factory.appendEvent({
      id: "factory_evt_1",
      workOrderId: "wo_1",
      stageRunId: "sr_research",
      eventType: "stage_succeeded",
      payload: { stageKey: "research" },
      createdAt: NOW,
    });

    const reconciler = new FactoryWorkOrderOperationReconciler({ operations, factory, now: () => NOW });
    await reconciler.reconcileOperation("op_1");
    await reconciler.reconcileOperation("op_1");

    const snapshot = await operations.findOperationById("op_1");
    expect(snapshot?.operation.status).toBe("succeeded");
    expect(snapshot?.steps.find((step) => step.id === "op_1:factory_stage:research")).toMatchObject({ status: "succeeded" });
    expect(snapshot?.events.filter((event) => event.id === "op_1:factory_event:factory_evt_1")).toHaveLength(1);
    expect(snapshot?.artifacts.filter((artifact) => artifact.id === "op_1:factory_output:rp_1")).toHaveLength(1);
  });
});
