import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BackupSelfServiceDashboard } from "@/lib/appliance/backup/backup-self-service";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { BackupSelfServiceManager } from "./BackupSelfServiceManager";

function dashboard(): BackupSelfServiceDashboard {
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
      latestAttemptStatus: "succeeded",
      nextScheduledAt: null,
      overdue: false,
      retentionCount: 7,
      validatedBackupCount: 1,
      lastFailureMessage: null,
      warnings: [],
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
        kind: "manual",
        status: "validated",
        archivePath: "/tmp/backup.zip",
        archiveHash: "hash",
        archiveSizeBytes: 2048,
        manifestSchemaVersion: "1",
        appVersion: "test",
        createdByUserId: "usr_admin",
        createdAt: "2026-05-06T00:00:00.000Z",
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
        preRestoreBackupCommandId: null,
        preRestoreBackupSnapshotId: null,
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
    commandCounts: { pending: 0, running: 0, failed: 0 },
    resources: {
      status: "healthy",
      summary: "Writable data volume has sufficient free space.",
      remediation: null,
      warnings: [],
      metadata: {
        freeBytes: 10_000_000,
        warnFreeBytes: 1_000_000,
        warnFreePercent: 10,
        blockFreeBytes: 500_000,
        blockFreePercent: 5,
        requiredFreeBytes: 1_000_000,
        reason: "capacity_healthy",
      },
    },
    warnings: [],
  };
}

describe("BackupSelfServiceManager", () => {
  it("renders eligible backup validate and prepare-restore actions in backup view", () => {
    render(<BackupSelfServiceManager dashboard={dashboard()} initialView="backups" />);

    expect(screen.getByRole("button", { name: "Create Backup" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Backups" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Prepare Restore" })).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "Restore Plans" })).toBeNull();
  });

  it("keeps restore execution disabled until confirmation and safety backup requirements are met", () => {
    render(<BackupSelfServiceManager dashboard={dashboard()} initialView="restore-plans" />);

    expect(screen.queryByRole("heading", { name: "Backups" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Restore Plans" })).toBeInTheDocument();
    const restorePlan = screen.getByText("restore_1").closest("div");
    expect(restorePlan).not.toBeNull();
    const scope = within(restorePlan?.parentElement ?? document.body);

    expect(scope.getByRole("button", { name: "Confirm" })).toBeEnabled();
    expect(scope.getByRole("button", { name: "Safety Backup" })).toBeDisabled();
    expect(scope.getByRole("button", { name: "Execute Restore" })).toBeDisabled();
    expect(scope.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("offers create-backup next action when no backups exist", () => {
    const model = dashboard();
    model.recentBackups = [];

    render(<BackupSelfServiceManager dashboard={model} initialView="backups" />);

    expect(screen.getByRole("button", { name: "Create Backup" })).toBeEnabled();
    expect(screen.getByText("No backups exist. Create a backup before making risky changes.")).toBeInTheDocument();
  });

  it("shows backup validation failure state to admins", () => {
    const model = dashboard();
    const firstBackup = model.recentBackups[0];
    if (!firstBackup) {
      throw new Error("Expected backup fixture.");
    }
    model.recentBackups = [
      {
        ...firstBackup,
        status: "failed",
        archivePath: null,
        archiveHash: null,
        archiveSizeBytes: null,
        failureMessage: "Archive validation failed.",
      },
    ];

    render(<BackupSelfServiceManager dashboard={model} initialView="backups" />);

    expect(screen.getByText("Archive validation failed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Prepare Restore" })).toBeDisabled();
  });
});
