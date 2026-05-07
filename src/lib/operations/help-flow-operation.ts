import type {
  OperationActionExecutor,
  OperationActionExecutorInput,
  OperationActionExecutorResult,
} from "@/core/use-cases/operations/OperationActionDispatch";
import {
  HELP_FLOW_OPERATION_ACTION_TYPES,
  isHelpFlowOperationActionType,
} from "@/core/use-cases/operations/HelpFlowOperationActions";
import type {
  OperationRepository,
  OperationSnapshot,
} from "@/core/use-cases/operations/OperationRepository";

const HELP_ACTION_SET = new Set<string>(HELP_FLOW_OPERATION_ACTION_TYPES);

export class HelpFlowOperationExecutor implements OperationActionExecutor {
  canExecute(actionType: string): boolean {
    return HELP_ACTION_SET.has(actionType);
  }

  async execute(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    if (!isHelpFlowOperationActionType(input.action.actionType)) {
      throw new Error(`Unsupported help flow action: ${input.action.actionType}`);
    }

    await input.repository.appendEvent({
      operationId: input.snapshot.operation.id,
      type: "executor_event_received",
      actorType: "system",
      actorId: input.actorUserId,
      payload: {
        actionType: input.action.actionType,
        payload: input.payload,
        role: input.actorRole,
      },
      now: input.now,
    });

    if (input.action.actionType === "help.finish") {
      return { snapshot: await completeOperation(input.repository, input.snapshot.operation.id, input.actorUserId, input.now) };
    }

    return { snapshot: await requireOperationSnapshot(input.repository, input.snapshot.operation.id) };
  }
}

async function completeOperation(
  repository: OperationRepository,
  operationId: string,
  actorUserId: string | null,
  now?: string,
): Promise<OperationSnapshot> {
  let snapshot = await requireOperationSnapshot(repository, operationId);

  if (snapshot.operation.status === "draft" || snapshot.operation.status === "blocked") {
    snapshot = await repository.updateOperationStatus({
      operationId,
      status: "queued",
      supportsRetry: true,
      actorType: "system",
      actorId: actorUserId,
      now,
    });
  }

  if (snapshot.operation.status === "queued") {
    snapshot = await repository.updateOperationStatus({
      operationId,
      status: "running",
      supportsRetry: true,
      actorType: "system",
      actorId: actorUserId,
      now,
    });
  }

  if (snapshot.operation.status === "running") {
    snapshot = await repository.updateOperationStatus({
      operationId,
      status: "succeeded",
      supportsRetry: true,
      actorType: "system",
      actorId: actorUserId,
      now,
    });
  }

  await repository.replaceActions({
    operationId,
    actions: [],
    actorType: "system",
    actorId: actorUserId,
    now,
  });

  return requireOperationSnapshot(repository, operationId);
}

async function requireOperationSnapshot(repository: OperationRepository, operationId: string): Promise<OperationSnapshot> {
  const snapshot = await repository.findOperationById(operationId);
  if (!snapshot) {
    throw new Error(`Operation not found after help flow action: ${operationId}`);
  }
  return snapshot;
}
