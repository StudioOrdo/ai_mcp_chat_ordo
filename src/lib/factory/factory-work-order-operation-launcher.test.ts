import { describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";

import { OperationDataMapper } from "@/adapters/OperationDataMapper";
import type { ProductBrief } from "@/core/entities/product-brief";
import type { WorkOrder } from "@/core/entities/work-order";
import { ensureSchema } from "@/lib/db/schema";

import { launchFactoryWorkOrderOperation } from "./factory-work-order-operation-launcher";

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

function requireValue<T>(value: T | null | undefined): T {
  expect(value).toBeTruthy();
  if (value == null) throw new Error("Expected value to be present.");
  return value;
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

function workOrder(operationId: string): WorkOrder {
  return {
    id: "wo_1",
    schemaVersion: 1,
    operationId,
    briefId: "brief_1",
    status: "planned",
    currentDag: {
      id: "dag_1",
      briefId: "brief_1",
      schemaVersion: 1,
      stages: [],
      version: 1,
      autoParallelize: false,
      generatedAt: NOW,
      generatedBy: "test",
      generationReason: "batch_automation",
    },
    stageRuns: [],
    executionLog: [],
    revision: 1,
    previousWorkOrderIds: [],
    createdAt: NOW,
    userId: "usr_1",
    conversationId: "conv_1",
    initiatedBy: "batch_automation",
  };
}

describe("launchFactoryWorkOrderOperation", () => {
  it("creates an operation and dispatches the create action through the kernel", async () => {
    const operations = new OperationDataMapper(db());
    const dispatch = { dispatch: vi.fn(async (request) => ({
      accepted: true as const,
      duplicate: false,
      operationId: request.operationId,
      actionId: request.actionId,
      actionType: "factory.work_order.create",
      idempotencyKey: request.idempotencyKey,
      acceptedAt: NOW,
      payload: request.payload ?? {},
      snapshot: requireValue(await operations.findOperationById(request.operationId)),
      conversationSummary: null,
      availableActions: [],
    })) };
    const factoryRepository = {
      findWorkOrderByOperationId: vi.fn(async (operationId: string) => workOrder(operationId)),
    };

    const result = await launchFactoryWorkOrderOperation({
      conversationId: "conv_1",
      userId: "usr_1",
      role: "ADMIN",
      request: { brief: brief(), previousWorkOrderIds: ["wo_prior"] },
      sourceSurface: "test",
      operationRepository: operations,
      factoryRepository,
      dispatchService: dispatch,
      idFactory: (prefix) => `${prefix}_1`,
    });

    expect(dispatch.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      operationId: "op_factory_1",
      actionId: "act_1",
      actorRole: "ADMIN",
      confirmation: { confirmed: true },
      payload: expect.objectContaining({
        brief: expect.objectContaining({ id: "brief_1" }),
        previousWorkOrderIds: ["wo_prior"],
      }),
    }));
    expect(result).toMatchObject({
      operation: { id: "op_factory_1", kind: "factory_work_order" },
      workOrderId: "wo_1",
    });
  });

  it("rejects non-staff roles before operation creation", async () => {
    await expect(launchFactoryWorkOrderOperation({
      conversationId: "conv_1",
      userId: "usr_1",
      role: "AUTHENTICATED",
      request: { brief: brief() },
      operationRepository: new OperationDataMapper(db()),
    })).rejects.toThrow(/STAFF or ADMIN/);
  });
});
