import { CAPABILITY_SLOT_IDS } from "./provider-catalog";
import { ProviderConfigService } from "./provider-config-service";
import type {
  CapabilityProviderId,
  CapabilitySlotId,
  ProviderConfigSource,
} from "./types";

export type ProviderCapabilityAvailabilityState =
  | "available"
  | "disabled"
  | "missing_key"
  | "unsupported";

export type ProviderCapabilityAvailabilityReason =
  | "provider_configured"
  | "provider_disabled"
  | "missing_required_key"
  | "unsupported_provider";

export interface ProviderCapabilityAvailability {
  slot: CapabilitySlotId;
  provider: CapabilityProviderId;
  state: ProviderCapabilityAvailabilityState;
  reason: ProviderCapabilityAvailabilityReason;
  model: string | null;
  requiredKeyConfigured: boolean | null;
  requiredKeySource: ProviderConfigSource | null;
}

export type ProviderCapabilityAvailabilitySnapshot = Record<
  CapabilitySlotId,
  ProviderCapabilityAvailability
>;

export class ProviderCapabilityUnavailableError extends Error {
  readonly name = "ProviderCapabilityUnavailableError";

  constructor(
    readonly availability: ProviderCapabilityAvailability,
    message = buildUnavailableMessage(availability),
  ) {
    super(message);
  }
}

export function isProviderCapabilityUnavailableError(
  error: unknown,
): error is ProviderCapabilityUnavailableError {
  return error instanceof ProviderCapabilityUnavailableError;
}

function buildUnavailableMessage(
  availability: ProviderCapabilityAvailability,
): string {
  if (availability.state === "missing_key") {
    return `${availability.slot} capability is configured for ${availability.provider}, but its required key is missing.`;
  }

  if (availability.state === "disabled") {
    return `${availability.slot} capability is disabled. Enable ${availability.slot.toUpperCase()}_PROVIDER or use an existing asset.`;
  }

  return `${availability.slot} capability provider ${availability.provider} is unsupported.`;
}

function toAvailability(
  slot: CapabilitySlotId,
): ProviderCapabilityAvailability {
  const config = ProviderConfigService.resolveCapabilityProviderConfig(slot);
  const provider = config.provider.value;

  if (provider === "disabled") {
    return {
      slot,
      provider,
      state: "disabled",
      reason: "provider_disabled",
      model: config.model.value,
      requiredKeyConfigured: null,
      requiredKeySource: null,
    };
  }

  if (config.requiredKey && !config.requiredKey.configured) {
    return {
      slot,
      provider,
      state: "missing_key",
      reason: "missing_required_key",
      model: config.model.value,
      requiredKeyConfigured: false,
      requiredKeySource: config.requiredKey.source,
    };
  }

  return {
    slot,
    provider,
    state: "available",
    reason: "provider_configured",
    model: config.model.value,
    requiredKeyConfigured: config.requiredKey?.configured ?? null,
    requiredKeySource: config.requiredKey?.source ?? null,
  };
}

export class ProviderCapabilityAvailabilityService {
  getCapabilityAvailabilitySnapshot(): ProviderCapabilityAvailabilitySnapshot {
    return Object.fromEntries(
      CAPABILITY_SLOT_IDS.map((slot) => [slot, this.getCapabilityAvailability(slot)]),
    ) as ProviderCapabilityAvailabilitySnapshot;
  }

  getCapabilityAvailability(slot: CapabilitySlotId): ProviderCapabilityAvailability {
    return toAvailability(slot);
  }
}

export function getProviderCapabilityAvailabilitySnapshot(): ProviderCapabilityAvailabilitySnapshot {
  return new ProviderCapabilityAvailabilityService().getCapabilityAvailabilitySnapshot();
}
