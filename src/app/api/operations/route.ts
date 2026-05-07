import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getOperationRepository } from "@/adapters/RepositoryFactory";
import { getSessionUser } from "@/lib/auth";
import {
  createOperationFromRequest,
  createOperationReadContext,
  listReadableOperations,
  OperationReadApiError,
  parseOperationListOptions,
} from "@/lib/operations/operation-read-api";
import { operationSourceToCardModel, operationSnapshotToCardModel } from "@/lib/operations/operation-presentation";

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
    error: "Operation request failed.",
    errorCode: "OPERATION_API_INTERNAL_ERROR",
  }, { status: 500 });
}

async function parseJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new OperationReadApiError(422, "OPERATION_REQUEST_INVALID", "Request body must be valid JSON.", { field: "body" });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    const context = createOperationReadContext(user);
    const repository = getOperationRepository();
    const options = parseOperationListOptions(request.nextUrl.searchParams);
    const operations = await listReadableOperations({ repository, context, options });
    const health = context.isStaff ? await repository.getHealthAggregate() : null;

    return NextResponse.json({
      ok: true,
      operations,
      cards: operations.map(operationSourceToCardModel),
      health,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    const context = createOperationReadContext(user);
    const repository = getOperationRepository();
    const routeResult = await createOperationFromRequest({
      repository,
      context,
      body: await parseJsonBody(request),
    });

    if (
      routeResult.kind === "created_operation"
      || routeResult.kind === "blocked_operation"
      || routeResult.kind === "existing_operation"
    ) {
      return NextResponse.json({
        ok: true,
        routeResultKind: routeResult.kind,
        snapshot: routeResult.snapshot,
        operation: routeResult.snapshot.operation,
        actions: routeResult.actions,
        blockingGates: "blockingGates" in routeResult ? routeResult.blockingGates : [],
        card: operationSnapshotToCardModel(routeResult.snapshot),
      }, { status: routeResult.kind === "created_operation" || routeResult.kind === "blocked_operation" ? 201 : 200 });
    }

    return NextResponse.json({
      ok: false,
      routeResultKind: routeResult.kind,
      error: "Operation was not created.",
      message: "message" in routeResult ? routeResult.message : undefined,
      reason: "reason" in routeResult ? routeResult.reason : undefined,
    }, { status: 422 });
  } catch (error) {
    return errorResponse(error);
  }
}
