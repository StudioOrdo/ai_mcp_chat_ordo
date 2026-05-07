import { describe, expect, it } from "vitest";

import {
  DEFAULT_APPLIANCE_RESOURCE_POLICY,
  type ApplianceResourcePolicy,
} from "./appliance-resource-policy";
import { ResourcePressureService } from "./resource-pressure-service";

const policy: ApplianceResourcePolicy = {
  ...DEFAULT_APPLIANCE_RESOURCE_POLICY,
  dataFreeWarnBytes: 200,
  dataFreeWarnPercent: 20,
  dataFreeBlockBytes: 100,
  dataFreeBlockPercent: 10,
};

function capacity(freeBytes: number, totalBytes = 1000) {
  return {
    status: "available" as const,
    checkedAt: "2026-05-03T00:00:00.000Z",
    rootPath: "/app/.data",
    totalBytes,
    freeBytes,
    usedBytes: totalBytes - freeBytes,
    percentUsed: ((totalBytes - freeBytes) / totalBytes) * 100,
  };
}

describe("ResourcePressureService", () => {
  it("allows backup work when capacity is healthy", async () => {
    const service = new ResourcePressureService({
      getPolicy: () => policy,
      getCapacity: async () => capacity(500),
    });

    await expect(service.assertCanCreateBackup()).resolves.toMatchObject({
      status: "healthy",
    });
  });

  it("allows degraded manual backup with warnings", async () => {
    const service = new ResourcePressureService({
      getPolicy: () => policy,
      getCapacity: async () => capacity(150),
    });

    await expect(service.assertCanCreateBackup()).resolves.toMatchObject({
      status: "degraded",
      warnings: ["Writable data volume free space is low."],
    });
  });

  it("blocks restore execution below archive reserve", async () => {
    const service = new ResourcePressureService({
      getPolicy: () => policy,
      getCapacity: async () => capacity(250),
    });

    await expect(service.assertCanExecuteRestore({ archiveSizeBytes: 200 }))
      .rejects.toMatchObject({
        code: "APPLIANCE_RESOURCE_PRESSURE",
        operation: "restore_execute",
        status: "blocked",
      });
  });

  it("blocks when capacity cannot be read below the hard safety decision", async () => {
    const service = new ResourcePressureService({
      getPolicy: () => policy,
      getCapacity: async () => capacity(50),
    });

    await expect(service.assertCanCreateBackup()).rejects.toThrow(/critically low/i);
  });
});
