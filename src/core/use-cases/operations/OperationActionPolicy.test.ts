import { describe, expect, it } from "vitest";

import type { Operation, OperationAction } from "@/core/entities/operation";
import type { ProductBrief } from "@/core/entities/product-brief";
import {
  OperationActionRejectedError,
  OperationActionStaleError,
  OperationAuthorizationError,
  OperationPayloadValidationError,
} from "@/core/entities/operation";

import { OperationActionPolicy } from "./OperationActionPolicy";

const NOW = "2026-05-03T12:00:00.000Z";

function operation(overrides: Partial<Operation> = {}): Operation {
  return {
    id: "op_1",
    kind: "restore_execute",
    revision: 3,
    title: "Restore appliance",
    status: "awaiting_confirmation",
    riskLevel: "destructive",
    conversationId: "conv_1",
    originMessageId: "msg_1",
    createdByUserId: "usr_1",
    createdByRole: "ADMIN",
    visibility: "admin",
    currentStepId: "step_confirm",
    createdAt: "2026-05-03T11:00:00.000Z",
    updatedAt: "2026-05-03T11:30:00.000Z",
    completedAt: null,
    summary: null,
    input: {},
    result: null,
    error: null,
    ...overrides,
  };
}

function action(overrides: Partial<OperationAction> = {}): OperationAction {
  return {
    id: "act_execute_restore",
    operationId: "op_1",
    operationRevision: 3,
    actionType: "restore.execute",
    label: "Execute Restore",
    riskLevel: "destructive",
    confirmPolicy: "phrase",
    allowedRoles: ["ADMIN"],
    allowedStatuses: ["awaiting_confirmation", "blocked", "queued"],
    enabled: true,
    disabledReason: null,
    idempotencyKey: "op_1:act_execute_restore:3",
    expiresAt: "2026-05-03T13:00:00.000Z",
    payload: { restorePlanId: "restore_1" },
    payloadSchemaKey: "restore.execute",
    confirmationText: "RESTORE restore_1",
    ...overrides,
  };
}

function productBrief(overrides: Partial<ProductBrief> = {}): ProductBrief {
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
    createdAt: "2026-05-03T12:00:00.000Z",
    createdBy: "usr_1",
    ...overrides,
  };
}

describe("OperationActionPolicy", () => {
  const policy = new OperationActionPolicy();

  it("accepts an admin restore action with matching revision, status, confirmation, and payload", () => {
    const result = policy.evaluate({
      operation: operation(),
      action: action(),
      actorRole: "ADMIN",
      confirmation: { phrase: "RESTORE restore_1" },
      now: NOW,
    });

    expect(result).toMatchObject({
      accepted: true,
      duplicate: false,
      operationId: "op_1",
      actionType: "restore.execute",
      idempotencyKey: "op_1:act_execute_restore:3",
      payload: { restorePlanId: "restore_1" },
    });
  });

  it("rejects non-admin destructive restore actions", () => {
    expect(() => policy.evaluate({
      operation: operation(),
      action: action(),
      actorRole: "STAFF",
      confirmation: { phrase: "RESTORE restore_1" },
      now: NOW,
    })).toThrow(OperationAuthorizationError);
  });

  it("rejects stale action revisions with current status and available actions", () => {
    expect(() => policy.evaluate({
      operation: operation({ revision: 4, status: "blocked" }),
      action: action({ operationRevision: 3 }),
      actorRole: "ADMIN",
      confirmation: { phrase: "RESTORE restore_1" },
      now: NOW,
      availableActions: [action({ id: "act_cancel", actionType: "restore.cancel", label: "Cancel Restore" })],
    })).toThrow(OperationActionStaleError);
  });

  it("treats repeated accepted idempotency keys as the same action request", () => {
    const result = policy.evaluate({
      operation: operation({ revision: 4, status: "blocked" }),
      action: action({ operationRevision: 3 }),
      actorRole: "ADMIN",
      acceptedIdempotencyKeys: ["op_1:act_execute_restore:3"],
      now: NOW,
    });

    expect(result.duplicate).toBe(true);
  });

  it("rejects replaying the same action id with a different idempotency key", () => {
    expect(() => policy.evaluate({
      operation: operation(),
      action: action({ idempotencyKey: "op_1:act_execute_restore:different" }),
      actorRole: "ADMIN",
      confirmation: { phrase: "RESTORE restore_1" },
      acceptedActionIds: ["act_execute_restore"],
      acceptedIdempotencyKeys: ["op_1:act_execute_restore:3"],
      now: NOW,
    })).toThrow(OperationActionStaleError);
  });

  it("rejects actions that are not allowed in the current operation status", () => {
    expect(() => policy.evaluate({
      operation: operation({ status: "succeeded" }),
      action: action({ allowedStatuses: ["awaiting_confirmation"] }),
      actorRole: "ADMIN",
      confirmation: { phrase: "RESTORE restore_1" },
      now: NOW,
    })).toThrow(OperationActionStaleError);
  });

  it("rejects disabled actions", () => {
    expect(() => policy.evaluate({
      operation: operation(),
      action: action({ enabled: false, disabledReason: "Safety backup is still running." }),
      actorRole: "ADMIN",
      confirmation: { phrase: "RESTORE restore_1" },
      now: NOW,
    })).toThrow(OperationActionRejectedError);
  });

  it("rejects expired actions as stale", () => {
    expect(() => policy.evaluate({
      operation: operation(),
      action: action({ expiresAt: "2026-05-03T11:59:59.000Z" }),
      actorRole: "ADMIN",
      confirmation: { phrase: "RESTORE restore_1" },
      now: NOW,
    })).toThrow(OperationActionStaleError);
  });

  it("rejects destructive actions without explicit confirmation policy", () => {
    expect(() => policy.evaluate({
      operation: operation(),
      action: action({ confirmPolicy: "none" }),
      actorRole: "ADMIN",
      now: NOW,
    })).toThrow(OperationActionRejectedError);
  });

  it("rejects invalid payload shape", () => {
    expect(() => policy.evaluate({
      operation: operation(),
      action: action({ payload: {}, payloadSchemaKey: "restore.execute" }),
      actorRole: "ADMIN",
      confirmation: { phrase: "RESTORE restore_1" },
      now: NOW,
    })).toThrow(OperationPayloadValidationError);
  });

  it("accepts a medium-risk backup action with single-click confirmation", () => {
    const result = policy.evaluate({
      operation: operation({ kind: "backup_create", status: "draft", riskLevel: "medium" }),
      action: action({
        id: "act_backup",
        actionType: "backup.create",
        label: "Create Backup",
        riskLevel: "medium",
        confirmPolicy: "single_click",
        allowedStatuses: ["draft"],
        payload: {},
        payloadSchemaKey: "backup.create",
        confirmationText: null,
      }),
      actorRole: "ADMIN",
      confirmation: { confirmed: true },
      now: NOW,
    });

    expect(result.actionType).toBe("backup.create");
  });

  it("validates backup validate payloads", () => {
    expect(() => policy.evaluate({
      operation: operation({ kind: "backup_create", status: "draft", riskLevel: "medium" }),
      action: action({
        id: "act_backup_validate",
        actionType: "backup.validate",
        label: "Validate Backup",
        riskLevel: "medium",
        confirmPolicy: "single_click",
        allowedStatuses: ["draft"],
        payload: {},
        payloadSchemaKey: "backup.validate",
        confirmationText: null,
      }),
      actorRole: "ADMIN",
      confirmation: { confirmed: true },
      now: NOW,
    })).toThrow(OperationPayloadValidationError);
  });

  it("validates restore confirm payloads and phrase confirmation", () => {
    const result = policy.evaluate({
      operation: operation({ status: "awaiting_confirmation" }),
      action: action({
        id: "act_restore_confirm",
        actionType: "restore.confirm",
        label: "Confirm Restore",
        riskLevel: "destructive",
        confirmPolicy: "phrase",
        allowedStatuses: ["awaiting_confirmation"],
        payload: { restorePlanId: "restore_1" },
        payloadSchemaKey: "restore.confirm",
        confirmationText: "RESTORE restore_1",
      }),
      actorRole: "ADMIN",
      confirmation: { phrase: "RESTORE restore_1" },
      now: NOW,
    });

    expect(result.actionType).toBe("restore.confirm");
  });

  it("validates media workflow create payloads", () => {
    const result = policy.evaluate({
      operation: operation({ kind: "media_workflow", status: "draft", riskLevel: "medium" }),
      action: action({
        id: "act_media_create",
        actionType: "media.workflow.create",
        label: "Create media workflow",
        riskLevel: "medium",
        confirmPolicy: "single_click",
        allowedRoles: ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
        allowedStatuses: ["draft", "blocked"],
        payload: {
          requestedDeliverable: "audio",
          template: "generated_audio",
          idempotencyKey: "media_idem_1",
        },
        payloadSchemaKey: "media.workflow.create",
        confirmationText: null,
      }),
      actorRole: "AUTHENTICATED",
      confirmation: { confirmed: true },
      now: NOW,
    });

    expect(result.actionType).toBe("media.workflow.create");
  });

  it("rejects malformed media workflow retry and cancel payloads", () => {
    expect(() => policy.evaluate({
      operation: operation({ kind: "media_workflow", status: "failed", riskLevel: "medium" }),
      action: action({
        id: "act_media_retry",
        actionType: "media.workflow.retry_step",
        label: "Retry media step",
        riskLevel: "medium",
        confirmPolicy: "single_click",
        allowedRoles: ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
        allowedStatuses: ["failed"],
        payload: { workflowId: "mwf_1" },
        payloadSchemaKey: "media.workflow.retry_step",
        confirmationText: null,
      }),
      actorRole: "AUTHENTICATED",
      confirmation: { confirmed: true },
      now: NOW,
    })).toThrow(OperationPayloadValidationError);

    expect(() => policy.evaluate({
      operation: operation({ kind: "media_workflow", status: "running", riskLevel: "medium" }),
      action: action({
        id: "act_media_cancel",
        actionType: "media.workflow.cancel",
        label: "Cancel media workflow",
        riskLevel: "low",
        confirmPolicy: "single_click",
        allowedRoles: ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
        allowedStatuses: ["running"],
        payload: { workflowId: "mwf_1" },
        payloadSchemaKey: "media.workflow.cancel",
        confirmationText: null,
      }),
      actorRole: "AUTHENTICATED",
      confirmation: { confirmed: true },
      now: NOW,
    })).toThrow(OperationPayloadValidationError);
  });

  it("accepts factory work-order create actions for staff/admin with valid briefs", () => {
    const result = policy.evaluate({
      operation: operation({ kind: "factory_work_order", status: "draft", riskLevel: "medium", createdByRole: "STAFF" }),
      action: action({
        id: "act_factory_create",
        actionType: "factory.work_order.create",
        label: "Create work order",
        riskLevel: "medium",
        confirmPolicy: "single_click",
        allowedRoles: ["STAFF", "ADMIN"],
        allowedStatuses: ["draft", "blocked"],
        payload: { brief: productBrief(), previousWorkOrderIds: [] },
        payloadSchemaKey: "factory.work_order.create",
        confirmationText: null,
      }),
      actorRole: "STAFF",
      confirmation: { confirmed: true },
      now: NOW,
    });

    expect(result.actionType).toBe("factory.work_order.create");
  });

  it("rejects malformed factory retry and refinement payloads", () => {
    expect(() => policy.evaluate({
      operation: operation({ kind: "factory_work_order", status: "blocked", riskLevel: "medium" }),
      action: action({
        id: "act_factory_retry",
        actionType: "factory.work_order.retry_stage",
        label: "Retry stage",
        riskLevel: "medium",
        confirmPolicy: "single_click",
        allowedRoles: ["STAFF", "ADMIN"],
        allowedStatuses: ["blocked", "failed"],
        payload: { workOrderId: "wo_1", brief: productBrief() },
        payloadSchemaKey: "factory.work_order.retry_stage",
        confirmationText: null,
      }),
      actorRole: "ADMIN",
      confirmation: { confirmed: true },
      now: NOW,
    })).toThrow(OperationPayloadValidationError);

    expect(() => policy.evaluate({
      operation: operation({ kind: "factory_work_order", status: "blocked", riskLevel: "medium" }),
      action: action({
        id: "act_factory_refine",
        actionType: "factory.work_order.refine_asset",
        label: "Refine asset",
        riskLevel: "medium",
        confirmPolicy: "single_click",
        allowedRoles: ["STAFF", "ADMIN"],
        allowedStatuses: ["blocked"],
        payload: {
          workOrderId: "wo_1",
          checkpointId: "checkpoint_1",
          assetId: "asset_1",
          mode: "replace_with_upload",
        },
        payloadSchemaKey: "factory.work_order.refine_asset",
        confirmationText: null,
      }),
      actorRole: "ADMIN",
      confirmation: { confirmed: true },
      now: NOW,
    })).toThrow(OperationPayloadValidationError);
  });

  it("accepts valid help flow payloads for all signed-in roles", () => {
    const result = policy.evaluate({
      operation: operation({ kind: "help_flow", status: "draft", riskLevel: "info", createdByRole: "AUTHENTICATED" }),
      action: action({
        id: "act_help_search",
        actionType: "help.search",
        label: "Search Help",
        riskLevel: "info",
        confirmPolicy: "none",
        allowedRoles: ["ANONYMOUS", "AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
        allowedStatuses: ["draft", "running", "blocked"],
        payload: { query: "backup", role: "AUTHENTICATED" },
        payloadSchemaKey: "help.search",
        confirmationText: null,
      }),
      actorRole: "AUTHENTICATED",
      now: NOW,
    });

    expect(result.actionType).toBe("help.search");
  });

  it("rejects malformed onboarding flow payloads", () => {
    expect(() => policy.evaluate({
      operation: operation({ kind: "onboarding_flow", status: "draft", riskLevel: "info", createdByRole: "STAFF" }),
      action: action({
        id: "act_onboarding_start",
        actionType: "onboarding.start",
        label: "Start onboarding",
        riskLevel: "info",
        confirmPolicy: "none",
        allowedRoles: ["ANONYMOUS", "AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
        allowedStatuses: ["draft", "running", "blocked"],
        payload: { role: "STAFF" },
        payloadSchemaKey: "onboarding.start",
        confirmationText: null,
      }),
      actorRole: "STAFF",
      now: NOW,
    })).toThrow(OperationPayloadValidationError);
  });
});
