import { describe, expect, it } from "vitest";

import { DEFAULT_APPLIANCE_RESOURCE_POLICY } from "@/lib/appliance/resources/appliance-resource-policy";
import { createResourcePressureProbe } from "./resource-pressure-probe";
import type { ApplianceHealthContext } from "../health-types";

const context: ApplianceHealthContext = {
  generatedAt: "2026-05-03T00:00:00.000Z",
  timeoutMs: 10,
  profile: {} as ApplianceHealthContext["profile"],
  providerDiagnostics: undefined,
  dataBoundary: {
    dataDir: "/app/.data",
    sqlitePath: "/app/.data/local.db",
    sqliteWalPath: "/app/.data/local.db-wal",
    sqliteShmPath: "/app/.data/local.db-shm",
    sqliteInsideDataDir: true,
    defaultSqlitePath: "/app/.data/local.db",
    blogAssetRoot: "/app/.data/blog-assets",
    blogAssetRootInsideDataDir: true,
    userFileRoot: "/app/.data/user-files",
    userFileRootInsideDataDir: true,
    requiredIncludePaths: [],
    defaultExcludePaths: [],
    warnings: [],
  },
};

describe("resource pressure probe", () => {
  it("reports healthy data volume capacity", async () => {
    const result = await createResourcePressureProbe({
      getPolicy: () => ({
        ...DEFAULT_APPLIANCE_RESOURCE_POLICY,
        dataFreeWarnBytes: 200,
        dataFreeBlockBytes: 100,
      }),
      getCapacity: async () => ({
        status: "available",
        checkedAt: context.generatedAt,
        rootPath: "/app/.data",
        totalBytes: 1000,
        freeBytes: 500,
        usedBytes: 500,
        percentUsed: 50,
      }),
    }).run(context);

    expect(result).toMatchObject({
      component: "resources",
      status: "healthy",
      impact: "required",
      metadata: {
        freeBytes: 500,
        dockerDefaults: {
          pidsLimit: 256,
        },
      },
    });
  });

  it("blocks readiness when data volume free space is unsafe", async () => {
    const result = await createResourcePressureProbe({
      getPolicy: () => ({
        ...DEFAULT_APPLIANCE_RESOURCE_POLICY,
        dataFreeWarnBytes: 200,
        dataFreeWarnPercent: 20,
        dataFreeBlockBytes: 100,
        dataFreeBlockPercent: 10,
      }),
      getCapacity: async () => ({
        status: "available",
        checkedAt: context.generatedAt,
        rootPath: "/app/.data",
        totalBytes: 1000,
        freeBytes: 50,
        usedBytes: 950,
        percentUsed: 95,
      }),
    }).run(context);

    expect(result.status).toBe("blocked");
    expect(result.warnings).toContain("Writable data volume free space is critically low.");
  });
});
