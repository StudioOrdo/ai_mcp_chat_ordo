import { describe, expect, it } from "vitest";

import type { OperationAction } from "@/core/entities/operation";
import type { OperationSnapshot } from "@/core/use-cases/operations/OperationRepository";
import { operationCardBlock, operationSnapshotToCardModel, parseSerializedOperationCard, serializeOperationCardMarkdown } from "./operation-presentation";

const action: OperationAction = {
  id: "act_1",
  operationId: "op_1",
  operationRevision: 1,
  actionType: "help.search",
  label: "Search Help",
  riskLevel: "info",
  confirmPolicy: "none",
  allowedRoles: ["AUTHENTICATED"],
  allowedStatuses: ["draft"],
  enabled: true,
  disabledReason: null,
  idempotencyKey: "idem_1",
  expiresAt: null,
  payload: { query: "backup", role: "AUTHENTICATED" },
  payloadSchemaKey: "help.search",
  confirmationText: null,
};

function snapshot(): OperationSnapshot {
  return {
    operation: {
      id: "op_1",
      kind: "help_flow",
      revision: 1,
      title: "Open Help",
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
      summary: "Help summary",
      input: {},
      result: null,
      error: null,
    },
    steps: [],
    actions: [action],
    events: [{
      id: "evt_1",
      operationId: "op_1",
      stepId: null,
      sequence: 1,
      type: "operation_created",
      actorType: "system",
      actorId: null,
      payload: {},
      createdAt: "2026-05-03T12:00:00.000Z",
    }],
    artifacts: [],
  };
}

describe("operation presentation", () => {
  it("maps operation snapshots to stable card models", () => {
    const model = operationSnapshotToCardModel(snapshot());

    expect(model).toMatchObject({
      operationId: "op_1",
      title: "Open Help",
      kind: "help_flow",
      statusLabel: "draft",
      riskLabel: "info",
      actionCount: 1,
      latestEventLabel: "operation created",
    });
    expect(model.actions[0]).toMatchObject({
      label: "Search Help",
      actionType: "operation",
      value: "op_1",
    });
  });

  it("serializes and parses operation-card blocks for rich content", () => {
    const model = operationSnapshotToCardModel(snapshot());
    const parsed = parseSerializedOperationCard(serializeOperationCardMarkdown(model));

    expect(parsed).toEqual(model);
    expect(operationCardBlock(model)).toEqual({ type: "operation-card", operation: model });
  });
});
