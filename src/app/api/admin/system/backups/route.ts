import { NextResponse } from "next/server";

import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import {
  createAdminBackupOperation,
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
  const message = error instanceof Error ? error.message : "Backup request failed.";
  const status = /unavailable|disabled|binary/i.test(message) ? 409 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  await requireAdminPageAccess();
  const dashboard = await getBackupDashboardAfterReconciliation();
  return NextResponse.json({ dashboard });
}

export async function POST() {
  const user = await requireAdminPageAccess();
  try {
    const result = await createAdminBackupOperation({ userId: user.id, role: "ADMIN" });
    const dashboard = await getBackupDashboardAfterReconciliation();
    return NextResponse.json({ result, dashboard });
  } catch (error) {
    return safeError(error);
  }
}
