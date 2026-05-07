import { NextResponse } from "next/server";

import { getBackupSelfService } from "@/adapters/RepositoryFactory";
import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import type { BackupCommandRequester, BackupInterval } from "@/lib/appliance/backup/types";

function requester(user: Awaited<ReturnType<typeof requireAdminPageAccess>>): BackupCommandRequester {
  return {
    userId: user.id,
    role: "ADMIN",
    requestedFrom: "admin_api",
  };
}

function safeError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Backup policy update failed.";
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  await requireAdminPageAccess();
  const dashboard = await getBackupSelfService().getDashboard();
  return NextResponse.json({
    policy: dashboard.policy,
    policyHealth: dashboard.policyHealth,
  });
}

export async function PATCH(request: Request) {
  const user = await requireAdminPageAccess();
  try {
    const body = await request.json() as {
      enabled?: unknown;
      interval?: unknown;
      retentionCount?: unknown;
    };
    const result = await getBackupSelfService().updatePolicy({
      enabled: body.enabled === true,
      interval: typeof body.interval === "string" ? body.interval as BackupInterval : "disabled",
      retentionCount: typeof body.retentionCount === "number" ? body.retentionCount : 7,
    }, requester(user));
    const dashboard = await getBackupSelfService().getDashboard();
    return NextResponse.json({ result, dashboard });
  } catch (error) {
    return safeError(error);
  }
}
