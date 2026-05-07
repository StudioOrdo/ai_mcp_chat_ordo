import { getEnvConfig } from "@/lib/config/env-config";

const GIB = 1024 * 1024 * 1024;
const MIB = 1024 * 1024;

export interface ApplianceResourcePolicy {
  dataFreeWarnBytes: number;
  dataFreeWarnPercent: number;
  dataFreeBlockBytes: number;
  dataFreeBlockPercent: number;
  tmpSize: string;
  runtimeLogTmpfsSize: string;
  nextCacheTmpfsSize: string;
  pidsLimit: number;
  memoryReservation: string;
  memoryLimit: string;
  cpus: string;
  logMaxSize: string;
  logMaxFile: number;
  workerMaxRestarts: number;
  workerRestartWindowMs: number;
}

export const DEFAULT_APPLIANCE_RESOURCE_POLICY: ApplianceResourcePolicy = {
  dataFreeWarnBytes: 2 * GIB,
  dataFreeWarnPercent: 15,
  dataFreeBlockBytes: 512 * MIB,
  dataFreeBlockPercent: 5,
  tmpSize: "512m",
  runtimeLogTmpfsSize: "64m",
  nextCacheTmpfsSize: "256m",
  pidsLimit: 256,
  memoryReservation: "512m",
  memoryLimit: "2g",
  cpus: "2.0",
  logMaxSize: "10m",
  logMaxFile: 5,
  workerMaxRestarts: 3,
  workerRestartWindowMs: 60_000,
};

export function getApplianceResourcePolicy(): ApplianceResourcePolicy {
  const env = getEnvConfig();
  const policy = {
    dataFreeWarnBytes: env.ORDO_DATA_FREE_WARN_BYTES ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.dataFreeWarnBytes,
    dataFreeWarnPercent: env.ORDO_DATA_FREE_WARN_PERCENT ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.dataFreeWarnPercent,
    dataFreeBlockBytes: env.ORDO_DATA_FREE_BLOCK_BYTES ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.dataFreeBlockBytes,
    dataFreeBlockPercent: env.ORDO_DATA_FREE_BLOCK_PERCENT ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.dataFreeBlockPercent,
    tmpSize: env.ORDO_TMP_SIZE ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.tmpSize,
    runtimeLogTmpfsSize: env.ORDO_RUNTIME_LOG_TMPFS_SIZE ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.runtimeLogTmpfsSize,
    nextCacheTmpfsSize: env.ORDO_NEXT_CACHE_TMPFS_SIZE ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.nextCacheTmpfsSize,
    pidsLimit: env.ORDO_PIDS_LIMIT ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.pidsLimit,
    memoryReservation: env.ORDO_MEMORY_RESERVATION ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.memoryReservation,
    memoryLimit: env.ORDO_MEMORY_LIMIT ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.memoryLimit,
    cpus: env.ORDO_CPUS ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.cpus,
    logMaxSize: env.ORDO_LOG_MAX_SIZE ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.logMaxSize,
    logMaxFile: env.ORDO_LOG_MAX_FILE ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.logMaxFile,
    workerMaxRestarts: env.ORDO_WORKER_MAX_RESTARTS ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.workerMaxRestarts,
    workerRestartWindowMs: env.ORDO_WORKER_RESTART_WINDOW_MS ?? DEFAULT_APPLIANCE_RESOURCE_POLICY.workerRestartWindowMs,
  };

  validateApplianceResourcePolicy(policy);
  return policy;
}

export function validateApplianceResourcePolicy(policy: ApplianceResourcePolicy): void {
  if (policy.dataFreeBlockBytes > policy.dataFreeWarnBytes) {
    throw new Error("ORDO_DATA_FREE_BLOCK_BYTES cannot exceed ORDO_DATA_FREE_WARN_BYTES.");
  }
  if (policy.dataFreeBlockPercent > policy.dataFreeWarnPercent) {
    throw new Error("ORDO_DATA_FREE_BLOCK_PERCENT cannot exceed ORDO_DATA_FREE_WARN_PERCENT.");
  }
  for (const [name, value] of Object.entries({
    dataFreeWarnBytes: policy.dataFreeWarnBytes,
    dataFreeBlockBytes: policy.dataFreeBlockBytes,
    pidsLimit: policy.pidsLimit,
    logMaxFile: policy.logMaxFile,
    workerMaxRestarts: policy.workerMaxRestarts,
    workerRestartWindowMs: policy.workerRestartWindowMs,
  })) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${name} must be a positive integer.`);
    }
  }
  for (const [name, value] of Object.entries({
    dataFreeWarnPercent: policy.dataFreeWarnPercent,
    dataFreeBlockPercent: policy.dataFreeBlockPercent,
  })) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`${name} must be between 0 and 100.`);
    }
  }
}

export function computeBackupReserveBytes(input: {
  policy: Pick<ApplianceResourcePolicy, "dataFreeBlockBytes">;
  archiveSizeBytes?: number | null;
}): number {
  const archiveReserve = typeof input.archiveSizeBytes === "number" && Number.isFinite(input.archiveSizeBytes)
    ? Math.max(Math.ceil(input.archiveSizeBytes * 2), 0)
    : 0;
  return Math.max(input.policy.dataFreeBlockBytes, archiveReserve);
}
