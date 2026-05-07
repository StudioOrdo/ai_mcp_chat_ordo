import type { User as SessionUser } from "@/core/entities/user";
import {
  getDiagnosticsReport,
  getEnvValidationReport,
  getHealthSweepReport,
  getReleaseManifestReport,
} from "@/lib/admin/processes";

import {
  assertAdminUser,
  type OperatorBlockPayload,
  type SystemHealthBlockData,
} from "../operator-shared";

export async function loadSystemHealthBlock(
  user: Pick<SessionUser, "id" | "roles">,
): Promise<OperatorBlockPayload<SystemHealthBlockData>> {
  assertAdminUser(user);

  const diagnostics = getDiagnosticsReport();
  const referralDiagnostics = diagnostics.referral ?? {
    publicOrigin: "unknown",
    originSource: "environment",
    localhostFallback: false,
    knownReferrerPromptVerified: true,
    missingReferrerPromptVerified: true,
    warnings: [],
  };
  const healthSweep = await getHealthSweepReport();
  const envValidation = getEnvValidationReport();
  const releaseManifest = getReleaseManifestReport();
  const warnings: string[] = [];

  if (healthSweep.status === "error") {
    warnings.push(healthSweep.readiness.details ?? "Readiness checks are degraded.");
  }

  for (const component of healthSweep.appliance?.components ?? []) {
    if (
      component.status === "degraded"
      || component.status === "blocked"
      || (component.status === "unknown" && component.impact !== "informational")
    ) {
      warnings.push(`${component.component}: ${component.summary}`);
    }
  }

  if (envValidation.status === "error") {
    warnings.push(envValidation.message);
  }

  if (!releaseManifest.present) {
    warnings.push(releaseManifest.error ?? "Release manifest is missing.");
  }

  warnings.push(...referralDiagnostics.warnings);

  return {
    blockId: "system_health",
    state: "ready",
    data: {
      summary: {
        overallStatus: warnings.length === 0 ? "ok" : "degraded",
        readinessStatus: healthSweep.readiness.status,
        livenessStatus: healthSweep.liveness.status,
        environmentStatus: envValidation.status,
      },
      release: {
        appName: releaseManifest.manifest?.appName ?? diagnostics.appName,
        version: releaseManifest.manifest?.version ?? diagnostics.appVersion,
        gitSha: releaseManifest.manifest?.gitSha ?? null,
        gitBranch: releaseManifest.manifest?.gitBranch ?? null,
        builtAt: releaseManifest.manifest?.builtAt ?? null,
        nodeVersion: releaseManifest.manifest?.nodeVersion ?? diagnostics.nodeVersion,
      },
      metrics: diagnostics.metrics,
      referral: referralDiagnostics,
      warnings,
      generatedAt: healthSweep.generatedAt,
    },
  };
}
