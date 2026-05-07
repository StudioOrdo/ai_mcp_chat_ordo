import {
  OperationActionRejectedError,
  OperationActionStaleError,
  OperationDomainError,
  OperationNotFoundError,
  type OperationAction,
  type OperationActionConfirmation,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";
import type { OperationActionAccepted } from "@/core/use-cases/operations/OperationActionPolicy";
import type {
  OperationRepository,
  OperationSnapshot,
} from "@/core/use-cases/operations/OperationRepository";
import type {
  ConversationOperationSummary,
} from "@/core/use-cases/operations/OperationReadModel";

export interface OperationActionDispatchInput {
  operationId: string;
  actionId: string;
  idempotencyKey: string;
  clientOperationRevision: number;
  actorUserId: string | null;
  actorRole: RoleName;
  payload?: Record<string, unknown>;
  confirmation?: OperationActionConfirmation;
  now?: string;
}

export interface OperationActionExecutorInput {
  repository: OperationRepository;
  snapshot: OperationSnapshot;
  action: OperationAction;
  accepted: OperationActionAccepted;
  actorUserId: string | null;
  actorRole: RoleName;
  payload: Record<string, unknown>;
  now?: string;
}

export interface OperationActionExecutorResult {
  snapshot?: OperationSnapshot;
}

export interface OperationActionExecutor {
  canExecute(actionType: string): boolean;
  execute(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult | void>;
}

export interface OperationActionDispatchResult extends OperationActionAccepted {
  snapshot: OperationSnapshot;
  conversationSummary: ConversationOperationSummary | null;
  availableActions: OperationAction[];
}

export type OperationActionDispatchErrorCode =
  | "OPERATION_ACTION_EXECUTOR_UNAVAILABLE"
  | "OPERATION_ACTION_STALE"
  | "OPERATION_ACTION_REJECTED"
  | "OPERATION_AUTHORIZATION_DENIED"
  | "OPERATION_NOT_FOUND"
  | "OPERATION_PAYLOAD_INVALID"
  | "OPERATION_TRANSITION_INVALID";

export class OperationActionDispatchError extends Error {
  readonly code: OperationActionDispatchErrorCode;
  readonly details: Record<string, unknown>;
  readonly snapshot: OperationSnapshot | null;
  readonly conversationSummary: ConversationOperationSummary | null;
  readonly availableActions: OperationAction[];

  constructor(input: {
    code: OperationActionDispatchErrorCode;
    message: string;
    details?: Record<string, unknown>;
    snapshot?: OperationSnapshot | null;
    conversationSummary?: ConversationOperationSummary | null;
    availableActions?: OperationAction[];
    cause?: unknown;
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = "OperationActionDispatchError";
    this.code = input.code;
    this.details = input.details ?? {};
    this.snapshot = input.snapshot ?? null;
    this.conversationSummary = input.conversationSummary ?? null;
    this.availableActions = input.availableActions ?? [];
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class OperationActionExecutorRegistry {
  private readonly executors: readonly OperationActionExecutor[];

  constructor(executors: readonly OperationActionExecutor[] = []) {
    this.executors = executors;
  }

  resolve(actionType: string): OperationActionExecutor | null {
    return this.executors.find((executor) => executor.canExecute(actionType)) ?? null;
  }
}

export interface OperationActionDispatchServiceDeps {
  repository: OperationRepository;
  executors?: OperationActionExecutorRegistry | readonly OperationActionExecutor[];
}

function normalizeExecutorRegistry(
  executors: OperationActionDispatchServiceDeps["executors"],
): OperationActionExecutorRegistry {
  if (executors instanceof OperationActionExecutorRegistry) return executors;
  return new OperationActionExecutorRegistry(executors ?? []);
}

function dispatchCodeFromDomainError(error: OperationDomainError): OperationActionDispatchErrorCode {
  switch (error.code) {
    case "OPERATION_ACTION_REJECTED":
    case "OPERATION_ACTION_STALE":
    case "OPERATION_AUTHORIZATION_DENIED":
    case "OPERATION_NOT_FOUND":
    case "OPERATION_PAYLOAD_INVALID":
    case "OPERATION_TRANSITION_INVALID":
      return error.code;
    case "OPERATION_KIND_NOT_REGISTERED":
      return "OPERATION_ACTION_REJECTED";
    default:
      error.code satisfies never;
      return "OPERATION_ACTION_REJECTED";
  }
}

export class OperationActionDispatchService {
  private readonly repository: OperationRepository;
  private readonly executors: OperationActionExecutorRegistry;

  constructor(deps: OperationActionDispatchServiceDeps) {
    this.repository = deps.repository;
    this.executors = normalizeExecutorRegistry(deps.executors);
  }

  async dispatch(input: OperationActionDispatchInput): Promise<OperationActionDispatchResult> {
    const snapshot = await this.requireSnapshot(input.operationId);
    let action: OperationAction;
    try {
      action = this.requireAction(snapshot, input.actionId);
    } catch (error) {
      if (error instanceof OperationDomainError) {
        await this.throwWithState(input.operationId, error);
      }
      throw error;
    }

    if (input.clientOperationRevision !== action.operationRevision) {
      const error = new OperationActionStaleError("Operation action client revision is stale.", {
        operationId: input.operationId,
        actionId: input.actionId,
        clientOperationRevision: input.clientOperationRevision,
        actionRevision: action.operationRevision,
      });
      await this.appendActionRejected(input, action, error);
      return await this.throwWithState(input.operationId, error);
    }

    const executor = this.executors.resolve(action.actionType);
    if (!executor) {
      const error = new OperationActionRejectedError("Operation action executor is not registered.", {
        operationId: input.operationId,
        actionId: input.actionId,
        actionType: action.actionType,
      });
      await this.appendActionRejected(input, action, error, "OPERATION_ACTION_EXECUTOR_UNAVAILABLE");
      return await this.throwWithState(input.operationId, error, "OPERATION_ACTION_EXECUTOR_UNAVAILABLE");
    }

    let accepted: OperationActionAccepted;
    try {
      accepted = await this.repository.acceptAction({
        operationId: input.operationId,
        actionId: input.actionId,
        idempotencyKey: input.idempotencyKey,
        actorRole: input.actorRole,
        actorUserId: input.actorUserId,
        payload: input.payload,
        confirmation: input.confirmation,
        now: input.now,
      });
    } catch (error) {
      if (error instanceof OperationDomainError) {
        await this.throwWithState(input.operationId, error);
      }
      throw error;
    }

    let finalSnapshot = await this.requireSnapshot(input.operationId);

    if (!accepted.duplicate) {
      const executorResult = await executor.execute({
        repository: this.repository,
        snapshot: finalSnapshot,
        action,
        accepted,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        payload: accepted.payload,
        now: input.now,
      });
      finalSnapshot = executorResult?.snapshot ?? await this.requireSnapshot(input.operationId);
    }

    return this.buildResult(accepted, finalSnapshot, input.now);
  }

  private async buildResult(
    accepted: OperationActionAccepted,
    snapshot: OperationSnapshot,
    now?: string,
  ): Promise<OperationActionDispatchResult> {
    return {
      ...accepted,
      snapshot,
      conversationSummary: await this.repository.getConversationSummary(snapshot.operation.id),
      availableActions: await this.repository.listAvailableActions(snapshot.operation.id, { now }),
    };
  }

  private async requireSnapshot(operationId: string): Promise<OperationSnapshot> {
    const snapshot = await this.repository.findOperationById(operationId);
    if (!snapshot) throw new OperationNotFoundError(operationId);
    return snapshot;
  }

  private requireAction(snapshot: OperationSnapshot, actionId: string): OperationAction {
    const action = snapshot.actions.find((candidate) => candidate.id === actionId);
    if (!action) throw new OperationNotFoundError(actionId);
    return action;
  }

  private async appendActionRejected(
    input: OperationActionDispatchInput,
    action: OperationAction,
    error: OperationDomainError,
    overrideCode?: OperationActionDispatchErrorCode,
  ): Promise<void> {
    await this.repository.appendEvent({
      operationId: input.operationId,
      type: "action_rejected",
      actorType: "user",
      actorId: input.actorUserId,
      payload: {
        actionId: input.actionId,
        actionType: action.actionType,
        idempotencyKey: input.idempotencyKey,
        errorCode: overrideCode ?? error.code,
        errorMessage: error.message,
        errorDetails: error.details,
      },
      now: input.now,
    });
  }

  private async throwWithState(
    operationId: string,
    error: OperationDomainError,
    overrideCode?: OperationActionDispatchErrorCode,
  ): Promise<never> {
    const snapshot = await this.repository.findOperationById(operationId);
    const conversationSummary = snapshot
      ? await this.repository.getConversationSummary(operationId)
      : null;
    const availableActions = snapshot
      ? await this.repository.listAvailableActions(operationId)
      : [];

    throw new OperationActionDispatchError({
      code: overrideCode ?? dispatchCodeFromDomainError(error),
      message: error.message,
      details: error.details,
      snapshot,
      conversationSummary,
      availableActions,
      cause: error,
    });
  }
}
