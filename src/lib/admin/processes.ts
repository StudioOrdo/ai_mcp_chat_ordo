import fs from "node:fs";
import path from "node:path";
import { validateRequiredRuntimeConfig } from "@/lib/config/env";
import { getProviderDiagnosticsReportSync } from "@/lib/ai/providers/provider-diagnostics";
import { getLivenessProbe, getReadinessProbe } from "@/lib/health/probes";
import { getApplianceHealthReport } from "@/lib/appliance/health-facade";
import { getApplianceRuntimeProfile } from "@/lib/appliance/runtime-profile";
import { getApplianceDataBoundary } from "@/lib/appliance/data-boundary";
import { getMetricsSnapshot } from "@/lib/observability/metrics";
import {
  resolveRuntimeAuditLogDir,
  resolveRuntimeAuditLogFilePath,
} from "@/lib/observability/runtime-audit-log";
import { buildReferralContextBlock } from "@/lib/chat/referral-context";
import { resolveReferralPublicOrigin, type ReferralOriginSource } from "@/lib/referrals/referral-origin";

export type AdminStatus = "ok" | "error";

export interface ReleaseManifestReport {
  present: boolean;
  error?: string;
  manifest: {
    appName: string;
    version: string;
    gitSha: string | null;
    gitBranch: string | null;
    builtAt: string | null;
    nodeVersion: string | null;
  } | null;
}

export interface ReferralOperationalDiagnostics {
  status: AdminStatus;
  publicOrigin: string;
  originSource: ReferralOriginSource;
  localhostFallback: boolean;
  knownReferrerPromptVerified: boolean;
  missingReferrerPromptVerified: boolean;
  warnings: string[];
}

export function getReleaseManifestReport(): ReleaseManifestReport {
  const releaseManifestPath = path.join(process.cwd(), "release", "manifest.json");

  if (!fs.existsSync(releaseManifestPath)) {
    return {
      present: false,
      manifest: null,
      error: "Release manifest is missing.",
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(releaseManifestPath, "utf8")) as {
      appName?: string;
      version?: string;
      gitSha?: string;
      gitBranch?: string;
      builtAt?: string;
      nodeVersion?: string;
    };

    return {
      present: true,
      manifest: {
        appName: parsed.appName ?? "unknown",
        version: parsed.version ?? "unknown",
        gitSha: parsed.gitSha ?? null,
        gitBranch: parsed.gitBranch ?? null,
        builtAt: parsed.builtAt ?? null,
        nodeVersion: parsed.nodeVersion ?? null,
      },
    };
  } catch (error) {
    return {
      present: false,
      manifest: null,
      error:
        error instanceof Error
          ? error.message
          : "Release manifest could not be parsed.",
    };
  }
}

export function getDiagnosticsReport() {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const releaseManifestPath = path.join(
    process.cwd(),
    "release",
    "manifest.json",
  );

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
    name?: string;
  };
  const referral = getReferralOperationalDiagnostics();
  const runtimeAuditLogDir = resolveRuntimeAuditLogDir();
  const providerDiagnostics = getProviderDiagnosticsReportSync();
  const runtimeProfile = getApplianceRuntimeProfile();
  const dataBoundary = getApplianceDataBoundary();
  const appliance = {
    runtimeProfile: {
      profileId: runtimeProfile.profileId,
      processRole: runtimeProfile.processRole,
      mediaWorkerMode: runtimeProfile.mediaWorker.mode,
      deferredWorkerMode: runtimeProfile.deferredWorker.mode,
      warnings: runtimeProfile.warnings,
    },
    dataBoundary: {
      dataDir: dataBoundary.dataDir,
      sqlitePath: dataBoundary.sqlitePath,
      sqliteInsideDataDir: dataBoundary.sqliteInsideDataDir,
      blogAssetRoot: dataBoundary.blogAssetRoot,
      userFileRoot: dataBoundary.userFileRoot,
      warnings: dataBoundary.warnings,
    },
  };

  return {
    status: "ok" as const,
    generatedAt: new Date().toISOString(),
    appName: packageJson.name ?? "unknown",
    appVersion: packageJson.version ?? "unknown",
    nodeVersion: process.version,
    nodeEnv: process.env.NODE_ENV ?? "development",
    providerDiagnostics,
    intelligenceProvider: providerDiagnostics.intelligence,
    appliance,
    releaseManifestPresent: fs.existsSync(releaseManifestPath),
    metrics: getMetricsSnapshot(),
    runtimeAudit: {
      directory: runtimeAuditLogDir,
      files: {
        deferredJob: resolveRuntimeAuditLogFilePath("deferred_job"),
        nativeProcess: resolveRuntimeAuditLogFilePath("native_process"),
        remoteService: resolveRuntimeAuditLogFilePath("remote_service"),
        mcpProcess: resolveRuntimeAuditLogFilePath("mcp_process"),
      },
    },
    referral,
  };
}

export function getReferralOperationalDiagnostics(): ReferralOperationalDiagnostics {
  const origin = resolveReferralPublicOrigin();
  const knownReferrerBlock = buildReferralContextBlock({
    referralId: "ref_diag",
    referralCode: "mentor-42",
    referrerUserId: "usr_affiliate",
    referrerName: "Ada Lovelace",
    referrerCredential: "Founder",
    referredUserId: null,
    conversationId: "conv_diag",
    status: "engaged",
    creditStatus: "tracked",
  });
  const missingReferrerBlock = buildReferralContextBlock(null);
  const warnings: string[] = [];

  if (origin.invalidConfiguredOrigin) {
    warnings.push(`Configured public origin is invalid: ${origin.invalidConfiguredOrigin}`);
  }

  const knownReferrerPromptVerified = knownReferrerBlock.includes("referral_known=true")
    && knownReferrerBlock.includes('referrer_name="Ada Lovelace"')
    && knownReferrerBlock.includes("referral_instruction=");
  const missingReferrerPromptVerified = missingReferrerBlock.includes("referral_known=false")
    && missingReferrerBlock.includes("cannot identify a validated referrer");

  if (!knownReferrerPromptVerified) {
    warnings.push("Known-referrer prompt verification failed.");
  }

  if (!missingReferrerPromptVerified) {
    warnings.push("Missing-referrer prompt verification failed.");
  }

  return {
    status: warnings.length === 0 ? "ok" : "error",
    publicOrigin: origin.origin,
    originSource: origin.source,
    localhostFallback: origin.localhostFallback,
    knownReferrerPromptVerified,
    missingReferrerPromptVerified,
    warnings,
  };
}

export async function getHealthSweepReport() {
  const liveness = getLivenessProbe();
  const readiness = await getReadinessProbe();
  const appliance = readiness.appliance ?? await getApplianceHealthReport();

  return {
    status:
      readiness.status === "ok" && liveness.status === "ok" && appliance.status !== "blocked"
        ? ("ok" as const)
        : ("error" as const),
    generatedAt: new Date().toISOString(),
    liveness,
    readiness,
    appliance,
  };
}

export function getEnvValidationReport(): {
  status: AdminStatus;
  message: string;
} {
  try {
    validateRequiredRuntimeConfig();
    return {
      status: "ok",
      message: "Environment validation passed.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Environment validation failed.",
    };
  }
}
