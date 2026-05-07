import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getOperationRepository } from "@/adapters/RepositoryFactory";
import { getSessionUser } from "@/lib/auth";
import {
  canReadOperationSnapshot,
  createOperationReadContext,
  OperationReadApiError,
} from "@/lib/operations/operation-read-api";

type RouteContext = {
  params: Promise<{ operationId: string }>;
};

function numberParam(searchParams: URLSearchParams, key: string): number | undefined {
  const raw = searchParams.get(key);
  if (raw == null || !raw.trim()) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
}

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
    error: "Operation events read failed.",
    errorCode: "OPERATION_EVENTS_INTERNAL_ERROR",
  }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
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

    const events = await repository.listEvents(operationId, {
      afterSequence: numberParam(request.nextUrl.searchParams, "afterSequence"),
      limit: numberParam(request.nextUrl.searchParams, "limit"),
    });

    return NextResponse.json({ ok: true, events });
  } catch (error) {
    return errorResponse(error);
  }
}
