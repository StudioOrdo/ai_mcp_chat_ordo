import { getApplianceDataBoundary } from "@/lib/appliance/data-boundary";
import { getApplianceRuntimeProfile } from "@/lib/appliance/runtime-profile";
import {
  getProviderDiagnosticsReportSync,
  type ProviderDiagnosticsReport,
} from "@/lib/ai/providers/provider-diagnostics";
import {
  createProbeResult,
  type ApplianceHealthProbe,
  type ApplianceHealthComponent,
  type ApplianceHealthImpact,
  type ApplianceHealthProbeResult,
  type ApplianceHealthReport,
  type ApplianceHealthStatus,
  type ApplianceHealthSummary,
} from "./health-types";
import { createRuntimeProfileProbe } from "./probes/runtime-profile-probe";
import { createDataBoundaryProbe } from "./probes/data-boundary-probe";
import { createSqliteProbe } from "./probes/sqlite-probe";
import { createProviderProbe } from "./probes/provider-probe";
import { createToolAvailabilityProbe } from "./probes/tool-availability-probe";
import { createNetworkProbe } from "./probes/network-probe";
import { createSecurityProbe } from "./probes/security-probe";
import { createResourcePressureProbe } from "./probes/resource-pressure-probe";
import { createMediaWorkerProbe } from "./probes/media-worker-probe";
import { createDeferredWorkerProbe } from "./probes/deferred-worker-probe";
import { createSearchIndexProbe } from "./probes/search-index-probe";
import { createBackupRestoreProbe } from "./probes/backup-restore-probe";

export interface ApplianceHealthReportOptions {
  probes?: ApplianceHealthProbe[];
  generatedAt?: string;
  timeoutMs?: number;
  providerDiagnostics?: ProviderDiagnosticsReport;
}

export const DEFAULT_APPLIANCE_HEALTH_TIMEOUT_MS = 750;

export function createDefaultApplianceHealthProbes(): ApplianceHealthProbe[] {
  return [
    createRuntimeProfileProbe(),
    createDataBoundaryProbe(),
    createSqliteProbe(),
    createProviderProbe(),
    createNetworkProbe(),
    createSecurityProbe(),
    createResourcePressureProbe(),
    createToolAvailabilityProbe(),
    createMediaWorkerProbe(),
    createDeferredWorkerProbe(),
    createSearchIndexProbe(),
    createBackupRestoreProbe(),
  ];
}

function emptySummary(): ApplianceHealthSummary {
  return {
    healthy: 0,
    degraded: 0,
    blocked: 0,
    disabled: 0,
    unknown: 0,
  };
}

function getDefaultImpact(component: ApplianceHealthComponent): ApplianceHealthImpact {
  if (
    component === "runtime"
    || component === "data"
    || component === "sqlite"
    || component === "provider"
    || component === "network"
    || component === "security"
    || component === "resources"
  ) {
    return "required";
  }

  if (component === "backup_restore") {
    return "informational";
  }

  return "optional";
}

async function runProbeSafely(
  probe: ApplianceHealthProbe,
  context: Parameters<ApplianceHealthProbe["run"]>[0],
): Promise<ApplianceHealthProbeResult> {
  const impact = getDefaultImpact(probe.component);
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      Promise.resolve(probe.run(context)),
      new Promise<ApplianceHealthProbeResult>((resolve) => {
        timeout = setTimeout(() => {
          resolve(createProbeResult({
            component: probe.component,
            status: impact === "informational" ? "unknown" : "degraded",
            impact,
            summary: `${probe.component} health probe timed out.`,
            remediation: "Inspect subsystem responsiveness and health probe dependencies.",
            metadata: {
              timeoutMs: context.timeoutMs,
            },
            checkedAt: context.generatedAt,
            warnings: [`${probe.component} health probe exceeded ${context.timeoutMs}ms.`],
          }));
        }, context.timeoutMs);
      }),
    ]);
  } catch (error) {
    return createProbeResult({
      component: probe.component,
      status: impact === "required" ? "blocked" : "degraded",
      impact,
      summary: `${probe.component} health probe failed.`,
      remediation: error instanceof Error ? error.message : "Inspect application logs for probe failure details.",
      metadata: {},
      checkedAt: context.generatedAt,
      warnings: [error instanceof Error ? error.message : String(error)],
    });
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export function summarizeApplianceHealth(
  components: readonly ApplianceHealthProbeResult[],
): ApplianceHealthSummary {
  return components.reduce<ApplianceHealthSummary>((summary, component) => {
    summary[component.status] += 1;
    return summary;
  }, emptySummary());
}

export function aggregateApplianceHealthStatus(
  components: readonly ApplianceHealthProbeResult[],
): ApplianceHealthStatus {
  if (components.length === 0) {
    return "unknown";
  }

  if (components.some((component) => component.impact === "required" && component.status === "blocked")) {
    return "blocked";
  }

  if (components.some((component) => component.impact === "required" && (
    component.status === "degraded" || component.status === "unknown"
  ))) {
    return "degraded";
  }

  if (components.some((component) => component.impact === "optional" && component.status === "degraded")) {
    return "degraded";
  }

  return "healthy";
}

export async function getApplianceHealthReport(
  options: ApplianceHealthReportOptions = {},
): Promise<ApplianceHealthReport> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const profile = getApplianceRuntimeProfile();
  const dataBoundary = getApplianceDataBoundary();
  const providerDiagnostics = options.providerDiagnostics ?? getProviderDiagnosticsReportSync();
  const probes = options.probes ?? createDefaultApplianceHealthProbes();
  const context = {
    generatedAt,
    profile,
    dataBoundary,
    providerDiagnostics,
    timeoutMs: options.timeoutMs ?? DEFAULT_APPLIANCE_HEALTH_TIMEOUT_MS,
  };
  const components = await Promise.all(probes.map((probe) => runProbeSafely(probe, context)));
  const warnings = components.flatMap((component) => component.warnings);

  return {
    status: aggregateApplianceHealthStatus(components),
    generatedAt,
    profile,
    dataBoundary,
    providerDiagnostics,
    components,
    summary: summarizeApplianceHealth(components),
    warnings,
  };
}
