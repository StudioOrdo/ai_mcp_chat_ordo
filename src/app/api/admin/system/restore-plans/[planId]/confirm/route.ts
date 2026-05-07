import { NextResponse } from "next/server";

import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import {
  dispatchAdminRestorePlanOperationAction,
  getBackupDashboardAfterReconciliation,
} from "@/lib/appliance/backup/backup-restore-admin-operations";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Restore confirmation failed.";
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ planId: string }> },
) {
  const user = await requireAdminPageAccess();
  const { planId } = await context.params;
  const body = await request.json().catch(() => ({})) as unknown;
  const confirmationPhrase = isRecord(body) && typeof body.confirmationPhrase === "string"
    ? body.confirmationPhrase
    : "";
  try {
    const result = await dispatchAdminRestorePlanOperationAction({
      planId,
      actionType: "restore.confirm",
      actor: { userId: user.id, role: "ADMIN" },
      confirmationPhrase,
    });
    const dashboard = await getBackupDashboardAfterReconciliation();
    return NextResponse.json({ result, dashboard });
  } catch (error) {
    return safeError(error);
  }
}
