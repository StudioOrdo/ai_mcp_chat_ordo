import { readFileSync } from "node:fs";
import path from "node:path";
import { getApplianceDataBoundary } from "@/lib/appliance/data-boundary";
import { getApplianceRuntimeProfile } from "@/lib/appliance/runtime-profile";
import type { BackupCommandPayload, BackupKind, OperationCommandMetadata } from "./types";

export interface BackupExecutorPayloadInput {
  kind: BackupKind;
  snapshotId: string;
  requestedAt?: string;
  restorePlanId?: string;
  operation: OperationCommandMetadata | null;
  getDataBoundary?: typeof getApplianceDataBoundary;
  getRuntimeProfile?: typeof getApplianceRuntimeProfile;
  appVersion?: string;
}

export function createBackupExecutorPayload(input: BackupExecutorPayloadInput): BackupCommandPayload {
  const boundary = (input.getDataBoundary ?? getApplianceDataBoundary)();
  const runtime = (input.getRuntimeProfile ?? getApplianceRuntimeProfile)();
  return {
    kind: input.kind,
    requestedAt: input.requestedAt ?? new Date().toISOString(),
    snapshotId: input.snapshotId,
    dataBoundary: {
      dataDir: boundary.dataDir,
      sqlitePath: boundary.sqlitePath,
      blogAssetRoot: boundary.blogAssetRoot,
      userFileRoot: boundary.userFileRoot,
    },
    appVersion: input.appVersion ?? getPackageVersion(),
    sourceRuntimeProfileId: runtime.profileId,
    ...(input.restorePlanId ? { restorePlanId: input.restorePlanId } : {}),
    operation: input.operation ?? null,
  };
}

function getPackageVersion(): string {
  try {
    const raw = readFileSync(path.join(process.cwd(), "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" && parsed.version.trim() ? parsed.version : "unknown";
  } catch {
    return "unknown";
  }
}
