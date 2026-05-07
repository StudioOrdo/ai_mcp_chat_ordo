import { describe, expect, it, vi } from "vitest";

import type { BackupSelfServiceDashboard } from "@/lib/appliance/backup/backup-self-service";
import type { ProviderDiagnosticsReport } from "@/lib/ai/providers/provider-diagnostics";
import type { AdminJobListViewModel } from "@/lib/admin/jobs/admin-jobs";
import type { OperatorBlockPayload, SystemHealthBlockData } from "@/lib/operator/operator-shared";

import { loadAdminSystemWorkspace } from "./load-admin-system-workspace";

function health(overrides: Partial<SystemHealthBlockData["summary"]> = {}): OperatorBlockPayload<SystemHealthBlockData> {
  return {
    blockId: "system_health",
    state: "ready",
    data: {
      summary: {
        overallStatus: "ok",
        readinessStatus: "ok",
        livenessStatus: "ok",
        environmentStatus: "ok",
        ...overrides,
      },
      release: {
        appName: "Studio Ordo",
        version: "test",
        gitSha: null,
        gitBranch: null,
        builtAt: null,
        nodeVersion: "22",
      },
      metrics: { mode: "test", details: "test" },
      referral: {
        publicOrigin: "http://localhost:3000",
        originSource: "environment",
        localhostFallback: false,
        knownReferrerPromptVerified: true,
        missingReferrerPromptVerified: true,
        warnings: [],
      },
      warnings: [],
      generatedAt: "2026-05-06T00:00:00.000Z",
    },
  };
}

function providers(overrides: Partial<ProviderDiagnosticsReport["intelligence"]> = {}): ProviderDiagnosticsReport {
  return {
    intelligence: {
      provider: "anthropic",
      providerSource: "env",
      model: "claude-test",
      modelSource: "env",
      apiKeyConfigured: true,
      apiKeySource: "env",
      baseUrlConfigured: false,
      baseUrlSource: "missing",
      warningCodes: [],
      ...overrides,
    },
    capabilities: [
      {
        slot: "image",
        provider: "openai",
        state: "available",
        reason: "provider_configured",
        model: "image-test",
        requiredKeyConfigured: true,
        requiredKeySource: "env",
        impactedTools: ["generate_image"],
      },
    ],
      toolSummary: {
      total: 2,
      byState: { enabled: 2 },
      protectedCount: 1,
      staticLockedCount: 0,
      providerGatedCount: 1,
      warnings: 0,
    },
  };
}

function backups(): BackupSelfServiceDashboard {
  return {
    executor: {
      status: "healthy",
      summary: "Backup executor ready.",
      executorDisabled: false,
      executorAvailable: true,
      executorPath: "/bin/ordo-backup",
      canEnqueueExecution: true,
      warnings: [],
    },
    policyHealth: {
      status: "healthy",
      summary: "Automatic backups are healthy.",
      policy: {
        id: "default",
        enabled: true,
        interval: "daily",
        retentionCount: 7,
        latestSuccessfulBackupId: null,
        lastScheduledAt: null,
        nextScheduledAt: null,
        updatedByUserId: null,
        updatedAt: "2026-05-06T00:00:00.000Z",
      },
      latestSuccessfulBackup: null,
      latestAttempt: null,
      latestScheduledCommand: null,
      warnings: [],
      latestAttemptStatus: "succeeded",
      validatedBackupCount: 1,
      nextScheduledAt: null,
      overdue: false,
      retentionCount: 7,
      lastFailureMessage: null,
    },
    policy: {
      id: "default",
      enabled: true,
      interval: "daily",
      retentionCount: 7,
      latestSuccessfulBackupId: null,
      lastScheduledAt: null,
      nextScheduledAt: null,
      updatedByUserId: null,
      updatedAt: "2026-05-06T00:00:00.000Z",
    },
    latestSuccessfulBackup: null,
    latestAttempt: null,
    recentBackups: [
      {
        id: "backup_1",
        status: "validated",
        kind: "manual",
        createdAt: "2026-05-06T00:00:00.000Z",
        archivePath: "/tmp/backup.zip",
        archiveHash: "hash",
        archiveSizeBytes: 2048,
        manifestSchemaVersion: "1",
        appVersion: "test",
        createdByUserId: "usr_admin",
        validatedAt: "2026-05-06T00:00:00.000Z",
        failureMessage: null,
      },
    ],
    recentRestorePlans: [
      {
        id: "restore_1",
        snapshotId: "backup_1",
        status: "confirmation_required",
        archivePath: "/tmp/backup.zip",
        archiveHash: "hash",
        archiveSizeBytes: 2048,
        manifestSchemaVersion: "1",
        appVersion: "test",
        restorePlanVersion: "1",
        impact: {
          snapshotId: "backup_1",
          snapshotKind: "manual",
          snapshotCreatedAt: "2026-05-06T00:00:00.000Z",
          archivePath: "/tmp/backup.zip",
          archiveHash: "hash",
          archiveSizeBytes: 2048,
          manifestSchemaVersion: "1",
          appVersion: "test",
          sourceRuntimeProfileId: "runtime_test",
          sourceDataRoot: "/data",
          targetDataDir: "/data",
          targetSqlitePath: "/data/ordo.db",
          targetBlogAssetRoot: "/data/blog-assets",
          targetUserFileRoot: "/data/user-files",
          includedRoots: ["sqlite"],
          manifestWarnings: [],
          dataBoundaryWarnings: [],
          environmentNote: "test",
        },
        validationWarnings: [],
        confirmationPhrase: "RESTORE backup_1",
        preRestoreBackupSnapshotId: null,
        preRestoreBackupCommandId: null,
        restoreCommandId: null,
        confirmedByUserId: null,
        confirmedAt: null,
        failureMessage: null,
        createdByUserId: "usr_admin",
        createdAt: "2026-05-06T00:00:00.000Z",
        updatedAt: "2026-05-06T00:00:00.000Z",
      },
    ],
    recentCommands: [],
    commandCounts: { pending: 1 },
    resources: {
      status: "healthy",
      summary: "Writable data volume has sufficient free space.",
      remediation: null,
      metadata: {
        freeBytes: 10_000_000,
        warnFreeBytes: 1_000_000,
        warnFreePercent: 10,
        blockFreeBytes: 500_000,
        blockFreePercent: 5,
        requiredFreeBytes: 1_000_000,
        reason: "capacity_healthy",
      },
      warnings: [],
    },
    warnings: [],
  };
}

function jobs(): AdminJobListViewModel {
  return {
    filters: { status: "all", family: "all", toolName: "" },
    statusCounts: { queued: 1, running: 2, failed: 1 },
    familyCounts: {},
    toolNameCounts: {},
    familyOptions: [],
    toolOptions: [],
    total: 4,
    jobs: [
      {
        id: "job_1",
        toolName: "create_appliance_backup",
        toolLabel: "Create Appliance Backup",
        toolFamily: "system",
        toolFamilyLabel: "System",
        defaultSurface: "global",
        executionPrincipal: "system_worker",
        status: "failed",
        priority: 0,
        userName: null,
        conversationTitle: null,
        progressPercent: null,
        progressLabel: null,
        attemptCount: 2,
        createdAt: "2026-05-06T00:00:00.000Z",
        startedAt: null,
        completedAt: null,
        detailHref: "/admin/jobs/job_1",
        duration: null,
        canManage: true,
        canCancel: false,
        canRequeue: false,
        canRetry: true,
        interactionExecutionState: "failed",
        interactionTimelineSupportLevel: "supported",
        interactionTimelineSummary: null,
        interactionTimelineEventCount: 0,
        interactionRevisionSupportLevel: "unsupported",
        interactionRevisionState: "unsupported",
        interactionRevisionSummary: null,
        interactionRevisionActionCount: 0,
      },
    ],
  };
}

describe("loadAdminSystemWorkspace", () => {
  it("builds the admin System sections, brief, backups, restore plans, and job diagnostics", async () => {
    const workspace = await loadAdminSystemWorkspace(
      { id: "usr_admin", roles: ["ADMIN"] },
      { section: "backups" },
      {
        loadHealth: vi.fn(async () => health()),
        loadProviders: vi.fn(async () => providers()),
        loadBackups: vi.fn(async () => backups()),
        loadJobs: vi.fn(async () => jobs()),
      },
    );

    expect(workspace.brief.title).toBe("System Brief");
    expect(workspace.sections.map((section) => section.title)).toEqual([
      "Overview",
      "Health",
      "Providers",
      "Tools",
      "Capabilities",
      "Visibility",
      "Prompts",
      "Backups",
      "Restore Plans",
      "Jobs",
      "Operations",
      "Logs",
      "Keys",
    ]);
    expect(workspace.selectedSection?.id).toBe("backups");
    expect(workspace.summary.backupCount).toBe(1);
    expect(workspace.summary.restorePlanCount).toBe(1);
    expect(workspace.summary.toolCount).toBe(2);
    expect(workspace.summary.protectedToolCount).toBe(1);
    expect(workspace.summary.failedJobs).toBe(1);
    expect(workspace.summary.retryableJobs).toBe(1);
  });

  it("keeps System usable when one diagnostic source fails", async () => {
    const workspace = await loadAdminSystemWorkspace(
      { id: "usr_admin", roles: ["ADMIN"] },
      {},
      {
        loadHealth: vi.fn(async () => health({ overallStatus: "degraded" })),
        loadProviders: vi.fn(async () => { throw new Error("provider diagnostics failed"); }),
        loadBackups: vi.fn(async () => backups()),
        loadJobs: vi.fn(async () => jobs()),
      },
    );

    expect(workspace.loadErrors).toEqual([
      { source: "providers", message: "provider diagnostics failed" },
    ]);
    expect(workspace.summary.warningCount).toBeGreaterThan(0);
    expect(workspace.brief.status).toBe("limited");
  });
});
