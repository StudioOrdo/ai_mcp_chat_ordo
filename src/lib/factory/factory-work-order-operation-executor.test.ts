import { describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";

import { FactoryDataMapper } from "@/adapters/FactoryDataMapper";
import { OperationDataMapper } from "@/adapters/OperationDataMapper";
import type { ProductBrief } from "@/core/entities/product-brief";
import {
  createFactoryWorkOrderCreateAction,
} from "@/core/use-cases/operations/FactoryWorkOrderOperationActions";
import { OperationActionDispatchService } from "@/core/use-cases/operations/OperationActionDispatch";
import { ensureSchema } from "@/lib/db/schema";

import { DAGPlanner } from "./dag-planner";
import { FactoryWorkOrderOperationExecutor } from "./factory-work-order-operation-executor";
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

describe("FactoryWorkOrderOperationExecutor", () => {
  it("creates linked work orders through operation action dispatch", async () => {
    const database = db();
    const operations = new OperationDataMapper(database);
    const factory = new FactoryDataMapper(database);
    const productBrief = brief();

    await operations.createOperation({
      id: "op_1",
      kind: "factory_work_order",
      title: "Factory work order",
      status: "draft",
      riskLevel: "medium",
      conversationId: "conv_1",
      createdByUserId: "usr_1",
      createdByRole: "ADMIN",
      visibility: "staff",
      input: { request: { brief: productBrief } },
      now: NOW,
    });
    const action = createFactoryWorkOrderCreateAction({
      operationId: "op_1",
      operationRevision: 1,
      idFactory: (prefix) => `${prefix}_create`,
      payload: { brief: productBrief, previousWorkOrderIds: [] },
    });
    await operations.replaceActions({ operationId: "op_1", actions: [action], now: NOW });

    const reconciler = new FactoryWorkOrderOperationReconciler({ operations, factory, now: () => NOW });
    const executor = new FactoryWorkOrderOperationExecutor({
      repository: factory,
      planner: new DAGPlanner(),
      orchestrator: {
        execute: vi.fn(async ({ workOrderId }) => {
          const workOrder = await factory.findWorkOrderById(workOrderId);
          if (!workOrder) throw new Error("missing work order");
          return factory.updateWorkOrder({
            ...workOrder,
            status: "succeeded",
            startedAt: NOW,
            completedAt: NOW,
            revision: workOrder.revision + 1,
          });
        }),
      },
      pauseWorkOrderService: { requestPause: vi.fn() },
      assetRefinementService: { refine: vi.fn() },
      resumeWorkOrderService: { resume: vi.fn() },
      cancelWorkOrderService: { requestCancel: vi.fn() },
      retryWorkOrderStageService: { retryStage: vi.fn() },
      reconcile: (operationId) => reconciler.reconcileOperation(operationId).then(() => undefined),
      idFactory: (prefix) => `${prefix}_1`,
      now: () => NOW,
    });

    const dispatch = new OperationActionDispatchService({ repository: operations, executors: [executor] });
    const result = await dispatch.dispatch({
      operationId: "op_1",
      actionId: action.id,
      idempotencyKey: action.idempotencyKey,
      clientOperationRevision: 1,
      actorUserId: "usr_1",
      actorRole: "ADMIN",
      payload: action.payload,
      confirmation: { confirmed: true },
      now: NOW,
    });

    const workOrder = await factory.findWorkOrderByOperationId("op_1");
    expect(workOrder).toMatchObject({ operationId: "op_1", briefId: "brief_1", status: "succeeded" });
    expect(result.snapshot.operation.status).toBe("succeeded");
  });
});
