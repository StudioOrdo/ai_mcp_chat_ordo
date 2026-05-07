import { describe, expect, it } from "vitest";

import type { OperationAction } from "@/core/entities/operation";
import {
  buildOperationActionDispatchPayload,
  operationActionToActionLink,
  parseOperationActionLinkModel,
  OperationActionViewModelError,
} from "@/lib/operations/operation-action-view-model";

const action: OperationAction = {
  id: "action_1",
  operationId: "op_1",
  operationRevision: 3,
  actionType: "restore.execute",
  label: "Execute restore",
  riskLevel: "destructive",
  confirmPolicy: "phrase",
  allowedRoles: ["ADMIN"],
  allowedStatuses: ["awaiting_confirmation"],
  enabled: true,
  disabledReason: null,
  idempotencyKey: "idem_1",
  expiresAt: null,
  payload: { restorePlanId: "restore_1" },
  payloadSchemaKey: "restore.execute",
  confirmationText: "RESTORE restore_1",
};

describe("operation-action-view-model", () => {
  it("maps a stored OperationAction to a first-class operation action link", () => {
    expect(operationActionToActionLink(action)).toEqual({
      type: "action-link",
      label: "Execute restore",
      actionType: "operation",
      value: "op_1",
      params: {
        operationId: "op_1",
        actionId: "action_1",
        idempotencyKey: "idem_1",
        operationRevision: "3",
        confirmPolicy: "phrase",
        riskLevel: "destructive",
        payloadJson: JSON.stringify({ restorePlanId: "restore_1" }),
        confirmationText: "RESTORE restore_1",
      },
    });
  });

  it("parses operation action params and builds an API payload", () => {
    const model = parseOperationActionLinkModel("op_1", {
      operationId: "op_1",
      actionId: "action_1",
      idempotencyKey: "idem_1",
      operationRevision: "3",
      confirmPolicy: "phrase",
      riskLevel: "destructive",
      payloadJson: JSON.stringify({ restorePlanId: "restore_1" }),
      confirmationText: "RESTORE restore_1",
    });

    expect(model).toMatchObject({
      operationId: "op_1",
      actionId: "action_1",
      idempotencyKey: "idem_1",
      operationRevision: 3,
      payload: { restorePlanId: "restore_1" },
      confirmPolicy: "phrase",
      riskLevel: "destructive",
      confirmationText: "RESTORE restore_1",
    });
    expect(buildOperationActionDispatchPayload(model, {
      confirmed: true,
      phrase: "RESTORE restore_1",
    })).toEqual({
      idempotencyKey: "idem_1",
      operationRevision: 3,
      payload: { restorePlanId: "restore_1" },
      confirmation: {
        confirmed: true,
        phrase: "RESTORE restore_1",
      },
    });
  });

  it("preserves disabled reasons so UI can render without dispatching", () => {
    const link = operationActionToActionLink({
      ...action,
      enabled: false,
      disabledReason: "Restore plan has expired.",
    });

    expect(link.params?.disabledReason).toBe("Restore plan has expired.");
    expect(parseOperationActionLinkModel(link.value, link.params).disabledReason).toBe("Restore plan has expired.");
  });

  it("rejects malformed payload JSON before network dispatch", () => {
    expect(() => parseOperationActionLinkModel("op_1", {
      operationId: "op_1",
      actionId: "action_1",
      idempotencyKey: "idem_1",
      operationRevision: "3",
      payloadJson: "{not-json",
    })).toThrow(OperationActionViewModelError);
  });
});
