import { beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";

import { FactoryDataMapper } from "@/adapters/FactoryDataMapper";
import { OperationDataMapper } from "@/adapters/OperationDataMapper";
import type { ProductBrief } from "@/core/entities/product-brief";
import type { WorkOrder } from "@/core/entities/work-order";
import { createFactoryWorkOrderPauseAction } from "@/core/use-cases/operations/FactoryWorkOrderOperationActions";
import { createExecutionTimelineReader } from "@/core/platform/execution/ExecutionTimelineReader";
import { PlatformInteractionFacade } from "@/core/platform/facade/PlatformInteractionFacade";
import { ensureSchema } from "@/lib/db/schema";
import { DAGPlanner } from "@/lib/factory/dag-planner";

const {
  getSessionUserMock,
  getFactoryRepositoryMock,
  getOperationRepositoryMock,
  getUserFileDataMapperMock,
  getWorkOrderInteractionMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getFactoryRepositoryMock: vi.fn(),
  getOperationRepositoryMock: vi.fn(),
  getUserFileDataMapperMock: vi.fn(),
  getWorkOrderInteractionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/adapters/RepositoryFactory", async () => {
  const actual = await vi.importActual<typeof import("@/adapters/RepositoryFactory")>("@/adapters/RepositoryFactory");
  return {
    ...actual,
    getFactoryRepository: getFactoryRepositoryMock,
    getOperationRepository: getOperationRepositoryMock,
    getUserFileDataMapper: getUserFileDataMapperMock,
    getPlatformInteractionFacade: () => ({
      getWorkOrderInteraction: getWorkOrderInteractionMock,
    }),
  };
});

import { GET, POST } from "@/app/api/admin/factory/work-orders/[workOrderId]/revision/route";

function requireValue<T>(value: T | null | undefined): T {
  expect(value).toBeTruthy();
  if (value == null) throw new Error("Expected value to be present.");
  return value;
}

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedUser(db: Database.Database, userId = "usr_factory") {
  db.prepare("INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)").run(userId, `${userId}@example.com`, "Factory User");
  db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'role_admin')").run(userId);
}

function seedConversation(db: Database.Database, conversationId = "conv_factory", userId = "usr_factory") {
  db.prepare("INSERT OR IGNORE INTO conversations (id, user_id, title) VALUES (?, ?, 'Factory thread')").run(conversationId, userId);
}

function createJobRepositoryStub() {
  return {
    createJob: vi.fn(),
    findJobById: vi.fn(),
    findLatestEventForJob: vi.fn(),
    findLatestRenderableEventForJob: vi.fn(),
    findActiveJobByDedupeKey: vi.fn(),
    listJobsByConversation: vi.fn(),
    listJobsByUser: vi.fn(),
    appendEvent: vi.fn(),
    requeueExpiredRunningJobs: vi.fn(),
    listConversationEvents: vi.fn(),
    listUserEvents: vi.fn(),
    listEventsForUserJob: vi.fn(),
    claimNextQueuedJob: vi.fn(),
    transferJobsToUser: vi.fn(),
    updateJobStatus: vi.fn(),
    cancelJob: vi.fn(),
  };
}

function createBrief(overrides: Partial<ProductBrief> = {}): ProductBrief {
  return {
    id: "brief_1",
    schemaVersion: 1,
    title: "Factory launch page",
    topic: "Launching a solopreneur product",
    description: "A launch campaign for a digital product.",
    assetKinds: ["chart"],
    qaCriteria: ["accuracy", "accessibility"],
    targetChannels: ["blog"],
    executionPreferences: {
      autoRetryOnFailure: true,
      parallelizeAssets: true,
      maxAssetCount: 3,
    },
    createdAt: "2026-05-03T12:00:00.000Z",
    createdBy: "usr_factory",
    ...overrides,
  };
}

function createWorkOrder(brief: ProductBrief, overrides: Partial<WorkOrder> = {}): WorkOrder {
  const id = overrides.id ?? "wo_1";
  const dag = new DAGPlanner().generateDAG({
    brief,
    idGenerator: () => "dag_1",
    now: () => "2026-05-03T12:00:00.000Z",
  });

  return {
    id,
    schemaVersion: 1,
    operationId: overrides.operationId ?? `op_${id}`,
    briefId: brief.id,
    status: "planned",
    currentDag: dag,
    stageRuns: [],
    executionLog: [],
    revision: 1,
    previousWorkOrderIds: [],
    createdAt: "2026-05-03T12:00:00.000Z",
    userId: "usr_factory",
    conversationId: "conv_factory",
    initiatedBy: "batch_automation",
    ...overrides,
  };
}

async function exposePauseAction(operationMapper: OperationDataMapper, workOrder: WorkOrder) {
  await operationMapper.createOperation({
    id: workOrder.operationId,
    kind: "factory_work_order",
    title: "Factory work order",
    status: "running",
    riskLevel: "medium",
    conversationId: workOrder.conversationId,
    createdByUserId: workOrder.userId,
    createdByRole: "ADMIN",
    visibility: "staff",
    input: {
      request: { brief: createBrief() },
    },
  });

  const action = createFactoryWorkOrderPauseAction({
    operationId: workOrder.operationId,
    operationRevision: 1,
    idFactory: (prefix) => `${prefix}_pause`,
    payload: {
      workOrderId: workOrder.id,
      reason: "Review before execution",
    },
  });

  await operationMapper.replaceActions({
    operationId: workOrder.operationId,
    actions: [action],
  });

  return action;
}

describe("/api/admin/factory/work-orders/[workOrderId]/revision", () => {
  let db: Database.Database;
  let factoryMapper: FactoryDataMapper;
  let operationMapper: OperationDataMapper;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createDb();
    seedUser(db);
    seedConversation(db);
    factoryMapper = new FactoryDataMapper(db);
    operationMapper = new OperationDataMapper(db);

    getFactoryRepositoryMock.mockImplementation(() => factoryMapper);
    getOperationRepositoryMock.mockImplementation(() => operationMapper);
    getUserFileDataMapperMock.mockImplementation(() => ({ findById: vi.fn() }));
    const executionTimelineReader = createExecutionTimelineReader(
      createJobRepositoryStub() as never,
      factoryMapper,
    );
    const interactionFacade = new PlatformInteractionFacade({ executionTimelineReader });
    getWorkOrderInteractionMock.mockImplementation((workOrderId: string) => interactionFacade.getWorkOrderInteraction(workOrderId));
    getSessionUserMock.mockResolvedValue({
      id: "usr_factory",
      email: "factory@example.com",
      name: "Factory Admin",
      roles: ["ADMIN"],
      realRoles: [],
    });
  });

  it("rejects non-admin callers", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_member",
      email: "member@example.com",
      name: "Member",
      roles: ["AUTHENTICATED"],
      realRoles: [],
    });

    const response = await GET(new Request("https://studioordo.test/api/admin/factory/work-orders/wo_1/revision"), {
      params: Promise.resolve({ workOrderId: "wo_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ ok: false, error: expect.stringContaining("restricted to administrators") });
  });

  it("returns revision history without bespoke factory mutation actions", async () => {
    const brief = createBrief();
    const workOrder = createWorkOrder(brief, { status: "paused", pausedState: { pausedAt: "2026-05-03T12:02:00.000Z", reason: "Review", resumeFromStageKey: "research" } });
    const pausedState = requireValue(workOrder.pausedState);
    await factoryMapper.createWorkOrder(workOrder);
    await factoryMapper.saveProductionDAG(workOrder.id, workOrder.currentDag);
    await factoryMapper.createCheckpoint({
      checkpointId: "checkpoint_1",
      workOrderId: workOrder.id,
      pauseState: pausedState,
      resumeFromStageKey: "research",
      createdAt: "2026-05-03T12:02:00.000Z",
    });

    const response = await GET(new Request("https://studioordo.test/api/admin/factory/work-orders/wo_1/revision"), {
      params: Promise.resolve({ workOrderId: "wo_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.workOrder).toMatchObject({ id: "wo_1", status: "paused", operationId: "op_wo_1" });
    expect(payload.revision.actions).toEqual([]);
    expect(payload.timeline.nextActions).toEqual([]);
  });

  it("requires operation action request fields for POST", async () => {
    const brief = createBrief();
    const workOrder = createWorkOrder(brief);
    await factoryMapper.createWorkOrder(workOrder);
    await factoryMapper.saveProductionDAG(workOrder.id, workOrder.currentDag);

    const response = await POST(new Request("https://studioordo.test/api/admin/factory/work-orders/wo_1/revision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause" }),
    }), {
      params: Promise.resolve({ workOrderId: "wo_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload).toMatchObject({ errorCode: "OPERATION_ACTION_REQUEST_INVALID" });
  });

  it("dispatches factory revision through operation actions", async () => {
    const brief = createBrief();
    const workOrder = createWorkOrder(brief);
    await factoryMapper.createWorkOrder(workOrder);
    await factoryMapper.saveProductionDAG(workOrder.id, workOrder.currentDag);
    const action = await exposePauseAction(operationMapper, workOrder);

    const response = await POST(new Request("https://studioordo.test/api/admin/factory/work-orders/wo_1/revision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionId: action.id,
        operationRevision: action.operationRevision,
        idempotencyKey: action.idempotencyKey,
        payload: action.payload,
        confirmation: { confirmed: true },
      }),
    }), {
      params: Promise.resolve({ workOrderId: "wo_1" }),
    });
    const payload = await response.json();
    const paused = requireValue(await factoryMapper.findWorkOrderById("wo_1"));

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      accepted: true,
      operation: { id: "op_wo_1", kind: "factory_work_order", status: "blocked" },
    });
    expect(paused.status).toBe("paused");
    expect(paused.pausedState?.resumeFromStageKey).toBe("research");
  });
});
