import { afterEach, describe, expect, it, vi } from "vitest";
import { createDataBoundaryProbe } from "./data-boundary-probe";
import { createRuntimeProfileProbe } from "./runtime-profile-probe";
import { createSqliteProbe } from "./sqlite-probe";
import { createMediaWorkerProbe } from "./media-worker-probe";
import { createDeferredWorkerProbe } from "./deferred-worker-probe";
import { createSearchIndexProbe } from "./search-index-probe";
import { createBackupRestoreProbe } from "./backup-restore-probe";
import { createResourcePressureProbe } from "./resource-pressure-probe";
import { createProviderProbe } from "./provider-probe";
import { createNetworkProbe } from "./network-probe";
import type { ApplianceHealthContext } from "../health-types";
import type { ProviderDiagnosticsReport } from "@/lib/ai/providers/provider-diagnostics";
import { DEFAULT_APPLIANCE_RESOURCE_POLICY } from "@/lib/appliance/resources/appliance-resource-policy";

const generatedAt = "2026-05-02T00:00:00.000Z";

const providerDiagnostics: ProviderDiagnosticsReport = {
  intelligence: {
    provider: "anthropic",
    providerSource: "env",
    model: "claude-haiku-4-5",
    modelSource: "env",
    apiKeyConfigured: true,
    apiKeySource: "env",
    baseUrlConfigured: false,
    baseUrlSource: "default",
    warningCodes: [],
  },
  capabilities: [],
  toolSummary: {
    total: 1,
    byState: { enabled: 1 },
    protectedCount: 0,
    staticLockedCount: 0,
    providerGatedCount: 0,
    warnings: 0,
  },
};

function context(overrides: Partial<ApplianceHealthContext> = {}): ApplianceHealthContext {
  return {
    generatedAt,
    timeoutMs: 10,
    providerDiagnostics,
    profile: {
      profileId: "single_image",
      processRole: "app",
      nodeEnv: "production",
      isDocker: true,
      isCompose: false,
      dataDir: "/app/.data",
      sqlitePath: "/app/.data/local.db",
      sqliteInsideDataDir: true,
      mediaWorker: {
        mode: "supervised_child",
        url: "http://127.0.0.1:3101",
        port: 3101,
        disabled: false,
      },
      deferredWorker: {
        mode: "supervised_child",
        disabled: false,
        workerId: "worker_1",
      },
      warnings: [],
    },
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
    ...overrides,
  };
}

describe("appliance probes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports runtime and data probes healthy", () => {
    expect(createRuntimeProfileProbe().run(context())).toMatchObject({ status: "healthy" });
    expect(createDataBoundaryProbe().run(context())).toMatchObject({ status: "healthy" });
  });

  it("reports sqlite blocked through injected checker", async () => {
    const result = await createSqliteProbe({
      check: () => {
        throw new Error("database is locked");
      },
    }).run(context());

    expect(result).toMatchObject({
      status: "blocked",
      component: "sqlite",
    });
  });

  it("reports provider blocked when intelligence key is missing", () => {
    const result = createProviderProbe().run(context({
      providerDiagnostics: {
        ...providerDiagnostics,
        intelligence: {
          ...providerDiagnostics.intelligence,
          apiKeyConfigured: false,
        },
      },
    }));

    expect(result).toMatchObject({
      status: "blocked",
      component: "provider",
    });
  });

  it("reports hosted network origin failures as blocked", () => {
    vi.stubEnv("ORDO_HOSTED_MODE", "reverse_proxy");
    vi.stubEnv("ORDO_PUBLIC_ORIGIN", "");

    const result = createNetworkProbe().run(context());

    expect(result).toMatchObject({
      component: "network",
      status: "blocked",
      impact: "required",
    });
  });

  it("reports media worker disabled and degraded states", async () => {
    const disabled = await createMediaWorkerProbe().run(context({
      profile: {
        ...context().profile,
        mediaWorker: {
          mode: "disabled",
          url: null,
          port: null,
          disabled: true,
        },
      },
    }));
    expect(disabled.status).toBe("disabled");

    const degraded = await createMediaWorkerProbe({
      checkHealth: async () => ({ ok: false, statusCode: 503, error: "unavailable" }),
    }).run(context());
    expect(degraded.status).toBe("degraded");
  });

  it("reports deferred worker contract failure as degraded", async () => {
    const result = await createDeferredWorkerProbe({
      checkContracts: () => {
        throw new Error("handler drift");
      },
    }).run(context());

    expect(result).toMatchObject({
      status: "degraded",
      component: "deferred_worker",
    });
  });

  it("reports search health states through a narrow reader", async () => {
    const healthy = await createSearchIndexProbe({
      reader: {
        getStats: () => ({
          sourceType: "corpus",
          embeddingCount: 10,
          bm25DocCount: 10,
          bm25Stale: false,
        }),
      },
    }).run(context());
    expect(healthy.status).toBe("healthy");

    const unknown = await createSearchIndexProbe().run(context());
    expect(unknown.status).toBe("unknown");
  });

  it("reports backup restore executor availability as informational health", async () => {
    await expect(createBackupRestoreProbe({
      env: { ORDO_BACKUP_EXECUTOR_PATH: "/missing/ordo-backup" },
      fileExists: () => false,
    }).run(context())).resolves.toMatchObject({
      status: "degraded",
      impact: "informational",
      metadata: {
        executorAvailable: false,
      },
    });
  });

  it("reports resource pressure as required health", async () => {
    await expect(createResourcePressureProbe({
      getPolicy: () => ({
        ...DEFAULT_APPLIANCE_RESOURCE_POLICY,
        dataFreeWarnBytes: 200,
        dataFreeBlockBytes: 100,
      }),
      getCapacity: () => ({
        status: "available",
        checkedAt: generatedAt,
        rootPath: "/app/.data",
        totalBytes: 1000,
        freeBytes: 900,
        usedBytes: 100,
        percentUsed: 10,
      }),
    }).run(context())).resolves.toMatchObject({
      status: "healthy",
      impact: "required",
      component: "resources",
    });
  });
});
