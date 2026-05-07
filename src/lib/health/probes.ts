import type {
  ProviderCapabilityAvailabilityState,
} from "@/lib/ai/providers/provider-capability-availability";
import type { CapabilitySlotId } from "@/lib/ai/providers/types";
import type { ApplianceHealthReport } from "@/lib/appliance/health-types";
import { getApplianceHealthReport } from "@/lib/appliance/health-facade";

export type ProbeStatus = "ok" | "error";

export type ProbeResult = {
  status: ProbeStatus;
  checks: {
    config: ProbeStatus;
    model: ProbeStatus;
  };
  details?: string;
  intelligence?: {
    provider: string;
    model: string;
    apiKeyConfigured: boolean;
  };
  optionalCapabilities?: Array<{
    slot: CapabilitySlotId;
    provider: string;
    state: ProviderCapabilityAvailabilityState;
    impactedTools: string[];
  }>;
  warnings?: string[];
  appliance?: ApplianceHealthReport;
};

export function getLivenessProbe(): ProbeResult {
  return {
    status: "ok",
    checks: {
      config: "ok",
      model: "ok",
    },
  };
}

export async function getReadinessProbe(): Promise<ProbeResult> {
  try {
    const appliance = await getApplianceHealthReport();
    const providerComponent = appliance.components.find((component) => component.component === "provider");
    const providerDiagnostics = appliance.providerDiagnostics;
    const intelligence = providerDiagnostics?.intelligence;
    const modelConfigured = Boolean(intelligence?.model.trim());
    const apiKeyConfigured = Boolean(intelligence?.apiKeyConfigured);
    const optionalCapabilities = providerDiagnostics.capabilities.map((capability) => ({
      slot: capability.slot,
      provider: capability.provider,
      state: capability.state,
      impactedTools: capability.impactedTools,
    }));
    const warnings = providerDiagnostics.capabilities
      .filter((capability) => capability.state !== "available")
      .map((capability) => `${capability.slot} capability is ${capability.state}.`);

    if (appliance.status === "blocked") {
      return {
        status: "error",
        checks: {
          config: apiKeyConfigured ? "ok" : "error",
          model: modelConfigured ? "ok" : "error",
        },
        details: providerComponent?.summary ?? "Appliance readiness is blocked.",
        intelligence: {
          provider: intelligence?.provider ?? "unknown",
          model: intelligence?.model ?? "",
          apiKeyConfigured,
        },
        optionalCapabilities,
        warnings: [...warnings, ...appliance.warnings],
        appliance,
      };
    }

    const details = appliance.status === "degraded"
      ? "Core intelligence readiness is ok; optional capability providers are degraded."
      : null;

    return {
      status: "ok",
      checks: {
        config: "ok",
        model: "ok",
      },
      ...(details ? { details } : {}),
      intelligence: {
        provider: intelligence?.provider ?? "unknown",
        model: intelligence?.model ?? "",
        apiKeyConfigured,
      },
      optionalCapabilities,
      warnings: [...warnings, ...appliance.warnings],
      appliance,
    };
  } catch (error) {
    return {
      status: "error",
      checks: {
        config: "error",
        model: "error",
      },
      details:
        error instanceof Error ? error.message : "Readiness check failed.",
    };
  }
}
