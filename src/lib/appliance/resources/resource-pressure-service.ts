import { getMediaVolumeCapacity, type MediaVolumeCapacity } from "@/lib/storage/volume-capacity";
import {
  getApplianceResourcePolicy,
  type ApplianceResourcePolicy,
} from "./appliance-resource-policy";
import {
  assessResourcePressure,
  assertResourcePressureAllows,
  reserveForArchive,
  type ResourcePressureOperation,
  type ResourcePressureSummary,
} from "./resource-pressure";

export interface ResourcePressureServiceDeps {
  getCapacity?: () => Promise<MediaVolumeCapacity>;
  getPolicy?: () => ApplianceResourcePolicy;
}

export class ResourcePressureService {
  constructor(private readonly deps: ResourcePressureServiceDeps = {}) {}

  async getResourcePressureSummary(input: {
    requiredFreeBytes?: number;
  } = {}): Promise<ResourcePressureSummary> {
    return assessResourcePressure({
      capacity: await this.readCapacity(),
      policy: this.getPolicy(),
      requiredFreeBytes: input.requiredFreeBytes,
    });
  }

  async assertCanCreateBackup(): Promise<ResourcePressureSummary> {
    return this.assertAllowed("manual_backup", { allowDegraded: true });
  }

  async assertCanCreateScheduledBackup(): Promise<ResourcePressureSummary> {
    return this.assertAllowed("scheduled_backup", { allowDegraded: true });
  }

  async assertCanCreatePreRestoreBackup(input: {
    archiveSizeBytes?: number | null;
  } = {}): Promise<ResourcePressureSummary> {
    return this.assertAllowed("pre_restore_backup", {
      allowDegraded: true,
      requiredFreeBytes: reserveForArchive({
        policy: this.getPolicy(),
        archiveSizeBytes: input.archiveSizeBytes,
      }),
    });
  }

  async assertCanExecuteRestore(input: {
    archiveSizeBytes?: number | null;
  } = {}): Promise<ResourcePressureSummary> {
    return this.assertAllowed("restore_execute", {
      allowDegraded: true,
      requiredFreeBytes: reserveForArchive({
        policy: this.getPolicy(),
        archiveSizeBytes: input.archiveSizeBytes,
      }),
    });
  }

  private async assertAllowed(
    operation: ResourcePressureOperation,
    options: { allowDegraded: boolean; requiredFreeBytes?: number },
  ): Promise<ResourcePressureSummary> {
    const pressure = await this.getResourcePressureSummary({
      requiredFreeBytes: options.requiredFreeBytes,
    });
    assertResourcePressureAllows({
      operation,
      pressure,
      allowDegraded: options.allowDegraded,
    });
    return pressure;
  }

  private getPolicy(): ApplianceResourcePolicy {
    return this.deps.getPolicy ? this.deps.getPolicy() : getApplianceResourcePolicy();
  }

  private readCapacity(): Promise<MediaVolumeCapacity> {
    return this.deps.getCapacity ? this.deps.getCapacity() : getMediaVolumeCapacity();
  }
}
