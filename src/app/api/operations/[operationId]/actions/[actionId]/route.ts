import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { OperationAction } from "@/core/entities/operation";
import { OperationDomainError } from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";
import {
  OperationActionDispatchError,
} from "@/core/use-cases/operations/OperationActionDispatch";
import { getSessionUser } from "@/lib/auth";
import { createOperationActionDispatchService } from "@/lib/operations/operation-action-dispatch-root";
import {
  OperationActionRequestError,
  operationActionErrorCode,
  operationActionErrorDetails,
  parseOperationActionRequestBody,
  resolveStrongestOperationRole,
  statusForOperationActionError,
} from "@/lib/operations/operation-action-api";

type RouteContext = {
  params: Promise<{
    operationId: string;
    actionId: string;
  }>;
};

function serializeActions(actions: readonly OperationAction[]): OperationAction[] {
  return actions.map((action) => ({ ...action }));
}

async function parseJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new OperationActionRequestError("Request body must be valid JSON.", { field: "body" });
  }
}

function errorResponse(error: unknown, actorRole: RoleName) {
  const status = statusForOperationActionError(error, actorRole);
  const code = operationActionErrorCode(error) ?? "OPERATION_ACTION_INTERNAL_ERROR";
  const message = error instanceof Error ? error.message : "Operation action failed.";
  const details = operationActionErrorDetails(error);
  const dispatchError = error instanceof OperationActionDispatchError ? error : null;

  return NextResponse.json({
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

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser();
  const actorRole = resolveStrongestOperationRole([...(user.realRoles ?? []), ...user.roles]);

  try {
    const { operationId, actionId } = await params;
    const body = parseOperationActionRequestBody(await parseJsonBody(request));
    const service = createOperationActionDispatchService();
    const result = await service.dispatch({
      operationId,
      actionId,
      idempotencyKey: body.idempotencyKey,
      clientOperationRevision: body.operationRevision,
      actorUserId: user.id,
      actorRole,
      payload: body.payload,
      confirmation: body.confirmation,
    });

    return NextResponse.json({
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
      return errorResponse(error, actorRole);
    }

    return NextResponse.json({
      ok: false,
      error: "Operation action failed.",
      errorCode: "OPERATION_ACTION_INTERNAL_ERROR",
    }, { status: 500 });
  }
}
