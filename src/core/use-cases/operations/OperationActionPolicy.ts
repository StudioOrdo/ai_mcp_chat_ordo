import type { RoleName } from "@/core/entities/user";
import {
  isDestructiveOperation,
  type Operation,
  type OperationAction,
  type OperationActionConfirmation,
  OperationActionRejectedError,
  OperationActionStaleError,
  OperationAuthorizationError,
  OperationPayloadValidationError,
} from "@/core/entities/operation";
import {
  listFactoryWorkOrderApproveCheckpointPayloadErrors,
  listFactoryWorkOrderCreatePayloadErrors,
  listFactoryWorkOrderRefineAssetPayloadErrors,
  listFactoryWorkOrderResumePayloadErrors,
  listFactoryWorkOrderRetryStagePayloadErrors,
} from "@/core/use-cases/operations/FactoryWorkOrderOperationActions";

export type OperationPayloadValidator = (payload: Record<string, unknown>) => readonly string[];

export type OperationPayloadValidatorRegistry = Readonly<Record<string, OperationPayloadValidator>>;

export interface OperationActionPolicyInput {
  operation: Operation;
  action: OperationAction;
  actorRole: RoleName;
  payload?: Record<string, unknown>;
  confirmation?: OperationActionConfirmation;
  now?: string;
  acceptedIdempotencyKeys?: ReadonlySet<string> | readonly string[];
  acceptedActionIds?: ReadonlySet<string> | readonly string[];
  availableActions?: readonly OperationAction[];
  payloadValidators?: OperationPayloadValidatorRegistry;
}

export interface OperationActionAccepted {
  accepted: true;
  duplicate: boolean;
  operationId: string;
  actionId: string;
  actionType: string;
  idempotencyKey: string;
  acceptedAt: string;
  payload: Record<string, unknown>;
}

function hasAcceptedIdempotencyKey(keys: OperationActionPolicyInput["acceptedIdempotencyKeys"], key: string): boolean {
  if (!keys) return false;
  return "has" in keys ? keys.has(key) : keys.includes(key);
}

function hasAcceptedActionId(ids: OperationActionPolicyInput["acceptedActionIds"], id: string): boolean {
  if (!ids) return false;
  return "has" in ids ? ids.has(id) : ids.includes(id);
}

function summarizeActions(actions: readonly OperationAction[] | undefined): Array<Record<string, unknown>> {
  return (actions ?? []).map((action) => ({
    id: action.id,
    actionType: action.actionType,
    label: action.label,
    operationRevision: action.operationRevision,
    allowedStatuses: action.allowedStatuses,
    enabled: action.enabled,
    disabledReason: action.disabledReason,
  }));
}

function nowIso(override?: string): string {
  return override ?? new Date().toISOString();
}

function requireNonEmptyString(payload: Record<string, unknown>, field: string): string[] {
  return typeof payload[field] === "string" && payload[field].trim() ? [] : [`${field} must be a non-empty string.`];
}

function requireAllNonEmptyStrings(payload: Record<string, unknown>, fields: readonly string[]): string[] {
  return fields.flatMap((field) => requireNonEmptyString(payload, field));
}

export const DEFAULT_OPERATION_PAYLOAD_VALIDATORS: OperationPayloadValidatorRegistry = {
  none: () => [],
  empty: () => [],
  "backup.create": () => [],
  "backup.validate": (payload) => requireAllNonEmptyStrings(payload, ["snapshotId"]),
  "restore.prepare": (payload) => requireAllNonEmptyStrings(payload, ["snapshotId"]),
  "restore.confirm": (payload) => requireAllNonEmptyStrings(payload, ["restorePlanId"]),
  "restore.create_safety_backup": (payload) => requireAllNonEmptyStrings(payload, ["restorePlanId"]),
  "restore.execute": (payload) => requireAllNonEmptyStrings(payload, ["restorePlanId"]),
  "restore.cancel": (payload) => requireAllNonEmptyStrings(payload, ["restorePlanId"]),
  "media.workflow.create": (payload) => requireAllNonEmptyStrings(payload, [
    "requestedDeliverable",
    "template",
    "idempotencyKey",
  ]),
  "media.workflow.retry_step": (payload) => requireAllNonEmptyStrings(payload, [
    "workflowId",
    "stepId",
    "idempotencyKey",
  ]),
  "media.workflow.cancel": (payload) => requireAllNonEmptyStrings(payload, [
    "workflowId",
    "reason",
  ]),
  "media.retry_step": (payload) => requireAllNonEmptyStrings(payload, ["stepId"]),
  "factory.approve_stage": (payload) => requireAllNonEmptyStrings(payload, ["stageKey"]),
  "factory.work_order.create": listFactoryWorkOrderCreatePayloadErrors,
  "factory.work_order.pause": (payload) => requireAllNonEmptyStrings(payload, ["workOrderId"]),
  "factory.work_order.refine_asset": listFactoryWorkOrderRefineAssetPayloadErrors,
  "factory.work_order.resume": listFactoryWorkOrderResumePayloadErrors,
  "factory.work_order.retry_stage": listFactoryWorkOrderRetryStagePayloadErrors,
  "factory.work_order.cancel": (payload) => requireAllNonEmptyStrings(payload, ["workOrderId"]),
  "factory.work_order.approve_checkpoint": listFactoryWorkOrderApproveCheckpointPayloadErrors,
  "diagnostic.run": () => [],
  "help.search": (payload) => requireAllNonEmptyStrings(payload, ["query", "role"]),
  "help.open_section": (payload) => requireAllNonEmptyStrings(payload, ["documentSlug", "sectionSlug", "role"]),
  "help.start_checklist": (payload) => requireAllNonEmptyStrings(payload, ["checklistId", "role"]),
  "help.complete_checklist_item": (payload) => requireAllNonEmptyStrings(payload, ["itemId", "role"]),
  "help.finish": (payload) => requireAllNonEmptyStrings(payload, ["role"]),
  "onboarding.start": (payload) => requireAllNonEmptyStrings(payload, ["role", "pathId"]),
  "onboarding.complete_step": (payload) => requireAllNonEmptyStrings(payload, ["role", "stepId"]),
  "onboarding.skip_step": (payload) => requireAllNonEmptyStrings(payload, ["role", "stepId", "reason"]),
  "onboarding.open_help": (payload) => requireAllNonEmptyStrings(payload, ["role", "topic"]),
  "onboarding.finish": (payload) => requireAllNonEmptyStrings(payload, ["role", "pathId"]),
};

export class OperationActionPolicy {
  evaluate(input: OperationActionPolicyInput): OperationActionAccepted {
    const duplicate = hasAcceptedIdempotencyKey(input.acceptedIdempotencyKeys, input.action.idempotencyKey);
    const acceptedAt = nowIso(input.now);
    const payload = input.payload ?? input.action.payload;

    this.assertOperationMatches(input.operation, input.action);
    this.assertRoleAllowed(input.action, input.actorRole);

    if (duplicate) {
      return this.accept(input.action, acceptedAt, payload, true);
    }

    this.assertActionNotReplayedWithDifferentIdempotencyKey(input);
    this.assertActionEnabled(input.action);
    this.assertRevisionCurrent(input);
    this.assertStatusAllowed(input);
    this.assertNotExpired(input.action, acceptedAt, input.availableActions, input.operation);
    this.assertRiskConfirmed(input.action, input.actorRole, input.confirmation);
    this.assertPayloadValid(input.action, payload, input.payloadValidators ?? DEFAULT_OPERATION_PAYLOAD_VALIDATORS);

    return this.accept(input.action, acceptedAt, payload, false);
  }

  private accept(action: OperationAction, acceptedAt: string, payload: Record<string, unknown>, duplicate: boolean): OperationActionAccepted {
    return {
      accepted: true,
      duplicate,
      operationId: action.operationId,
      actionId: action.id,
      actionType: action.actionType,
      idempotencyKey: action.idempotencyKey,
      acceptedAt,
      payload,
    };
  }

  private assertOperationMatches(operation: Operation, action: OperationAction): void {
    if (action.operationId !== operation.id) {
      throw new OperationActionRejectedError("Action does not belong to operation.", {
        operationId: operation.id,
        actionOperationId: action.operationId,
        actionId: action.id,
      });
    }
  }

  private assertRoleAllowed(action: OperationAction, actorRole: RoleName): void {
    if (!action.allowedRoles.includes(actorRole)) {
      throw new OperationAuthorizationError("Actor role is not allowed to execute operation action.", {
        actorRole,
        allowedRoles: action.allowedRoles,
        actionId: action.id,
      });
    }
  }

  private assertActionNotReplayedWithDifferentIdempotencyKey(input: OperationActionPolicyInput): void {
    if (!hasAcceptedActionId(input.acceptedActionIds, input.action.id)) return;

    throw new OperationActionStaleError("Operation action id was already accepted with a different idempotency key.", {
      operationId: input.operation.id,
      actionId: input.action.id,
      idempotencyKey: input.action.idempotencyKey,
      currentStatus: input.operation.status,
      availableActions: summarizeActions(input.availableActions),
    });
  }

  private assertActionEnabled(action: OperationAction): void {
    if (!action.enabled) {
      throw new OperationActionRejectedError("Operation action is disabled.", {
        actionId: action.id,
        disabledReason: action.disabledReason,
      });
    }
  }

  private assertRevisionCurrent(input: OperationActionPolicyInput): void {
    if (input.action.operationRevision === input.operation.revision) return;

    throw new OperationActionStaleError("Operation action is stale.", {
      operationId: input.operation.id,
      currentRevision: input.operation.revision,
      actionRevision: input.action.operationRevision,
      currentStatus: input.operation.status,
      availableActions: summarizeActions(input.availableActions),
    });
  }

  private assertStatusAllowed(input: OperationActionPolicyInput): void {
    if (input.action.allowedStatuses.includes(input.operation.status)) return;

    throw new OperationActionStaleError("Operation action is not valid for the current operation status.", {
      operationId: input.operation.id,
      currentStatus: input.operation.status,
      allowedStatuses: input.action.allowedStatuses,
      availableActions: summarizeActions(input.availableActions),
    });
  }

  private assertNotExpired(action: OperationAction, now: string, availableActions: readonly OperationAction[] | undefined, operation: Operation): void {
    if (!action.expiresAt) return;

    const expiresAtMs = Date.parse(action.expiresAt);
    const nowMs = Date.parse(now);
    if (!Number.isFinite(expiresAtMs) || !Number.isFinite(nowMs) || expiresAtMs <= nowMs) {
      throw new OperationActionStaleError("Operation action has expired.", {
        operationId: operation.id,
        actionId: action.id,
        expiresAt: action.expiresAt,
        currentStatus: operation.status,
        availableActions: summarizeActions(availableActions),
      });
    }
  }

  private assertRiskConfirmed(action: OperationAction, actorRole: RoleName, confirmation: OperationActionConfirmation | undefined): void {
    if (isDestructiveOperation(action) && action.confirmPolicy === "none") {
      throw new OperationActionRejectedError("Destructive operation actions require explicit confirmation.", {
        actionId: action.id,
        riskLevel: action.riskLevel,
        confirmPolicy: action.confirmPolicy,
      });
    }

    switch (action.confirmPolicy) {
      case "none":
        return;
      case "single_click":
        if (confirmation?.confirmed === true) return;
        break;
      case "phrase":
        if (action.confirmationText && confirmation?.phrase === action.confirmationText) return;
        if (!action.confirmationText && typeof confirmation?.phrase === "string" && confirmation.phrase.trim()) return;
        break;
      case "admin_reauth":
        if (actorRole === "ADMIN" && confirmation?.reauthenticated === true) return;
        break;
      default:
        action.confirmPolicy satisfies never;
    }

    throw new OperationActionRejectedError("Operation action confirmation is incomplete.", {
      actionId: action.id,
      confirmPolicy: action.confirmPolicy,
      riskLevel: action.riskLevel,
    });
  }

  private assertPayloadValid(
    action: OperationAction,
    payload: Record<string, unknown>,
    validators: OperationPayloadValidatorRegistry,
  ): void {
    const validator = validators[action.payloadSchemaKey];
    if (!validator) {
      throw new OperationPayloadValidationError("No payload validator is registered for operation action.", {
        actionId: action.id,
        payloadSchemaKey: action.payloadSchemaKey,
      });
    }

    const errors = validator(payload);
    if (errors.length > 0) {
      throw new OperationPayloadValidationError("Operation action payload is invalid.", {
        actionId: action.id,
        payloadSchemaKey: action.payloadSchemaKey,
        errors,
      });
    }
  }
}

export const operationActionPolicy = new OperationActionPolicy();
