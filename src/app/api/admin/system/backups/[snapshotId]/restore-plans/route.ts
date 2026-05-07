import { NextResponse } from "next/server";

import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import {
  createAdminRestoreOperation,
  getBackupDashboardAfterReconciliation,
} from "@/lib/appliance/backup/backup-restore-admin-operations";

function safeError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Restore plan creation failed.";
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ snapshotId: string }> },
) {
  const user = await requireAdminPageAccess();
  const { snapshotId } = await context.params;
  try {
    const result = await createAdminRestoreOperation(snapshotId, { userId: user.id, role: "ADMIN" });
    const dashboard = await getBackupDashboardAfterReconciliation();
    return NextResponse.json({ result, dashboard });
  } catch (error) {
    return safeError(error);
  }
}
