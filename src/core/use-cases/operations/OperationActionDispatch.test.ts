import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  OperationActionDispatchError,
  OperationActionDispatchService,
  type OperationActionExecutor,
} from "@/core/use-cases/operations/OperationActionDispatch";
import {
  OperationActionStaleError,
  type Operation,
  type OperationAction,
  type OperationArtifact,
  type OperationEvent,
  type OperationStep,
} from "@/core/entities/operation";
import type {
  OperationRepository,
  OperationSnapshot,
} from "@/core/use-cases/operations/OperationRepository";

const operation: Operation = {
  id: "op_1",
  kind: "backup_create",
  revision: 1,
  title: "Create backup",
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
  let acceptedAt: string | null = null;
  const events: OperationEvent[] = [];

  return {
    createOperation: vi.fn(),
    updateOperationStatus: vi.fn(),
    upsertStep: vi.fn(),
    transitionStep: vi.fn(),
    replaceActions: vi.fn(),
    acceptAction: vi.fn(async (input) => {
      if (input.idempotencyKey !== action.idempotencyKey) {
        throw new OperationActionStaleError("Operation action idempotency key does not match stored action.");
      }
      if (acceptedAt) {
        const duplicateAcceptedAt = acceptedAt;
        return {
          accepted: true as const,
          duplicate: true,
          operationId: input.operationId,
          actionId: input.actionId,
          actionType: action.actionType,
          idempotencyKey: input.idempotencyKey,
          acceptedAt: duplicateAcceptedAt,
          payload: input.payload ?? {},
        };
      }

      const currentAcceptedAt = input.now ?? "2026-05-03T12:00:01.000Z";
      acceptedAt = currentAcceptedAt;
      events.push({
        id: `evt_${events.length + 1}`,
        operationId: input.operationId,
        stepId: null,
        sequence: events.length + 1,
        type: "action_requested",
        actorType: "user",
        actorId: input.actorUserId ?? null,
        payload: { actionId: input.actionId },
        createdAt: currentAcceptedAt,
      });

      return {
        accepted: true as const,
        duplicate: false,
        operationId: input.operationId,
        actionId: input.actionId,
        actionType: action.actionType,
        idempotencyKey: input.idempotencyKey,
        acceptedAt: currentAcceptedAt,
        payload: input.payload ?? {},
      };
    }),
    appendEvent: vi.fn(async (input) => {
      const event: OperationEvent = {
        id: input.id ?? `evt_${events.length + 1}`,
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
    findOperationById: vi.fn(async (id) => id === snapshot.operation.id
      ? { ...snapshot, events: [...events] }
      : null),
    listOperationsByConversation: vi.fn(),
    listOperationsForUser: vi.fn(),
    listOperationsForAdmin: vi.fn(),
    listEvents: vi.fn(async () => [...events]),
    listArtifacts: vi.fn(),
    listAvailableActions: vi.fn(async () => acceptedAt ? [] : [action]),
    getConversationSummary: vi.fn(async () => ({
      operationId: operation.id,
      kind: operation.kind,
      title: operation.title,
      status: operation.status,
      riskLevel: operation.riskLevel,
      revision: operation.revision,
      currentStepId: operation.currentStepId,
      summary: operation.summary,
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
      availableActions: acceptedAt ? [] : [action],
      latestEvent: events.at(-1) ?? null,
      updatedAt: operation.updatedAt,
    })),
    getAdminSummary: vi.fn(),
    getHealthAggregate: vi.fn(),
    getPromptGroundingSummary: vi.fn(),
  };
}

function createExecutor(): OperationActionExecutor {
  return {
    canExecute: vi.fn((actionType) => actionType === "diagnostic.run"),
    execute: vi.fn(async () => undefined),
  };
}

describe("OperationActionDispatchService", () => {
  let repository: OperationRepository;
  let executor: OperationActionExecutor;
  let service: OperationActionDispatchService;

  beforeEach(() => {
    repository = createRepository();
    executor = createExecutor();
    service = new OperationActionDispatchService({ repository, executors: [executor] });
  });

  it("accepts a valid action and executes the registered command", async () => {
    const result = await service.dispatch({
      operationId: "op_1",
      actionId: "action_1",
      idempotencyKey: "idem_1",
      clientOperationRevision: 1,
      actorUserId: "usr_admin",
      actorRole: "ADMIN",
      confirmation: { confirmed: true },
      now: "2026-05-03T12:00:02.000Z",
    });

    expect(result).toMatchObject({
      accepted: true,
      duplicate: false,
      operationId: "op_1",
      actionId: "action_1",
      actionType: "diagnostic.run",
      conversationSummary: { operationId: "op_1" },
    });
    expect(repository.acceptAction).toHaveBeenCalledWith(expect.objectContaining({
      operationId: "op_1",
      actionId: "action_1",
      idempotencyKey: "idem_1",
      actorRole: "ADMIN",
    }));
    expect(executor.execute).toHaveBeenCalledWith(expect.objectContaining({
      action,
      actorUserId: "usr_admin",
      actorRole: "ADMIN",
    }));
  });

  it("rejects stale client revisions before action acceptance", async () => {
    await expect(service.dispatch({
      operationId: "op_1",
      actionId: "action_1",
      idempotencyKey: "idem_1",
      clientOperationRevision: 0,
      actorUserId: "usr_admin",
      actorRole: "ADMIN",
      confirmation: { confirmed: true },
    })).rejects.toMatchObject({
      code: "OPERATION_ACTION_STALE",
      snapshot: { operation: { id: "op_1" } },
    });

    expect(repository.acceptAction).not.toHaveBeenCalled();
    expect(repository.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      operationId: "op_1",
      type: "action_rejected",
      payload: expect.objectContaining({
        actionId: "action_1",
        errorCode: "OPERATION_ACTION_STALE",
      }),
    }));
  });

  it("rejects unknown action executors before action acceptance", async () => {
    service = new OperationActionDispatchService({ repository, executors: [] });

    await expect(service.dispatch({
      operationId: "op_1",
      actionId: "action_1",
      idempotencyKey: "idem_1",
      clientOperationRevision: 1,
      actorUserId: "usr_admin",
      actorRole: "ADMIN",
      confirmation: { confirmed: true },
    })).rejects.toBeInstanceOf(OperationActionDispatchError);

    expect(repository.acceptAction).not.toHaveBeenCalled();
    expect(repository.appendEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "action_rejected",
      payload: expect.objectContaining({
        errorCode: "OPERATION_ACTION_EXECUTOR_UNAVAILABLE",
      }),
    }));
  });

  it("preserves duplicate idempotent clicks without executor replay", async () => {
    const input = {
      operationId: "op_1",
      actionId: "action_1",
      idempotencyKey: "idem_1",
      clientOperationRevision: 1,
      actorUserId: "usr_admin",
      actorRole: "ADMIN" as const,
      confirmation: { confirmed: true },
    };

    await service.dispatch(input);
    const duplicate = await service.dispatch(input);

    expect(duplicate.duplicate).toBe(true);
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });
});
