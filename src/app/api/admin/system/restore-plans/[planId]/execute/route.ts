import { NextResponse } from "next/server";

import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import {
  dispatchAdminRestorePlanOperationAction,
  getBackupDashboardAfterReconciliation,
} from "@/lib/appliance/backup/backup-restore-admin-operations";
import { ResourcePressureError } from "@/lib/appliance/resources/resource-pressure";

function safeError(error: unknown): NextResponse {
  if (error instanceof ResourcePressureError) {
    return NextResponse.json({
      error: error.message,
      code: error.code,
      operation: error.operation,
      resource: error.metadata,
    }, { status: 409 });
  }
  const message = error instanceof Error ? error.message : "Restore execution failed.";
  const status = /unavailable|disabled|binary/i.test(message) ? 409 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ planId: string }> },
) {
  const user = await requireAdminPageAccess();
  const { planId } = await context.params;
  try {
    const result = await dispatchAdminRestorePlanOperationAction({
      planId,
      actionType: "restore.execute",
      actor: { userId: user.id, role: "ADMIN" },
    });
    const dashboard = await getBackupDashboardAfterReconciliation();
    return NextResponse.json({ result, dashboard });
  } catch (error) {
    return safeError(error);
  }
}
