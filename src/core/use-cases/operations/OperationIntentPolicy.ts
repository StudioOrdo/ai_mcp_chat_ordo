import {
  isOperationKind,
  isOperationRiskLevel,
  type OperationKind,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";
import {
  createDefaultOperationKindRegistry,
  type OperationKindRegistry,
} from "@/core/use-cases/operations/OperationKindRegistry";
import type {
  OperationGateFact,
  OperationGateSnapshot,
  OperationIntentOperationOutput,
} from "@/core/use-cases/operations/OperationIntent";

export const OPERATION_INTENT_HIGH_CONFIDENCE_THRESHOLD = 0.8;
export const OPERATION_INTENT_LOW_CONFIDENCE_THRESHOLD = 0.5;

export interface OperationIntentRoleDecision {
  allowed: boolean;
  message?: string;
}

export class OperationIntentPolicy {
  constructor(
    private readonly kindRegistry: OperationKindRegistry = createDefaultOperationKindRegistry(),
  ) {}

  authorizeKind(kind: OperationKind, role: RoleName): OperationIntentRoleDecision {
    const definition = this.kindRegistry.require(kind);
    if (definition.allowedRoles.includes(role)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      message: `${definition.label} is restricted to ${definition.allowedRoles.join(", ")} users.`,
    };
  }

  shouldPassThroughLowConfidence(intent: OperationIntentOperationOutput): boolean {
    return intent.confidence < OPERATION_INTENT_LOW_CONFIDENCE_THRESHOLD
      && intent.riskLevel !== "destructive";
  }

  shouldClarifyLowConfidenceDestructive(intent: OperationIntentOperationOutput): boolean {
    return intent.confidence < OPERATION_INTENT_HIGH_CONFIDENCE_THRESHOLD
      && intent.riskLevel === "destructive";
  }

  findMissingCapabilities(
    intent: OperationIntentOperationOutput,
    availableToolNames: readonly string[],
  ): OperationGateFact[] {
    const available = new Set(availableToolNames);
    return intent.requiredCapabilities
      .filter((capability) => !available.has(capability))
      .map((capability): OperationGateFact => ({
        id: `tool:${capability}`,
        state: "blocked",
        summary: `Required tool "${capability}" is unavailable for this request.`,
        remediation: "Enable the tool in admin settings or complete the operation migration before retrying.",
        affectedCapabilities: [capability],
        affectedOperationKinds: [intent.operationKind],
        source: "tool_availability",
      }));
  }

  findMissingProviderSlots(
    intent: OperationIntentOperationOutput,
    providerCapabilitySummary: Record<string, unknown>,
  ): OperationGateFact[] {
    if (intent.requiredProviderSlots.length === 0) {
      return [];
    }

    const tools = readProviderBackedTools(providerCapabilitySummary);
    return intent.requiredProviderSlots.flatMap((slot) => {
      const candidates = tools.filter((tool) => tool.slot === slot);
      const available = candidates.some((tool) => tool.state === "available");
      if (available) {
        return [];
      }

      const states = [...new Set(candidates.map((tool) => tool.state).filter((state): state is string => Boolean(state)))];
      return [{
        id: `provider:${slot}`,
        state: "blocked",
        summary: `Required provider capability "${slot}" is unavailable for this request.`,
        remediation: providerRemediation(slot, states),
        affectedOperationKinds: [intent.operationKind],
        affectedCapabilities: candidates.map((tool) => tool.name),
        source: "provider_capability",
        metadata: {
          slot,
          states,
          tools: candidates.map((tool) => tool.name),
        },
      } satisfies OperationGateFact];
    });
  }

  findBlockingGates(
    intent: OperationIntentOperationOutput,
    gateSnapshot: OperationGateSnapshot,
  ): OperationGateFact[] {
    return gateSnapshot.gates.filter((gate) => {
      if (gate.state !== "blocked") {
        return false;
      }

      const operationKinds = gate.affectedOperationKinds ?? [];
      const capabilities = gate.affectedCapabilities ?? [];

      if (operationKinds.length === 0 && capabilities.length === 0) {
        return true;
      }

      return operationKinds.includes(intent.operationKind)
        || intent.requiredCapabilities.some((capability) => capabilities.includes(capability));
    });
  }

  validateOperationIntentShape(value: unknown): OperationIntentOperationOutput | null {
    if (!isRecord(value) || value.kind !== "operation_intent") {
      return null;
    }

    if (
      typeof value.operationKind !== "string"
      || !isOperationKind(value.operationKind)
      || typeof value.intentKind !== "string"
      || !isOperationKind(value.intentKind)
      || typeof value.riskLevel !== "string"
      || !isOperationRiskLevel(value.riskLevel)
      || typeof value.title !== "string"
      || !value.title.trim()
      || typeof value.summary !== "string"
      || !value.summary.trim()
      || !isRecord(value.input)
      || typeof value.requiredRole !== "string"
      || !Array.isArray(value.requiredCapabilities)
      || !Array.isArray(value.requiredProviderSlots)
      || !Array.isArray(value.missingInputs)
      || typeof value.confidence !== "number"
      || !Number.isFinite(value.confidence)
    ) {
      return null;
    }

    return value as unknown as OperationIntentOperationOutput;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ProviderBackedToolSummary {
  name: string;
  slot: string;
  state: string | null;
}

function readProviderBackedTools(summary: Record<string, unknown>): ProviderBackedToolSummary[] {
  const raw = summary.providerBackedTools;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((item): ProviderBackedToolSummary[] => {
    if (!isRecord(item) || typeof item.name !== "string" || typeof item.slot !== "string") {
      return [];
    }

    return [{
      name: item.name,
      slot: item.slot,
      state: typeof item.state === "string" ? item.state : null,
    }];
  });
}

function providerRemediation(slot: string, states: readonly string[]): string {
  if (states.includes("missing_key")) {
    return `Configure the ${slot} provider key in admin settings or disable workflows that require ${slot}.`;
  }

  if (states.includes("disabled")) {
    return `Enable a ${slot} provider before starting this media workflow.`;
  }

  if (states.includes("unsupported")) {
    return `Select a supported ${slot} provider before starting this media workflow.`;
  }

  return `Enable a provider-backed tool for the ${slot} capability before retrying.`;
}
