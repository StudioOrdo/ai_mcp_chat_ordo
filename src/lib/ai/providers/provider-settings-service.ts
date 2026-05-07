import { ConfigurationService } from "@/lib/config/ConfigurationService";

import {
  CAPABILITY_PROVIDER_CATALOG,
  INTELLIGENCE_PROVIDER_CATALOG,
  OPENAI_API_KEY_SETTING,
  isCapabilityProviderSupported,
  isIntelligenceProviderId,
} from "./provider-catalog";
import { ProviderConfigService } from "./provider-config-service";
import { redactSecretField } from "./provider-redaction";
import {
  providerValidationService,
  toProviderValidationHttpMessage,
  type ProviderValidationFailure,
  type ProviderValidationService,
} from "./provider-validation-service";
import type {
  CapabilityProviderId,
  CapabilitySlotId,
  IntelligenceProviderId,
  RedactedSecretField,
  RedactedProviderConfigSnapshot,
  ResolvedConfigField,
  ResolvedIntelligenceProviderConfig,
} from "./types";

export type ProviderSettingsErrorCode =
  | "invalid_request"
  | "missing_key"
  | "invalid_provider"
  | "env_locked"
  | "validation_failed";

export interface ProviderSettingsError {
  code: ProviderSettingsErrorCode;
  message: string;
  status: number;
}

export interface CapabilitySettingsInput {
  provider: CapabilityProviderId;
  model?: string | null;
}

export type CapabilitySettingsInputMap = Record<CapabilitySlotId, CapabilitySettingsInput>;

export interface ProviderSettingsUpdateInput {
  intelligence: {
    provider: IntelligenceProviderId;
    apiKey?: string | null;
    model: string;
    baseUrl?: string | null;
  };
  openAiKey?: string | null;
  capabilities: CapabilitySettingsInputMap;
}

export interface ProviderSettingsApplyResult {
  ok: true;
  snapshot: RedactedProviderConfigSnapshot;
  warnings: string[];
}

export interface ProviderSettingsFailure {
  ok: false;
  error: ProviderSettingsError;
}

export type ProviderSettingsResult =
  | ProviderSettingsApplyResult
  | ProviderSettingsFailure;

interface PreparedProviderSettingsResult {
  ok: true;
  value: PreparedProviderSettings;
}

interface ProviderFieldDto<T> extends ResolvedConfigField<T> {
  locked: boolean;
}

export interface ProviderSettingsDto extends RedactedProviderConfigSnapshot {
  intelligence: RedactedProviderConfigSnapshot["intelligence"] & {
    provider: ProviderFieldDto<IntelligenceProviderId>;
    model: ProviderFieldDto<string>;
    baseUrl: ProviderFieldDto<string | null>;
  };
  openAiKey: RedactedSecretField & {
    locked: boolean;
  };
  capabilities: {
    [Slot in CapabilitySlotId]: RedactedProviderConfigSnapshot["capabilities"][Slot] & {
      provider: ProviderFieldDto<CapabilityProviderId>;
      model: ProviderFieldDto<string | null>;
    };
  };
  catalog: {
    intelligenceProviders: Array<{
      id: IntelligenceProviderId;
      label: string;
      defaultModel: string;
      defaultBaseUrl: string | null;
      modelCandidates: string[];
    }>;
    capabilities: Record<CapabilitySlotId, {
      supportedProviders: CapabilityProviderId[];
      defaultModel: string | null;
    }>;
  };
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function error(
  code: ProviderSettingsErrorCode,
  message: string,
  status = 400,
): ProviderSettingsFailure {
  return {
    ok: false,
    error: { code, message, status },
  };
}

export function isProviderSettingsFailure(value: unknown): value is ProviderSettingsFailure {
  return isRecord(value)
    && value.ok === false
    && isRecord(value.error)
    && typeof value.error.message === "string"
    && typeof value.error.status === "number";
}

function lockField<T>(field: ResolvedConfigField<T>): ProviderFieldDto<T> {
  return {
    ...field,
    locked: field.source === "env" || field.source === "file",
  };
}

function assertEnvUnlocked<T>(
  field: ResolvedConfigField<T>,
  label: string,
  submitted: T,
): ProviderSettingsFailure | null {
  if (field.source !== "env" && field.source !== "file") {
    return null;
  }
  if (Object.is(field.value, submitted)) {
    return null;
  }
  return error(
    "env_locked",
    `${label} is controlled by operator ${field.source === "file" ? "secret file" : "environment variable"} ${field.key}.`,
    409,
  );
}

function validationError(result: ProviderValidationFailure): ProviderSettingsFailure {
  return error("validation_failed", toProviderValidationHttpMessage(result), 400);
}

function getCapabilitySlots(): CapabilitySlotId[] {
  return ProviderConfigService.getCapabilitySlots();
}

function defaultCapabilityInput(slot: CapabilitySlotId): CapabilitySettingsInput {
  const config = ProviderConfigService.resolveCapabilityProviderConfig(slot);
  return {
    provider: config.provider.value,
    model: config.model.value,
  };
}

function parseCapability(
  slot: CapabilitySlotId,
  raw: unknown,
): CapabilitySettingsInput | ProviderSettingsFailure {
  if (!isRecord(raw)) {
    return error("invalid_request", `${slot} capability settings must be an object.`);
  }
  const entry = CAPABILITY_PROVIDER_CATALOG[slot];
  const provider = typeof raw.provider === "string" ? raw.provider : "";
  if (!isCapabilityProviderSupported(entry, provider)) {
    return error("invalid_provider", `Unsupported ${slot} provider "${provider}".`);
  }
  return {
    provider,
    model: normalizeOptionalString(raw.model),
  };
}

export function parseProviderSettingsUpdateInput(body: unknown): ProviderSettingsUpdateInput | ProviderSettingsFailure {
  if (!isRecord(body)) {
    return error("invalid_request", "Request body must be an object.");
  }

  const rawIntelligence = body.intelligence;
  if (!isRecord(rawIntelligence)) {
    return error("invalid_request", "intelligence settings are required.");
  }

  const provider = typeof rawIntelligence.provider === "string"
    ? rawIntelligence.provider
    : "";
  if (!isIntelligenceProviderId(provider)) {
    return error("invalid_provider", `Unsupported intelligence provider "${provider}".`);
  }

  const entry = INTELLIGENCE_PROVIDER_CATALOG[provider];
  const rawCapabilities = isRecord(body.capabilities) ? body.capabilities : {};
  const capabilities = {} as CapabilitySettingsInputMap;
  for (const slot of getCapabilitySlots()) {
    const parsed = rawCapabilities[slot] === undefined
      ? defaultCapabilityInput(slot)
      : parseCapability(slot, rawCapabilities[slot]);
    if (isProviderSettingsFailure(parsed)) {
      return parsed;
    }
    capabilities[slot] = parsed;
  }

  return {
    intelligence: {
      provider,
      apiKey: normalizeOptionalString(rawIntelligence.apiKey),
      model: normalizeOptionalString(rawIntelligence.model) ?? entry.defaultModel,
      baseUrl: normalizeOptionalString(rawIntelligence.baseUrl),
    },
    openAiKey: normalizeOptionalString(body.openAiKey),
    capabilities,
  };
}

export function parseLegacyProviderSettingsInput(body: unknown): ProviderSettingsUpdateInput | null {
  if (!isRecord(body) || isRecord(body.intelligence)) {
    return null;
  }
  const anthropicKey = normalizeOptionalString(body.anthropicKey);
  const openAiKey = normalizeOptionalString(body.openAiKey);
  if (!anthropicKey && !openAiKey) {
    return null;
  }
  const anthropicConfig = ProviderConfigService.resolveAnthropicProviderConfig();
  return {
    intelligence: {
      provider: "anthropic",
      apiKey: anthropicKey,
      model: anthropicConfig.model.value,
      baseUrl: anthropicConfig.baseUrl.value,
    },
    openAiKey,
    capabilities: {
      image: defaultCapabilityInput("image"),
      tts: defaultCapabilityInput("tts"),
      stt: defaultCapabilityInput("stt"),
      web_search: defaultCapabilityInput("web_search"),
    },
  };
}

export class ProviderSettingsService {
  constructor(
    private readonly validation: Pick<ProviderValidationService, "validateIntelligenceProvider" | "validateOpenAiProvider"> = providerValidationService,
  ) {}

  getSettingsDto(): ProviderSettingsDto {
    const snapshot = ProviderConfigService.resolveRedactedProviderConfigSnapshot();
    const openAiKey = ProviderConfigService.resolveOpenAiApiKey();
    return {
      ...snapshot,
      intelligence: {
        ...snapshot.intelligence,
        provider: lockField(snapshot.intelligence.provider),
        model: lockField(snapshot.intelligence.model),
        baseUrl: lockField(snapshot.intelligence.baseUrl),
      },
      openAiKey: {
        ...redactSecretField(openAiKey),
        locked: openAiKey.source === "env" || openAiKey.source === "file",
      },
      capabilities: {
        image: this.decorateCapability(snapshot.capabilities.image),
        tts: this.decorateCapability(snapshot.capabilities.tts),
        stt: this.decorateCapability(snapshot.capabilities.stt),
        web_search: this.decorateCapability(snapshot.capabilities.web_search),
      },
      catalog: {
        intelligenceProviders: Object.values(INTELLIGENCE_PROVIDER_CATALOG).map((entry) => ({
          id: entry.id,
          label: entry.label,
          defaultModel: entry.defaultModel,
          defaultBaseUrl: entry.defaultBaseUrl,
          modelCandidates: [...entry.modelCandidates],
        })),
        capabilities: {
          image: this.capabilityCatalogDto("image"),
          tts: this.capabilityCatalogDto("tts"),
          stt: this.capabilityCatalogDto("stt"),
          web_search: this.capabilityCatalogDto("web_search"),
        },
      },
    };
  }

  async validateSettings(input: ProviderSettingsUpdateInput): Promise<ProviderSettingsResult> {
    const prepared = this.prepareInput(input, { requireSubmittedKey: false });
    if (!prepared.ok) {
      return prepared;
    }
    const validation = await this.validatePreparedInput(prepared.value);
    if (!validation.ok) {
      return validation;
    }
    return {
      ok: true,
      snapshot: ProviderConfigService.resolveRedactedProviderConfigSnapshot(),
      warnings: [],
    };
  }

  async validateInstallSettings(input: ProviderSettingsUpdateInput): Promise<ProviderSettingsResult> {
    const prepared = this.prepareInput(input, { requireSubmittedKey: true });
    if (!prepared.ok) {
      return prepared;
    }
    const validation = await this.validatePreparedInput(prepared.value);
    if (!validation.ok) {
      return validation;
    }
    return {
      ok: true,
      snapshot: ProviderConfigService.resolveRedactedProviderConfigSnapshot(),
      warnings: [],
    };
  }

  async applySettings(input: ProviderSettingsUpdateInput): Promise<ProviderSettingsResult> {
    const prepared = this.prepareInput(input, { requireSubmittedKey: false });
    if (!prepared.ok) {
      return prepared;
    }
    const validation = await this.validatePreparedInput(prepared.value);
    if (!validation.ok) {
      return validation;
    }
    await this.persist(prepared.value);
    return {
      ok: true,
      snapshot: ProviderConfigService.resolveRedactedProviderConfigSnapshot(),
      warnings: [],
    };
  }

  async applyInstallSettings(input: ProviderSettingsUpdateInput): Promise<ProviderSettingsResult> {
    const prepared = this.prepareInput(input, { requireSubmittedKey: true });
    if (!prepared.ok) {
      return prepared;
    }
    const validation = await this.validatePreparedInput(prepared.value);
    if (!validation.ok) {
      return validation;
    }
    await this.persist(prepared.value);
    return {
      ok: true,
      snapshot: ProviderConfigService.resolveRedactedProviderConfigSnapshot(),
      warnings: [],
    };
  }

  private decorateCapability(
    config: RedactedProviderConfigSnapshot["capabilities"][CapabilitySlotId],
  ): ProviderSettingsDto["capabilities"][CapabilitySlotId] {
    return {
      ...config,
      provider: lockField(config.provider),
      model: lockField(config.model),
    };
  }

  private capabilityCatalogDto(slot: CapabilitySlotId): {
    supportedProviders: CapabilityProviderId[];
    defaultModel: string | null;
  } {
    const entry = CAPABILITY_PROVIDER_CATALOG[slot];
    return {
      supportedProviders: [...entry.supportedProviders],
      defaultModel: entry.defaultModel,
    };
  }

  private prepareInput(
    input: ProviderSettingsUpdateInput,
    options: { requireSubmittedKey: boolean },
  ): ProviderSettingsFailure | PreparedProviderSettingsResult {
    const config = ProviderConfigService.resolveIntelligenceProviderConfig(input.intelligence.provider, {
      key: "AI_PROVIDER",
      value: input.intelligence.provider,
      source: "default",
    });
    const currentSelected = ProviderConfigService.resolveSelectedIntelligenceProviderConfig();
    const openAiKey = normalizeOptionalString(input.openAiKey)
      ?? ProviderConfigService.resolveOpenAiApiKey().value;
    const intelligenceApiKey = normalizeOptionalString(input.intelligence.apiKey)
      ?? config.apiKey.value;
    const model = normalizeOptionalString(input.intelligence.model) ?? config.model.value;
    const baseUrl = normalizeOptionalString(input.intelligence.baseUrl);

    const providerLock = assertEnvUnlocked(currentSelected.provider, "Intelligence provider", input.intelligence.provider);
    if (providerLock) {
      return providerLock;
    }
    const modelLock = assertEnvUnlocked(config.model, "Intelligence model", model);
    if (modelLock) {
      return modelLock;
    }
    const baseUrlLock = assertEnvUnlocked(config.baseUrl, "Intelligence base URL", baseUrl);
    if (baseUrlLock) {
      return baseUrlLock;
    }
    if (
      normalizeOptionalString(input.intelligence.apiKey)
      && (config.apiKey.source === "env" || config.apiKey.source === "file")
    ) {
      return error("env_locked", `${config.apiKey.key} is controlled by operator configuration.`, 409);
    }
    if (
      normalizeOptionalString(input.openAiKey)
      && ["env", "file"].includes(ProviderConfigService.resolveOpenAiApiKey().source)
    ) {
      return error("env_locked", `${OPENAI_API_KEY_SETTING.primary} is controlled by operator configuration.`, 409);
    }
    if (options.requireSubmittedKey && !normalizeOptionalString(input.intelligence.apiKey)) {
      return error("missing_key", `${input.intelligence.provider} API key is required.`, 400);
    }
    if (!intelligenceApiKey) {
      return error("missing_key", `${input.intelligence.provider} API key is required.`, 400);
    }

    for (const slot of getCapabilitySlots()) {
      const capabilityConfig = ProviderConfigService.resolveCapabilityProviderConfig(slot);
      const submitted = input.capabilities[slot];
      const providerLock = assertEnvUnlocked(
        capabilityConfig.provider,
        `${slot} provider`,
        submitted.provider,
      );
      if (providerLock) {
        return providerLock;
      }
      const modelLock = assertEnvUnlocked(
        capabilityConfig.model,
        `${slot} model`,
        normalizeOptionalString(submitted.model),
      );
      if (modelLock) {
        return modelLock;
      }
      if (submitted.provider === "openai" && !openAiKey) {
        return error(
          "missing_key",
          `${slot} uses OpenAI and requires an OpenAI API key.`,
          400,
        );
      }
    }

    return {
      ok: true,
      value: {
        provider: input.intelligence.provider,
        apiKey: intelligenceApiKey,
        submittedApiKey: normalizeOptionalString(input.intelligence.apiKey),
        model,
        baseUrl,
        openAiKey,
        submittedOpenAiKey: normalizeOptionalString(input.openAiKey),
        capabilities: input.capabilities,
        config,
      },
    };
  }

  private async validatePreparedInput(
    input: PreparedProviderSettings,
  ): Promise<ProviderSettingsResult> {
    const intelligence = await this.validation.validateIntelligenceProvider({
      provider: input.provider,
      apiKey: input.apiKey,
      model: input.model,
      baseUrl: input.baseUrl,
    });
    if (!intelligence.ok) {
      return validationError(intelligence);
    }

    const openAiRequired = Object.values(input.capabilities)
      .some((capability) => capability.provider === "openai");
    if (input.submittedOpenAiKey || openAiRequired) {
      const openAi = await this.validation.validateOpenAiProvider({
        apiKey: input.openAiKey,
      });
      if (!openAi.ok) {
        return validationError(openAi);
      }
    }

    return {
      ok: true,
      snapshot: ProviderConfigService.resolveRedactedProviderConfigSnapshot(),
      warnings: [],
    };
  }

  private async persist(input: PreparedProviderSettings): Promise<void> {
    const entry = INTELLIGENCE_PROVIDER_CATALOG[input.provider];
    ConfigurationService.setString("AI_PROVIDER", input.provider);
    if (input.submittedApiKey) {
      ConfigurationService.setString(entry.apiKey.primary, input.submittedApiKey);
    }
    ConfigurationService.setString(entry.modelKey, input.model);
    if (input.baseUrl) {
      ConfigurationService.setString(entry.baseUrlKey, input.baseUrl);
    } else {
      await ConfigurationService.deleteString(entry.baseUrlKey);
    }

    if (input.submittedOpenAiKey) {
      ConfigurationService.setString(OPENAI_API_KEY_SETTING.primary, input.submittedOpenAiKey);
    }

    for (const slot of getCapabilitySlots()) {
      const entry = CAPABILITY_PROVIDER_CATALOG[slot];
      const submitted = input.capabilities[slot];
      ConfigurationService.setString(entry.providerKey, submitted.provider);
      const model = normalizeOptionalString(submitted.model);
      if (model && submitted.provider !== "disabled") {
        ConfigurationService.setString(entry.modelKey, model);
      } else {
        await ConfigurationService.deleteString(entry.modelKey);
      }
    }
  }
}

interface PreparedProviderSettings {
  provider: IntelligenceProviderId;
  apiKey: string;
  submittedApiKey: string | null;
  model: string;
  baseUrl: string | null;
  openAiKey: string | null;
  submittedOpenAiKey: string | null;
  capabilities: CapabilitySettingsInputMap;
  config: ResolvedIntelligenceProviderConfig;
}

export const providerSettingsService = new ProviderSettingsService();
