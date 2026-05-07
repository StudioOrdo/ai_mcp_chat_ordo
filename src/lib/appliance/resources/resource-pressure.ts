import type { ApplianceHealthStatus } from "@/lib/appliance/health-types";
import type { MediaVolumeCapacity } from "@/lib/storage/volume-capacity";
import {
  computeBackupReserveBytes,
  getApplianceResourcePolicy,
  type ApplianceResourcePolicy,
} from "./appliance-resource-policy";

export type ResourcePressureOperation =
  | "manual_backup"
  | "scheduled_backup"
  | "pre_restore_backup"
  | "restore_execute";

export interface ResourcePressureSummary {
  status: Extract<ApplianceHealthStatus, "healthy" | "degraded" | "blocked" | "unknown">;
  summary: string;
  remediation: string | null;
  warnings: string[];
  metadata: {
    totalBytes?: number;
    freeBytes?: number;
    usedBytes?: number;
    percentUsed?: number;
    percentFree?: number;
    warnFreeBytes: number;
    warnFreePercent: number;
    blockFreeBytes: number;
    blockFreePercent: number;
    requiredFreeBytes?: number;
    reason: string;
  };
}

export class ResourcePressureError extends Error {
  readonly code = "APPLIANCE_RESOURCE_PRESSURE";

  constructor(
    message: string,
    readonly operation: ResourcePressureOperation,
    readonly status: "degraded" | "blocked" | "unavailable",
    readonly metadata: ResourcePressureSummary["metadata"],
  ) {
    super(message);
    this.name = "ResourcePressureError";
  }
}

export function assessResourcePressure(input: {
  capacity: MediaVolumeCapacity;
  policy?: ApplianceResourcePolicy;
  requiredFreeBytes?: number;
}): ResourcePressureSummary {
  const policy = input.policy ?? getApplianceResourcePolicy();
  const requiredFreeBytes = Math.max(input.requiredFreeBytes ?? policy.dataFreeBlockBytes, policy.dataFreeBlockBytes);

  if (input.capacity.status === "unavailable") {
    return {
      status: "degraded",
      summary: "Writable data volume capacity is unavailable.",
      remediation: "Inspect the mounted DATA_DIR volume and host filesystem capacity support.",
      warnings: [`Writable data volume capacity is unavailable: ${input.capacity.reason}`],
      metadata: {
        warnFreeBytes: policy.dataFreeWarnBytes,
        warnFreePercent: policy.dataFreeWarnPercent,
        blockFreeBytes: policy.dataFreeBlockBytes,
        blockFreePercent: policy.dataFreeBlockPercent,
        requiredFreeBytes,
        reason: "capacity_unavailable",
      },
    };
  }

  const percentFree = input.capacity.totalBytes > 0
    ? (input.capacity.freeBytes / input.capacity.totalBytes) * 100
    : 0;
  const baseMetadata = {
    totalBytes: input.capacity.totalBytes,
    freeBytes: input.capacity.freeBytes,
    usedBytes: input.capacity.usedBytes,
    percentUsed: input.capacity.percentUsed,
    percentFree,
    warnFreeBytes: policy.dataFreeWarnBytes,
    warnFreePercent: policy.dataFreeWarnPercent,
    blockFreeBytes: policy.dataFreeBlockBytes,
    blockFreePercent: policy.dataFreeBlockPercent,
    requiredFreeBytes,
  };

  if (input.capacity.freeBytes < requiredFreeBytes || percentFree < policy.dataFreeBlockPercent) {
    return {
      status: "blocked",
      summary: "Writable data volume free space is below the appliance safety floor.",
      remediation: "Free disk space or attach a larger DATA_DIR volume before running backup, restore, or large media work.",
      warnings: ["Writable data volume free space is critically low."],
      metadata: {
        ...baseMetadata,
        reason: input.capacity.freeBytes < requiredFreeBytes ? "free_bytes_below_required" : "free_percent_below_block",
      },
    };
  }

  if (input.capacity.freeBytes < policy.dataFreeWarnBytes || percentFree < policy.dataFreeWarnPercent) {
    return {
      status: "degraded",
      summary: "Writable data volume free space is below the appliance warning threshold.",
      remediation: "Plan disk cleanup or volume expansion before large backups, restores, or media renders.",
      warnings: ["Writable data volume free space is low."],
      metadata: {
        ...baseMetadata,
        reason: input.capacity.freeBytes < policy.dataFreeWarnBytes ? "free_bytes_below_warn" : "free_percent_below_warn",
      },
    };
  }

  return {
    status: "healthy",
    summary: "Writable data volume has sufficient free space.",
    remediation: null,
    warnings: [],
    metadata: {
      ...baseMetadata,
      reason: "capacity_healthy",
    },
  };
}

export function assertResourcePressureAllows(input: {
  operation: ResourcePressureOperation;
  pressure: ResourcePressureSummary;
  allowDegraded?: boolean;
}): void {
  if (input.pressure.status === "blocked") {
    throw new ResourcePressureError(
      `${operationLabel(input.operation)} is blocked because writable data volume free space is critically low.`,
      input.operation,
      "blocked",
      input.pressure.metadata,
    );
  }
  if (input.pressure.status === "degraded" && !input.allowDegraded) {
    throw new ResourcePressureError(
      `${operationLabel(input.operation)} is blocked because writable data volume capacity could not be verified safely.`,
      input.operation,
      "degraded",
      input.pressure.metadata,
    );
  }
}

export function reserveForArchive(input: {
  policy?: ApplianceResourcePolicy;
  archiveSizeBytes?: number | null;
}): number {
  return computeBackupReserveBytes({
    policy: input.policy ?? getApplianceResourcePolicy(),
    archiveSizeBytes: input.archiveSizeBytes,
  });
}

function operationLabel(operation: ResourcePressureOperation): string {
  switch (operation) {
    case "manual_backup":
      return "Manual backup";
    case "scheduled_backup":
      return "Scheduled backup";
    case "pre_restore_backup":
      return "Pre-restore safety backup";
    case "restore_execute":
      return "Restore execution";
  }
}
