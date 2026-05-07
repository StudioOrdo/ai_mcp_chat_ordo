import type { ApplianceHealthReport, ApplianceHealthSummary } from "@/lib/appliance/health-types";

export type ApplianceSmokeMode = "local" | "docker" | "compose-single-image";
export type LifecycleSmokeStatus = "passed" | "failed" | "skipped";

export interface LifecycleSmokeStepResult {
  name: string;
  status: LifecycleSmokeStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface LifecycleSmokeEvidence {
  phase: "05-docker-and-worker-verification-harness";
  mode: ApplianceSmokeMode;
  status: LifecycleSmokeStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  nodeVersion: string;
  rustVersion: string | null;
  imageTag: string | null;
  gitRevision: string | null;
  dataDirLabel: string;
  appPort: number | null;
  mediaPort: number | null;
  executorPath: string | null;
  health: {
    status: ApplianceHealthReport["status"] | "unavailable";
    summary: ApplianceHealthSummary | null;
    warnings: string[];
  };
  backup: {
    manualBackupId: string | null;
    scheduledBackupId: string | null;
    archiveSizeBytes: number | null;
    archiveHashPrefix: string | null;
  };
  restore: {
    restorePlanId: string | null;
    restoredSeedFile: boolean;
  };
  scheduler: {
    commandId: string | null;
    decision: string | null;
  };
  restart: {
    verified: boolean;
  };
  steps: LifecycleSmokeStepResult[];
  warnings: string[];
}

export interface CommandResult {
  command: string;
  args: string[];
  status: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}
