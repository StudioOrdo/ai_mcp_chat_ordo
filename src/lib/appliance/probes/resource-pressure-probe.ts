import { getMediaVolumeCapacity, type MediaVolumeCapacity } from "@/lib/storage/volume-capacity";
import {
  DEFAULT_APPLIANCE_RESOURCE_POLICY,
  getApplianceResourcePolicy,
  type ApplianceResourcePolicy,
} from "@/lib/appliance/resources/appliance-resource-policy";
import { assessResourcePressure } from "@/lib/appliance/resources/resource-pressure";
import {
  createProbeResult,
  type ApplianceHealthProbe,
} from "../health-types";

interface ResourcePressureProbeOptions {
  getCapacity?: (rootPath: string) => Promise<MediaVolumeCapacity> | MediaVolumeCapacity;
  getPolicy?: () => ApplianceResourcePolicy;
}

export function createResourcePressureProbe(
  options: ResourcePressureProbeOptions = {},
): ApplianceHealthProbe {
  return {
    component: "resources",
    async run(context) {
      const policy = options.getPolicy ? options.getPolicy() : safePolicy();
      const capacity = await (options.getCapacity
        ? options.getCapacity(context.dataBoundary.dataDir)
        : getMediaVolumeCapacity({ rootPath: context.dataBoundary.dataDir }));
      const pressure = assessResourcePressure({ capacity, policy });

      return createProbeResult({
        component: "resources",
        status: pressure.status,
        impact: "required",
        summary: pressure.summary,
        remediation: pressure.remediation,
        metadata: {
          ...pressure.metadata,
          dockerDefaults: {
            tmpSize: policy.tmpSize,
            runtimeLogTmpfsSize: policy.runtimeLogTmpfsSize,
            nextCacheTmpfsSize: policy.nextCacheTmpfsSize,
            pidsLimit: policy.pidsLimit,
            memoryReservation: policy.memoryReservation,
            memoryLimit: policy.memoryLimit,
            cpus: policy.cpus,
            logMaxSize: policy.logMaxSize,
            logMaxFile: policy.logMaxFile,
          },
          workerRestartPolicy: {
            maxRestarts: policy.workerMaxRestarts,
            restartWindowMs: policy.workerRestartWindowMs,
          },
        },
        checkedAt: context.generatedAt,
        warnings: pressure.warnings,
      });
    },
  };
}

function safePolicy(): ApplianceResourcePolicy {
  try {
    return getApplianceResourcePolicy();
  } catch {
    return DEFAULT_APPLIANCE_RESOURCE_POLICY;
  }
}
