import type {
  ProviderCapabilityAvailability,
  ProviderCapabilityAvailabilitySnapshot,
} from "./provider-capability-availability";
import { ProviderCapabilityAvailabilityService } from "./provider-capability-availability";
import { ProviderConfigService } from "./provider-config-service";
import type {
  CapabilitySlotId,
  ProviderConfigSource,
} from "./types";
import {
  getProviderBackedToolNames,
  getToolProviderCapabilityRequirement,
} from "@/lib/tools/tool-provider-capability-policy";
import { getToolAvailabilityService } from "@/lib/tools/tool-availability-service";
import type {
  EffectiveToolManifest,
  ToolAvailabilityState,
} from "@/lib/tools/tool-policy-types";

export interface ProviderDiagnosticsIntelligence {
  provider: string;
  providerSource: ProviderConfigSource;
  model: string;
  modelSource: ProviderConfigSource;
  apiKeyConfigured: boolean;
  apiKeySource: ProviderConfigSource;
  baseUrlConfigured: boolean;
  baseUrlSource: ProviderConfigSource;
  warningCodes: string[];
}

export interface ProviderDiagnosticsCapability {
  slot: CapabilitySlotId;
  provider: ProviderCapabilityAvailability["provider"];
  state: ProviderCapabilityAvailability["state"];
  reason: ProviderCapabilityAvailability["reason"];
  model: string | null;
  requiredKeyConfigured: boolean | null;
  requiredKeySource: ProviderConfigSource | null;
  impactedTools: string[];
}

export interface ProviderDiagnosticsToolSummary {
  total: number;
  byState: Partial<Record<ToolAvailabilityState, number>>;
  protectedCount: number;
  staticLockedCount: number;
  providerGatedCount: number;
  warnings: number;
}

export interface ProviderDiagnosticsReport {
  intelligence: ProviderDiagnosticsIntelligence;
  capabilities: ProviderDiagnosticsCapability[];
  toolSummary: ProviderDiagnosticsToolSummary;
}

export interface ProviderDiagnosticsSummary {
  requiredIntelligenceReady: boolean;
  optionalCapabilitiesAvailable: number;
  optionalCapabilitiesDisabled: number;
  optionalCapabilitiesMissingKey: number;
  optionalCapabilitiesUnsupported: number;
  providerBackedToolsUnavailable: number;
}

function buildImpactedToolsBySlot(): Record<CapabilitySlotId, string[]> {
  const bySlot: Record<CapabilitySlotId, string[]> = {
    image: [],
    tts: [],
    stt: [],
    web_search: [],
  };

  for (const toolName of getProviderBackedToolNames()) {
    const requirement = getToolProviderCapabilityRequirement(toolName);
    if (requirement) {
      bySlot[requirement.slot].push(toolName);
    }
  }

  return bySlot;
}

function buildIntelligence(): ProviderDiagnosticsIntelligence {
  const snapshot = ProviderConfigService.resolveRedactedProviderConfigSnapshot();
  const intelligence = snapshot.intelligence;
  return {
    provider: intelligence.provider.value,
    providerSource: intelligence.provider.source,
    model: intelligence.model.value,
    modelSource: intelligence.model.source,
    apiKeyConfigured: intelligence.apiKey.configured,
    apiKeySource: intelligence.apiKey.source,
    baseUrlConfigured: intelligence.baseUrl.value !== null,
    baseUrlSource: intelligence.baseUrl.source,
    warningCodes: intelligence.warnings.map((warning) => warning.code),
  };
}

function buildCapabilities(
  snapshot: ProviderCapabilityAvailabilitySnapshot,
): ProviderDiagnosticsCapability[] {
  const impactedToolsBySlot = buildImpactedToolsBySlot();
  return (Object.keys(snapshot) as CapabilitySlotId[])
    .sort()
    .map((slot) => {
      const availability = snapshot[slot];
      return {
        slot,
        provider: availability.provider,
        state: availability.state,
        reason: availability.reason,
        model: availability.model,
        requiredKeyConfigured: availability.requiredKeyConfigured,
        requiredKeySource: availability.requiredKeySource,
        impactedTools: [...impactedToolsBySlot[slot]].sort(),
      };
    });
}

function buildToolSummary(manifest: EffectiveToolManifest): ProviderDiagnosticsToolSummary {
  const byState = manifest.tools.reduce<Partial<Record<ToolAvailabilityState, number>>>((counts, tool) => {
    counts[tool.state] = (counts[tool.state] ?? 0) + 1;
    return counts;
  }, {});

  return {
    total: manifest.tools.length,
    byState,
    protectedCount: manifest.tools.filter((tool) => tool.protected).length,
    staticLockedCount: manifest.tools.filter((tool) => tool.staticLocked).length,
    providerGatedCount: manifest.tools.filter((tool) => tool.providerCapabilitySlot !== null).length,
    warnings: manifest.warnings.length,
  };
}

function buildReport(manifest: EffectiveToolManifest): ProviderDiagnosticsReport {
  const capabilityAvailability = new ProviderCapabilityAvailabilityService()
    .getCapabilityAvailabilitySnapshot();

  return {
    intelligence: buildIntelligence(),
    capabilities: buildCapabilities(capabilityAvailability),
    toolSummary: buildToolSummary(manifest),
  };
}

export async function getProviderDiagnosticsReport(): Promise<ProviderDiagnosticsReport> {
  const manifest = await getToolAvailabilityService().getEffectiveManifestFromSettings();
  return buildReport(manifest);
}

export function getProviderDiagnosticsReportSync(): ProviderDiagnosticsReport {
  const manifest = getToolAvailabilityService().getEffectiveManifestSync();
  return buildReport(manifest);
}

export function summarizeProviderDiagnostics(
  report: ProviderDiagnosticsReport,
): ProviderDiagnosticsSummary {
  return {
    requiredIntelligenceReady:
      report.intelligence.apiKeyConfigured && report.intelligence.model.trim().length > 0,
    optionalCapabilitiesAvailable: report.capabilities.filter((capability) => capability.state === "available").length,
    optionalCapabilitiesDisabled: report.capabilities.filter((capability) => capability.state === "disabled").length,
    optionalCapabilitiesMissingKey: report.capabilities.filter((capability) => capability.state === "missing_key").length,
    optionalCapabilitiesUnsupported: report.capabilities.filter((capability) => capability.state === "unsupported").length,
    providerBackedToolsUnavailable:
      (report.toolSummary.byState.missing_provider_key ?? 0)
      + (report.toolSummary.byState.provider_disabled ?? 0),
  };
}
