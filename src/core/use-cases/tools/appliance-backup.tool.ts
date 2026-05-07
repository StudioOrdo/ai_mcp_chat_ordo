import { getBackupSelfService } from "@/adapters/RepositoryFactory";
import { CAPABILITY_CATALOG } from "@/core/capability-catalog/catalog";
import { buildCatalogBoundToolDescriptor } from "@/core/capability-catalog/runtime-tool-projection";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type { BackupSelfService } from "@/lib/appliance/backup/backup-self-service";
import type { BackupCommandRequester, BackupInterval } from "@/lib/appliance/backup/types";

type ApplianceBackupAction =
  | "create_appliance_backup"
  | "list_appliance_backups"
  | "validate_appliance_backup"
  | "prepare_appliance_restore"
  | "request_pre_restore_backup"
  | "confirm_appliance_restore"
  | "execute_appliance_restore"
  | "cancel_appliance_restore"
  | "configure_backup_policy";

export interface ApplianceBackupInput {
  snapshot_id?: string;
  restore_plan_id?: string;
  confirmation_phrase?: string;
  enabled?: boolean;
  interval?: string;
  retention_count?: number;
  limit?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseApplianceBackupInput(value: unknown): ApplianceBackupInput {
  if (!isRecord(value)) {
    return {};
  }
  return {
    ...(typeof value.snapshot_id === "string" && value.snapshot_id.trim() ? { snapshot_id: value.snapshot_id.trim() } : {}),
    ...(typeof value.restore_plan_id === "string" && value.restore_plan_id.trim() ? { restore_plan_id: value.restore_plan_id.trim() } : {}),
    ...(typeof value.confirmation_phrase === "string" ? { confirmation_phrase: value.confirmation_phrase } : {}),
    ...(typeof value.enabled === "boolean" ? { enabled: value.enabled } : {}),
    ...(typeof value.interval === "string" && value.interval.trim() ? { interval: value.interval.trim() } : {}),
    ...(typeof value.retention_count === "number" && Number.isSafeInteger(value.retention_count) ? { retention_count: value.retention_count } : {}),
    ...(typeof value.limit === "number" && Number.isSafeInteger(value.limit) ? { limit: value.limit } : {}),
  };
}

function requester(context?: ToolExecutionContext): BackupCommandRequester {
  if (context?.role !== "ADMIN") {
    throw new Error("Appliance backup and restore tools are admin-only.");
  }
  return {
    userId: context.userId ?? null,
    role: "ADMIN",
    requestedFrom: "operator_tool",
  };
}

function requireValue(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function shortId(id: string): string {
  const [prefix, suffix] = id.split("_", 2);
  return prefix && suffix ? `${prefix}_${suffix.slice(0, 8)}` : id.slice(0, 17);
}

function enrichApplianceResult<T>(_action: ApplianceBackupAction, result: T): T {
  if (!isRecord(result)) {
    return result;
  }

  const snapshot = isRecord(result.snapshot) ? result.snapshot : null;
  const restorePlan = isRecord(result.restorePlan) ? result.restorePlan : null;
  const recentBackups = Array.isArray(result.recentBackups)
    ? result.recentBackups.map((entry) => isRecord(entry) && typeof entry.id === "string"
      ? {
          ...entry,
          shortId: shortId(entry.id),
        }
      : entry)
    : undefined;
  const recentRestorePlans = Array.isArray(result.recentRestorePlans)
    ? result.recentRestorePlans.map((entry) => isRecord(entry) && typeof entry.id === "string"
      ? {
          ...entry,
          shortId: shortId(entry.id),
        }
      : entry)
    : undefined;

  return {
    ...result,
    ...(recentBackups ? { recentBackups } : {}),
    ...(recentRestorePlans ? { recentRestorePlans } : {}),
    shortSnapshotId: snapshot && typeof snapshot.id === "string" ? shortId(snapshot.id) : undefined,
    shortRestorePlanId: restorePlan && typeof restorePlan.id === "string" ? shortId(restorePlan.id) : undefined,
    actions: [],
  } as T;
}

async function resolveRestorePlanId(
  service: BackupSelfService,
  restorePlanId: string,
): Promise<string> {
  const dashboard = await service.getDashboard();
  const matches = dashboard.recentRestorePlans.filter((plan) => plan.id === restorePlanId || plan.id.startsWith(restorePlanId));
  if (matches.length === 1) {
    return matches[0].id;
  }
  if (matches.length > 1) {
    throw new Error(`Restore plan id ${restorePlanId} is ambiguous. Use the full restore plan id.`);
  }
  throw new Error(`Restore plan not found: ${restorePlanId}`);
}

async function readRestorePlanStatus(
  service: BackupSelfService,
  restorePlanId: string,
) {
  const fullRestorePlanId = await resolveRestorePlanId(service, restorePlanId);
  const dashboard = await service.getDashboard();
  const restorePlan = dashboard.recentRestorePlans.find((plan) => plan.id === fullRestorePlanId) ?? null;
  if (!restorePlan) {
    throw new Error(`Restore plan not found: ${restorePlanId}`);
  }
  return {
    status: restorePlan.status,
    summary: "Restore plan is already prepared.",
    nextAction: restorePlan.status === "confirmation_required"
      ? `Type ${restorePlan.confirmationPhrase} to confirm.`
      : null,
    restorePlan,
    executor: dashboard.executor,
    warnings: [...dashboard.executor.warnings, ...restorePlan.validationWarnings],
  };
}

export async function executeApplianceBackupAction(
  action: ApplianceBackupAction,
  input: ApplianceBackupInput,
  context?: ToolExecutionContext,
  service: BackupSelfService = getBackupSelfService(),
) {
  const actor = requester(context);

  switch (action) {
    case "create_appliance_backup":
      throw new Error("Create backup is operation-backed. Use a backup_create operation action.");
    case "list_appliance_backups":
      return enrichApplianceResult(action, await service.getDashboard());
    case "validate_appliance_backup":
      throw new Error("Validate backup is operation-backed. Use a backup.validate operation action.");
    case "prepare_appliance_restore": {
      const snapshotOrPlanId = requireValue(input.snapshot_id, "snapshot_id");
      if (snapshotOrPlanId.startsWith("restore_")) {
        return enrichApplianceResult(action, await readRestorePlanStatus(service, snapshotOrPlanId));
      }
      throw new Error("Prepare restore is operation-backed. Use a restore.prepare operation action.");
    }
    case "request_pre_restore_backup":
      throw new Error("Safety backup is operation-backed. Use a restore.create_safety_backup operation action.");
    case "confirm_appliance_restore":
      throw new Error("Restore confirmation is operation-backed. Use a restore.confirm operation action.");
    case "execute_appliance_restore":
      throw new Error("Execute restore is operation-backed. Use a restore.execute operation action.");
    case "cancel_appliance_restore":
      throw new Error("Cancel restore is operation-backed. Use a restore.cancel operation action.");
    case "configure_backup_policy":
      return enrichApplianceResult(action, await service.updatePolicy({
        enabled: input.enabled === true,
        interval: (input.interval ?? "disabled") as BackupInterval,
        retentionCount: input.retention_count ?? 7,
      }, actor));
  }
}

export function createApplianceBackupTool(action: ApplianceBackupAction) {
  return buildCatalogBoundToolDescriptor(CAPABILITY_CATALOG[action], {
    parse: parseApplianceBackupInput,
    execute: (input, context) => executeApplianceBackupAction(action, input, context),
  });
}
