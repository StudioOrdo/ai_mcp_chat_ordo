import { describe, expect, it, vi } from "vitest";

import type { OperationAction } from "@/core/entities/operation";
import type { OperationRepository, OperationSnapshot } from "@/core/use-cases/operations/OperationRepository";
import { createDefaultHelpFlowActions } from "@/core/use-cases/operations/HelpFlowOperationActions";
import { createDefaultOnboardingFlowActions } from "@/core/use-cases/operations/OnboardingFlowOperationActions";
import { createOperationActionDispatchService } from "./operation-action-dispatch-root";

function baseSnapshot(kind: "help_flow" | "onboarding_flow", actions: OperationAction[]): OperationSnapshot {
  return {
    operation: {
      id: "op_1",
      kind,
      revision: 1,
      title: kind === "help_flow" ? "Open Help" : "Start Onboarding",
      status: "draft",
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

function repository(snapshot: OperationSnapshot): OperationRepository {
  let current = snapshot;
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
    acceptAction: vi.fn(async (input) => ({
      accepted: true as const,
      duplicate: false,
      operationId: input.operationId,
      actionId: input.actionId,
      actionType: current.actions.find((action) => action.id === input.actionId)?.actionType ?? "help.search",
      idempotencyKey: input.idempotencyKey,
      acceptedAt: "2026-05-03T12:00:00.000Z",
      payload: input.payload ?? current.actions.find((action) => action.id === input.actionId)?.payload ?? {},
    })),
    appendEvent: vi.fn(async (input) => ({
      id: "evt_1",
      operationId: input.operationId,
      stepId: input.stepId ?? null,
      sequence: 1,
      type: input.type,
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? null,
      payload: input.payload ?? {},
      createdAt: input.now ?? "2026-05-03T12:00:00.000Z",
    })),
    attachArtifact: vi.fn(),
    findOperationById: vi.fn(async () => current),
    listOperationsByConversation: vi.fn(),
    listOperationsForUser: vi.fn(),
    listOperationsForAdmin: vi.fn(),
    listEvents: vi.fn(),
    listArtifacts: vi.fn(),
    listAvailableActions: vi.fn(async () => current.actions),
    getConversationSummary: vi.fn(async () => null),
    getAdminSummary: vi.fn(),
    getHealthAggregate: vi.fn(),
    getPromptGroundingSummary: vi.fn(),
  };
}

describe("operation action dispatch root", () => {
  it("registers help flow executors without touching unrelated feature roots", async () => {
    const actions = createDefaultHelpFlowActions({
      operationId: "op_1",
      operationRevision: 1,
      idFactory: (prefix) => `${prefix}_1`,
      role: "AUTHENTICATED",
      query: "backup",
      disabledReason: null,
    });
    const repo = repository(baseSnapshot("help_flow", actions));

    const result = await createOperationActionDispatchService({ repository: repo }).dispatch({
      operationId: "op_1",
      actionId: actions[0].id,
      idempotencyKey: actions[0].idempotencyKey,
      clientOperationRevision: 1,
      actorUserId: "usr_1",
      actorRole: "AUTHENTICATED",
      payload: actions[0].payload,
    });

    expect(result.accepted).toBe(true);
    expect(repo.appendEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "executor_event_received" }));
  });

  it("registers onboarding flow executors", async () => {
    const actions = createDefaultOnboardingFlowActions({
      operationId: "op_1",
      operationRevision: 1,
      idFactory: (prefix) => `${prefix}_1`,
      role: "AUTHENTICATED",
      disabledReason: null,
    });
    const repo = repository(baseSnapshot("onboarding_flow", actions));

    const result = await createOperationActionDispatchService({ repository: repo }).dispatch({
      operationId: "op_1",
      actionId: actions[0].id,
      idempotencyKey: actions[0].idempotencyKey,
      clientOperationRevision: 1,
      actorUserId: "usr_1",
      actorRole: "AUTHENTICATED",
      payload: actions[0].payload,
    });

    expect(result.accepted).toBe(true);
    expect(repo.appendEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "executor_event_received" }));
  });
});
