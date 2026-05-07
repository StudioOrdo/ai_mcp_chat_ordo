import type { ApplianceDataBoundary } from "@/lib/appliance/data-boundary";
import type { ApplianceRuntimeProfile } from "@/lib/appliance/runtime-profile";
import type { ProviderDiagnosticsReport } from "@/lib/ai/providers/provider-diagnostics";

export type ApplianceHealthStatus =
  | "healthy"
  | "degraded"
  | "blocked"
  | "disabled"
  | "unknown";

export type ApplianceHealthImpact = "required" | "optional" | "informational";

export type ApplianceHealthComponent =
  | "runtime"
  | "data"
  | "sqlite"
  | "provider"
  | "network"
  | "security"
  | "resources"
  | "tools"
  | "media_worker"
  | "deferred_worker"
  | "search"
  | "backup_restore";

export interface ApplianceHealthProbeResult {
  component: ApplianceHealthComponent;
  status: ApplianceHealthStatus;
  impact: ApplianceHealthImpact;
  summary: string;
  remediation: string | null;
  metadata: Record<string, unknown>;
  checkedAt: string;
  warnings: string[];
}

export interface ApplianceHealthSummary {
  healthy: number;
  degraded: number;
  blocked: number;
  disabled: number;
  unknown: number;
}

export interface ApplianceHealthReport {
  status: ApplianceHealthStatus;
  generatedAt: string;
  profile: ApplianceRuntimeProfile;
  dataBoundary: ApplianceDataBoundary;
  providerDiagnostics: ProviderDiagnosticsReport;
  components: ApplianceHealthProbeResult[];
  summary: ApplianceHealthSummary;
  warnings: string[];
}

export interface ApplianceHealthContext {
  generatedAt: string;
  profile: ApplianceRuntimeProfile;
  dataBoundary: ApplianceDataBoundary;
  providerDiagnostics?: ProviderDiagnosticsReport;
  timeoutMs: number;
}

export interface ApplianceHealthProbe {
  component: ApplianceHealthComponent;
  run(context: ApplianceHealthContext): Promise<ApplianceHealthProbeResult> | ApplianceHealthProbeResult;
}

export function createProbeResult(params: {
  component: ApplianceHealthComponent;
  status: ApplianceHealthStatus;
  impact: ApplianceHealthImpact;
  summary: string;
  remediation?: string | null;
  metadata?: Record<string, unknown>;
  checkedAt: string;
  warnings?: string[];
}): ApplianceHealthProbeResult {
  return {
    component: params.component,
    status: params.status,
    impact: params.impact,
    summary: params.summary,
    remediation: params.remediation ?? null,
    metadata: params.metadata ?? {},
    checkedAt: params.checkedAt,
    warnings: params.warnings ?? [],
  };
}
