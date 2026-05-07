import {
  getProviderDiagnosticsReportSync,
  summarizeProviderDiagnostics,
  type ProviderDiagnosticsReport,
} from "@/lib/ai/providers/provider-diagnostics";
import {
  createProbeResult,
  type ApplianceHealthProbe,
} from "@/lib/appliance/health-types";

export interface ProviderProbeOptions {
  getDiagnostics?: () => ProviderDiagnosticsReport;
}

export function createProviderProbe(options: ProviderProbeOptions = {}): ApplianceHealthProbe {
  const getDiagnostics = options.getDiagnostics ?? getProviderDiagnosticsReportSync;

  return {
    component: "provider",
    run(context) {
      const diagnostics = context.providerDiagnostics ?? getDiagnostics();
      const summary = summarizeProviderDiagnostics(diagnostics);
      const requiredReady = summary.requiredIntelligenceReady;
      const optionalUnavailable = summary.providerBackedToolsUnavailable > 0
        || summary.optionalCapabilitiesMissingKey > 0
        || summary.optionalCapabilitiesUnsupported > 0;
      const status = !requiredReady ? "blocked" : optionalUnavailable ? "degraded" : "healthy";

      return createProbeResult({
        component: "provider",
        impact: "required",
        status,
        checkedAt: context.generatedAt,
        summary: !requiredReady
          ? `${diagnostics.intelligence.provider} intelligence provider is not ready.`
          : optionalUnavailable
            ? "Core intelligence provider is ready; optional provider-backed capabilities are degraded."
            : "Provider configuration is ready.",
        remediation: !requiredReady
          ? "Configure the selected intelligence provider API key and model."
          : optionalUnavailable
            ? "Configure or disable optional provider-backed capabilities."
            : null,
        metadata: {
          provider: diagnostics.intelligence.provider,
          model: diagnostics.intelligence.model,
          apiKeyConfigured: diagnostics.intelligence.apiKeyConfigured,
          optionalCapabilitiesAvailable: summary.optionalCapabilitiesAvailable,
          optionalCapabilitiesDisabled: summary.optionalCapabilitiesDisabled,
          optionalCapabilitiesMissingKey: summary.optionalCapabilitiesMissingKey,
          optionalCapabilitiesUnsupported: summary.optionalCapabilitiesUnsupported,
          providerBackedToolsUnavailable: summary.providerBackedToolsUnavailable,
          toolSummary: diagnostics.toolSummary,
        },
        warnings: diagnostics.intelligence.warningCodes,
      });
    },
  };
}

