import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

import type {
  Operation,
  OperationAction,
  OperationArtifact,
  OperationEvent,
  OperationStep,
} from "@/core/entities/operation";
import { OperationAuthorizationError } from "@/core/entities/operation";
import type { OperationRepository, OperationSnapshot } from "@/core/use-cases/operations/OperationRepository";

const {
  getSessionUserMock,
  getOperationRepositoryMock,
  getBackupSelfServiceMock,
  getBackupSnapshotDataMapperMock,
  getBackupSystemCommandDataMapperMock,
  getRestorePlanDataMapperMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getOperationRepositoryMock: vi.fn(),
  getBackupSelfServiceMock: vi.fn(),
  getBackupSnapshotDataMapperMock: vi.fn(),
  getBackupSystemCommandDataMapperMock: vi.fn(),
  getRestorePlanDataMapperMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getBackupSelfService: getBackupSelfServiceMock,
  getBackupSnapshotDataMapper: getBackupSnapshotDataMapperMock,
  getBackupSystemCommandDataMapper: getBackupSystemCommandDataMapperMock,
  getOperationRepository: getOperationRepositoryMock,
  getRestorePlanDataMapper: getRestorePlanDataMapperMock,
}));

import { POST } from "@/app/api/operations/[operationId]/actions/[actionId]/route";

const operation: Operation = {
  id: "op_1",
  kind: "system_diagnostic",
  revision: 1,
  title: "Run diagnostic",
  status: "draft",
  riskLevel: "medium",
  conversationId: "conv_1",
  originMessageId: "msg_1",
  createdByUserId: "usr_admin",
  createdByRole: "ADMIN",
  visibility: "admin",
  currentStepId: null,
  createdAt: "2026-05-03T12:00:00.000Z",
  updatedAt: "2026-05-03T12:00:00.000Z",
  completedAt: null,
  summary: null,
  input: {},
  result: null,
  error: null,
};

const action: OperationAction = {
  id: "action_1",
  operationId: "op_1",
  operationRevision: 1,
  actionType: "diagnostic.run",
  label: "Run diagnostic",
  riskLevel: "medium",
  confirmPolicy: "single_click",
  allowedRoles: ["ADMIN"],
  allowedStatuses: ["draft"],
  enabled: true,
  disabledReason: null,
  idempotencyKey: "idem_1",
  expiresAt: null,
  payload: {},
  payloadSchemaKey: "empty",
  confirmationText: null,
};

function createSnapshot(overrides: Partial<OperationSnapshot> = {}): OperationSnapshot {
  return {
    operation,
    steps: [] as OperationStep[],
    actions: [action],
    events: [] as OperationEvent[],
    artifacts: [] as OperationArtifact[],
    ...overrides,
  };
}

function createRepository(snapshot = createSnapshot()): OperationRepository {
  const events: OperationEvent[] = [];
  return {
    createOperation: vi.fn(),
    updateOperationStatus: vi.fn(),
    upsertStep: vi.fn(),
    transitionStep: vi.fn(),
    replaceActions: vi.fn(),
    acceptAction: vi.fn(async (input) => ({
      accepted: true as const,
      duplicate: false,
      operationId: input.operationId,
      actionId: input.actionId,
      actionType: snapshot.actions[0]?.actionType ?? "diagnostic.run",
      idempotencyKey: input.idempotencyKey,
      acceptedAt: "2026-05-03T12:00:01.000Z",
      payload: input.payload ?? {},
    })),
    appendEvent: vi.fn(async (input) => {
      const event: OperationEvent = {
        id: `evt_${events.length + 1}`,
        operationId: input.operationId,
        stepId: input.stepId ?? null,
        sequence: events.length + 1,
        type: input.type,
        actorType: input.actorType ?? "system",
        actorId: input.actorId ?? null,
        payload: input.payload ?? {},
        createdAt: input.now ?? "2026-05-03T12:00:01.000Z",
      };
      events.push(event);
      return event;
    }),
    attachArtifact: vi.fn(),
    findOperationById: vi.fn(async (id) => id === snapshot.operation.id ? { ...snapshot, events: [...events] } : null),
    listOperationsByConversation: vi.fn(),
    listOperationsForUser: vi.fn(),
    listOperationsForAdmin: vi.fn(),
    listEvents: vi.fn(async () => [...events]),
    listArtifacts: vi.fn(),
    listAvailableActions: vi.fn(async () => snapshot.actions),
    getConversationSummary: vi.fn(async () => ({
      operationId: snapshot.operation.id,
      kind: snapshot.operation.kind,
      title: snapshot.operation.title,
      status: snapshot.operation.status,
      riskLevel: snapshot.operation.riskLevel,
      revision: snapshot.operation.revision,
      currentStepId: snapshot.operation.currentStepId,
      summary: snapshot.operation.summary,
      progress: {
        totalSteps: 0,
        pendingSteps: 0,
        readySteps: 0,
        runningSteps: 0,
        blockedSteps: 0,
        succeededSteps: 0,
        failedSteps: 0,
        skippedSteps: 0,
        cancelledSteps: 0,
        percentComplete: 0,
      },
      availableActions: snapshot.actions,
      latestEvent: events.at(-1) ?? null,
      updatedAt: snapshot.operation.updatedAt,
    })),
    getAdminSummary: vi.fn(),
    getHealthAggregate: vi.fn(),
    getPromptGroundingSummary: vi.fn(),
  };
}

function request(body: unknown): NextRequest {
  return new Request("http://localhost/api/operations/op_1/actions/action_1", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }) as NextRequest;
}

const routeContext = {
  params: Promise.resolve({ operationId: "op_1", actionId: "action_1" }),
};

describe("POST /api/operations/[operationId]/actions/[actionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBackupSelfServiceMock.mockReturnValue({});
    getBackupSnapshotDataMapperMock.mockReturnValue({});
    getBackupSystemCommandDataMapperMock.mockReturnValue({});
    getRestorePlanDataMapperMock.mockReturnValue({});
    getSessionUserMock.mockResolvedValue({
      id: "usr_admin",
      email: "admin@example.com",
      name: "Admin",
      roles: ["AUTHENTICATED", "ADMIN"],
    });
  });

  it("accepts a current operation action by durable operationId and actionId", async () => {
    const repository = createRepository();
    getOperationRepositoryMock.mockReturnValue(repository);

    const response = await POST(request({
      idempotencyKey: "idem_1",
      operationRevision: 1,
      confirmation: { confirmed: true },
    }), routeContext);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      accepted: true,
      duplicate: false,
      operation: { id: "op_1", conversationId: "conv_1" },
      conversationSummary: { operationId: "op_1" },
    });
    expect(repository.acceptAction).toHaveBeenCalledWith(expect.objectContaining({
      operationId: "op_1",
      actionId: "action_1",
      idempotencyKey: "idem_1",
      actorRole: "ADMIN",
      actorUserId: "usr_admin",
    }));
  });

  it("returns 422 for malformed request bodies before dispatch", async () => {
    const repository = createRepository();
    getOperationRepositoryMock.mockReturnValue(repository);

    const response = await POST(request({
      idempotencyKey: "idem_1",
      operationRevision: 0,
    }), routeContext);
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.errorCode).toBe("OPERATION_ACTION_REQUEST_INVALID");
    expect(repository.acceptAction).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated users rejected by operation policy", async () => {
    const repository = createRepository();
    vi.mocked(repository.acceptAction).mockRejectedValueOnce(new OperationAuthorizationError("Requires ADMIN role."));
    getSessionUserMock.mockResolvedValue({
      id: "usr_staff",
      email: "staff@example.com",
      name: "Staff",
      roles: ["STAFF"],
    });
    getOperationRepositoryMock.mockReturnValue(repository);

    const response = await POST(request({
      idempotencyKey: "idem_1",
      operationRevision: 1,
      confirmation: { confirmed: true },
    }), routeContext);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.errorCode).toBe("OPERATION_AUTHORIZATION_DENIED");
    expect(payload.operation).toMatchObject({ id: "op_1" });
  });

  it("returns 409 and appends rejection for stale client revisions before acceptance", async () => {
    const repository = createRepository();
    getOperationRepositoryMock.mockReturnValue(repository);

    const response = await POST(request({
      idempotencyKey: "idem_1",
      operationRevision: 2,
      confirmation: { confirmed: true },
    }), routeContext);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.errorCode).toBe("OPERATION_ACTION_STALE");
    expect(repository.acceptAction).not.toHaveBeenCalled();
    expect(repository.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "action_rejected",
      payload: expect.objectContaining({ errorCode: "OPERATION_ACTION_STALE" }),
    }));
  });

  it("returns 501 when no operation executor is registered for the stored action type", async () => {
    const repository = createRepository(createSnapshot({
      actions: [{ ...action, actionType: "unknown.action" }],
    }));
    getOperationRepositoryMock.mockReturnValue(repository);

    const response = await POST(request({
      idempotencyKey: "idem_1",
      operationRevision: 1,
      confirmation: { confirmed: true },
    }), routeContext);
    const payload = await response.json();

    expect(response.status).toBe(501);
    expect(payload.errorCode).toBe("OPERATION_ACTION_EXECUTOR_UNAVAILABLE");
    expect(repository.acceptAction).not.toHaveBeenCalled();
  });

  it("does not import concrete operation data mappers in the route", () => {
    const source = readFileSync("src/app/api/operations/[operationId]/actions/[actionId]/route.ts", "utf8");
    expect(source).not.toContain("OperationDataMapper");
    expect(source).toContain("createOperationActionDispatchService");
  });
});
