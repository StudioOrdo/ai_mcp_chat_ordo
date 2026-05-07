import type { ProviderDiagnosticsReport } from "@/lib/ai/providers/provider-diagnostics";
import { getProviderDiagnosticsReportSync } from "@/lib/ai/providers/provider-diagnostics";
import {
  createProbeResult,
  type ApplianceHealthProbe,
} from "@/lib/appliance/health-types";

export interface ToolAvailabilityProbeOptions {
  getDiagnostics?: () => ProviderDiagnosticsReport;
}

export function createToolAvailabilityProbe(
  options: ToolAvailabilityProbeOptions = {},
): ApplianceHealthProbe {
  const getDiagnostics = options.getDiagnostics ?? getProviderDiagnosticsReportSync;

  return {
    component: "tools",
    run(context) {
      const diagnostics = context.providerDiagnostics ?? getDiagnostics();
      const unavailable = (diagnostics.toolSummary.byState.missing_provider_key ?? 0)
        + (diagnostics.toolSummary.byState.provider_disabled ?? 0);
      const warnings = diagnostics.toolSummary.warnings;
      const status = unavailable > 0 || warnings > 0 ? "degraded" : "healthy";

      return createProbeResult({
        component: "tools",
        impact: "optional",
        status,
        checkedAt: context.generatedAt,
        summary: status === "healthy"
          ? "Tool availability policy is healthy."
          : "Some tools are unavailable through provider or policy configuration.",
        remediation: status === "healthy"
          ? null
          : "Review provider capability keys and admin tool availability settings.",
        metadata: {
          total: diagnostics.toolSummary.total,
          byState: diagnostics.toolSummary.byState,
          protectedCount: diagnostics.toolSummary.protectedCount,
          staticLockedCount: diagnostics.toolSummary.staticLockedCount,
          providerGatedCount: diagnostics.toolSummary.providerGatedCount,
          warnings,
        },
        warnings: warnings > 0 ? [`Tool availability has ${warnings} warning(s).`] : [],
      });
    },
  };
}

