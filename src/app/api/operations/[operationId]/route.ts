import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getOperationRepository } from "@/adapters/RepositoryFactory";
import { getSessionUser } from "@/lib/auth";
import {
  canReadOperationSnapshot,
  createOperationReadContext,
  OperationReadApiError,
} from "@/lib/operations/operation-read-api";
import { operationSnapshotToCardModel } from "@/lib/operations/operation-presentation";

type RouteContext = {
  params: Promise<{ operationId: string }>;
};

function errorResponse(error: unknown) {
  if (error instanceof OperationReadApiError) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      errorCode: error.code,
      details: error.details,
    }, { status: error.status });
  }

  return NextResponse.json({
    ok: false,
    error: "Operation read failed.",
    errorCode: "OPERATION_READ_INTERNAL_ERROR",
  }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { operationId } = await params;
    const user = await getSessionUser();
    const context = createOperationReadContext(user);
    const repository = getOperationRepository();
    const snapshot = await repository.findOperationById(operationId);
    if (!snapshot) {
      throw new OperationReadApiError(404, "OPERATION_NOT_FOUND", "Operation was not found.", { operationId });
    }
    if (!canReadOperationSnapshot(snapshot, context)) {
      throw new OperationReadApiError(403, "OPERATION_FORBIDDEN", "You cannot read this operation.", { operationId });
    }

    const [conversationSummary, adminSummary, availableActions] = await Promise.all([
      repository.getConversationSummary(operationId),
      context.isAdmin ? repository.getAdminSummary(operationId) : Promise.resolve(null),
      repository.listAvailableActions(operationId),
    ]);

    return NextResponse.json({
      ok: true,
      snapshot,
      operation: snapshot.operation,
      card: operationSnapshotToCardModel({ ...snapshot, actions: availableActions }),
      conversationSummary,
      adminSummary,
      availableActions,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
