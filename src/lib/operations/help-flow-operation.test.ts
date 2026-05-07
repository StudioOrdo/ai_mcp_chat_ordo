import { describe, expect, it, vi } from "vitest";

import type { OperationAction } from "@/core/entities/operation";
import type { OperationRepository, OperationSnapshot } from "@/core/use-cases/operations/OperationRepository";
import { createDefaultHelpFlowActions } from "@/core/use-cases/operations/HelpFlowOperationActions";
import { HelpFlowOperationExecutor } from "./help-flow-operation";

function snapshot(status: OperationSnapshot["operation"]["status"] = "draft", actions: OperationAction[] = []): OperationSnapshot {
  return {
    operation: {
      id: "op_help",
      kind: "help_flow",
      revision: 1,
      title: "Open Help",
      status,
      riskLevel: "info",
      conversationId: "conv_1",
      originMessageId: null,
      createdByUserId: "usr_1",
      createdByRole: "AUTHENTICATED",
      visibility: "conversation",
      currentStepId: null,
      createdAt: "2026-05-03T12:00:00.000Z",
      updatedAt: "2026-05-03T12:00:00.000Z",
      completedAt: null,
      summary: null,
      input: {},
      result: null,
      error: null,
    },
    steps: [],
    actions,
    events: [],
    artifacts: [],
  };
}

function repository(initial: OperationSnapshot): OperationRepository {
  let current = initial;
  return {
    createOperation: vi.fn(),
    updateOperationStatus: vi.fn(async ({ status }) => {
      current = { ...current, operation: { ...current.operation, status } };
      return current;
    }),
    upsertStep: vi.fn(),
    transitionStep: vi.fn(),
    replaceActions: vi.fn(async ({ actions }) => {
      current = { ...current, actions: [...actions] };
      return current;
    }),
    acceptAction: vi.fn(),
    appendEvent: vi.fn(async () => ({
      id: "evt_1",
      operationId: "op_help",
      stepId: null,
      sequence: 1,
      type: "executor_event_received" as const,
      actorType: "system" as const,
      actorId: null,
      payload: {},
      createdAt: "2026-05-03T12:00:00.000Z",
    })),
    attachArtifact: vi.fn(),
    findOperationById: vi.fn(async () => current),
    listOperationsByConversation: vi.fn(),
    listOperationsForUser: vi.fn(),
    listOperationsForAdmin: vi.fn(),
    listEvents: vi.fn(),
    listArtifacts: vi.fn(),
    listAvailableActions: vi.fn(),
    getConversationSummary: vi.fn(),
    getAdminSummary: vi.fn(),
    getHealthAggregate: vi.fn(),
    getPromptGroundingSummary: vi.fn(),
  };
}

describe("HelpFlowOperationExecutor", () => {
  it("records help actions without marking the operation complete", async () => {
    const actions = createDefaultHelpFlowActions({
      operationId: "op_help",
      operationRevision: 1,
      idFactory: (prefix) => `${prefix}_1`,
      role: "AUTHENTICATED",
      query: "backup",
      disabledReason: null,
    });
    const repo = repository(snapshot("draft", actions));

    const result = await new HelpFlowOperationExecutor().execute({
      repository: repo,
      snapshot: snapshot("draft", actions),
      action: actions[0],
      accepted: {
        accepted: true,
        duplicate: false,
        operationId: "op_help",
        actionId: actions[0].id,
        actionType: actions[0].actionType,
        idempotencyKey: actions[0].idempotencyKey,
        acceptedAt: "2026-05-03T12:00:00.000Z",
        payload: actions[0].payload,
      },
      actorUserId: "usr_1",
      actorRole: "AUTHENTICATED",
      payload: actions[0].payload,
    });

    expect(repo.appendEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "executor_event_received" }));
    expect(result?.snapshot?.operation.status).toBe("draft");
  });

  it("finishes help operations through queued, running, and succeeded", async () => {
    const actions = createDefaultHelpFlowActions({
      operationId: "op_help",
      operationRevision: 1,
      idFactory: (prefix) => `${prefix}_1`,
      role: "AUTHENTICATED",
      query: "backup",
      disabledReason: null,
    });
    const finish = actions.find((action) => action.actionType === "help.finish");
    if (!finish) throw new Error("Missing help.finish action");
    const repo = repository(snapshot("draft", actions));

    const result = await new HelpFlowOperationExecutor().execute({
      repository: repo,
      snapshot: snapshot("draft", actions),
      action: finish,
      accepted: {
        accepted: true,
        duplicate: false,
        operationId: "op_help",
        actionId: finish.id,
        actionType: finish.actionType,
        idempotencyKey: finish.idempotencyKey,
        acceptedAt: "2026-05-03T12:00:00.000Z",
        payload: finish.payload,
      },
      actorUserId: "usr_1",
      actorRole: "AUTHENTICATED",
      payload: finish.payload,
    });

    expect(result?.snapshot?.operation.status).toBe("succeeded");
    expect(repo.replaceActions).toHaveBeenCalledWith(expect.objectContaining({ actions: [] }));
  });
});
