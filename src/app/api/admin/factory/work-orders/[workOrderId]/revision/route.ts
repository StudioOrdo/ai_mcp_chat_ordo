import { getFactoryRepository, getOperationRepository, getPlatformInteractionFacade } from "@/adapters/RepositoryFactory";
import type { OperationAction } from "@/core/entities/operation";
import { OperationDomainError } from "@/core/entities/operation";
import {
  OperationActionDispatchError,
} from "@/core/use-cases/operations/OperationActionDispatch";
import { getSessionUser } from "@/lib/auth";
import {
  OperationActionRequestError,
  operationActionErrorCode,
  operationActionErrorDetails,
  parseOperationActionRequestBody,
  statusForOperationActionError,
} from "@/lib/operations/operation-action-api";
import { createOperationActionDispatchService } from "@/lib/operations/operation-action-dispatch-root";

type RouteParams = {
  params: Promise<{ workOrderId: string }>;
};

function jsonError(message: string, status: number, details?: Record<string, unknown>) {
  return Response.json({ ok: false, error: message, ...(details ? { details } : {}) }, { status });
}

function serializeActions(actions: readonly OperationAction[]): OperationAction[] {
  return actions.map((action) => ({ ...action }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!isRecord(body)) {
      throw new OperationActionRequestError("Request body must be a JSON object.", { field: "body" });
    }
    return body;
  } catch (error) {
    if (error instanceof OperationActionRequestError) throw error;
    throw new OperationActionRequestError("Request body must be valid JSON.", { field: "body" });
  }
}

function parseActionId(body: Record<string, unknown>): string {
  const actionId = body.actionId;
  if (typeof actionId !== "string" || !actionId.trim()) {
    throw new OperationActionRequestError("actionId is required.", { field: "actionId" });
  }
  return actionId.trim();
}

async function requireAdminUser() {
  const user = await getSessionUser();
  if (!user.roles.includes("ADMIN") && !user.realRoles?.includes("ADMIN")) {
    return null;
  }
  return user;
}

function operationErrorResponse(error: unknown) {
  const status = statusForOperationActionError(error, "ADMIN");
  const code = operationActionErrorCode(error) ?? "OPERATION_ACTION_INTERNAL_ERROR";
  const message = error instanceof Error ? error.message : "Factory operation action failed.";
  const details = operationActionErrorDetails(error);
  const dispatchError = error instanceof OperationActionDispatchError ? error : null;

  return Response.json({
    ok: false,
    error: message,
    errorCode: code,
    details,
    operation: dispatchError?.snapshot?.operation ?? null,
    snapshot: dispatchError?.snapshot ?? null,
    conversationSummary: dispatchError?.conversationSummary ?? null,
    availableActions: serializeActions(dispatchError?.availableActions ?? []),
  }, { status });
}

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await requireAdminUser();
  if (!user) {
    return jsonError("Factory revision controls are restricted to administrators.", 403);
  }

  const { workOrderId } = await params;
  if (!workOrderId) {
    return jsonError("workOrderId is required.", 400);
  }

  const result = await getPlatformInteractionFacade().getWorkOrderInteraction(workOrderId);
  if (!result) {
    return jsonError("Factory work order not found.", 404);
  }

  return Response.json({
    ok: true,
    workOrder: result.workOrder,
    activeCheckpoint: result.activeCheckpoint,
    stageRuns: result.stageRuns,
    outputs: result.outputs,
    events: result.events,
    timeline: result.timeline,
    revision: result.revision,
    interaction: result,
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await requireAdminUser();
  if (!user) {
    return jsonError("Factory revision controls are restricted to administrators.", 403);
  }

  const { workOrderId } = await params;
  if (!workOrderId) {
    return jsonError("workOrderId is required.", 400);
  }

  try {
    const factoryRepository = getFactoryRepository();
    const operationRepository = getOperationRepository();
    const workOrder = await factoryRepository.findWorkOrderById(workOrderId);
    if (!workOrder) {
      return jsonError("Factory work order not found.", 404);
    }

    const rawBody = await parseJsonBody(request);
    const actionId = parseActionId(rawBody);
    const body = parseOperationActionRequestBody(rawBody);
    const result = await createOperationActionDispatchService({
      repository: operationRepository,
      factoryRepository,
    }).dispatch({
      operationId: workOrder.operationId,
      actionId,
      idempotencyKey: body.idempotencyKey,
      clientOperationRevision: body.operationRevision,
      actorUserId: user.id,
      actorRole: "ADMIN",
      payload: body.payload,
      confirmation: body.confirmation,
    });

    return Response.json({
      ok: true,
      accepted: result.accepted,
      duplicate: result.duplicate,
      operation: result.snapshot.operation,
      snapshot: result.snapshot,
      conversationSummary: result.conversationSummary,
      availableActions: serializeActions(result.availableActions),
    });
  } catch (error) {
    if (
      error instanceof OperationActionRequestError
      || error instanceof OperationActionDispatchError
      || error instanceof OperationDomainError
    ) {
      return operationErrorResponse(error);
    }

    const message = error instanceof Error ? error.message : "Unexpected factory revision error.";
    return jsonError(message, /not found/i.test(message) ? 404 : 500);
  }
}
