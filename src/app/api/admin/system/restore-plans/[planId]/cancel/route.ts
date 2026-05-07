import { NextResponse } from "next/server";

import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import {
  dispatchAdminRestorePlanOperationAction,
  getBackupDashboardAfterReconciliation,
} from "@/lib/appliance/backup/backup-restore-admin-operations";

function safeError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Restore cancellation failed.";
  return NextResponse.json({ error: message }, { status: 400 });
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
      actionType: "restore.cancel",
      actor: { userId: user.id, role: "ADMIN" },
    });
    const dashboard = await getBackupDashboardAfterReconciliation();
    return NextResponse.json({ result, dashboard });
  } catch (error) {
    return safeError(error);
  }
}
