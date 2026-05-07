import { getSystemSettingsDataMapper } from "@/adapters/RepositoryFactory";
import { resolveRuntimeSecret } from "@/lib/config/secret-source";

import {
  CAPABILITY_PROVIDER_CATALOG,
  CAPABILITY_SLOT_IDS,
  DEFAULT_AI_PROVIDER,
  INTELLIGENCE_PROVIDER_CATALOG,
  OPENAI_API_KEY_SETTING,
  isCapabilityProviderSupported,
  isIntelligenceProviderId,
  type CapabilityCatalogEntry,
  type ProviderSettingKeys,
} from "./provider-catalog";
import { redactProviderConfigSnapshot } from "./provider-redaction";
import type {
  CapabilityProviderId,
  CapabilitySlotId,
  IntelligenceProviderId,
  ProviderConfigSource,
  ProviderResolutionWarning,
  RedactedProviderConfigSnapshot,
  ResolvedCapabilityProviderConfig,
  ResolvedConfigField,
  ResolvedIntelligenceProviderConfig,
  ResolvedProviderConfigSnapshot,
  ResolvedSecretField,
} from "./types";

interface RawResolvedStringField {
  key: string;
  value: string | null;
  source: ProviderConfigSource;
  aliasOf?: string;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readEnvSecret(key: string): Pick<RawResolvedStringField, "value" | "source"> {
  const secret = resolveRuntimeSecret(key);
  return {
    value: secret.value,
    source: secret.configured && secret.source === "file" ? "file" : secret.source === "env" ? "env" : "missing",
  };
}

function parseSettingValue(valueJson: string): string | null {
  try {
    return normalizeString(JSON.parse(valueJson));
  } catch {
    return null;
  }
}

function readSqliteKey(key: string): string | null {
  try {
    const setting = getSystemSettingsDataMapper().getSync(key);
    return setting ? parseSettingValue(setting.valueJson) : null;
  } catch {
    return null;
  }
}

function sourceOrderedKeys(setting: ProviderSettingKeys): Array<{ key: string; aliasOf?: string }> {
  return [
    { key: setting.primary },
    ...setting.aliases.map((key) => ({ key, aliasOf: setting.primary })),
  ];
}

function resolveRawStringField(
  setting: ProviderSettingKeys,
  defaultValue: string | null = null,
): RawResolvedStringField {
  const keys = sourceOrderedKeys(setting);

  for (const candidate of keys) {
    const secret = readEnvSecret(candidate.key);
    if (secret.value) {
      return {
        ...candidate,
        value: secret.value,
        source: secret.source,
      };
    }
  }

  for (const candidate of keys) {
    const value = readSqliteKey(candidate.key);
    if (value) {
      return {
        ...candidate,
        value,
        source: "sqlite",
      };
    }
  }

  if (defaultValue !== null) {
    return {
      key: setting.primary,
      value: defaultValue,
      source: "default",
    };
  }

  return {
    key: setting.primary,
    value: null,
    source: "missing",
  };
}

function resolveConfigField(
  setting: ProviderSettingKeys,
  defaultValue: string,
): ResolvedConfigField<string> {
  const resolved = resolveRawStringField(setting, defaultValue);
  return {
    key: resolved.key,
    value: resolved.value ?? defaultValue,
    source: resolved.source,
    ...(resolved.aliasOf ? { aliasOf: resolved.aliasOf } : {}),
  };
}

function resolveNullableConfigField(
  setting: ProviderSettingKeys,
  defaultValue: string | null,
): ResolvedConfigField<string | null> {
  const resolved = resolveRawStringField(setting, defaultValue);
  return {
    key: resolved.key,
    value: resolved.value,
    source: resolved.source,
    ...(resolved.aliasOf ? { aliasOf: resolved.aliasOf } : {}),
  };
}

function resolveSecretField(setting: ProviderSettingKeys): ResolvedSecretField {
  const resolved = resolveRawStringField(setting);
  return {
    key: resolved.key,
    value: resolved.value,
    source: resolved.source,
    ...(resolved.aliasOf ? { aliasOf: resolved.aliasOf } : {}),
    configured: resolved.value !== null,
  };
}

function parsePositiveInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolvePositiveIntegerField(
  key: string,
  defaultValue: number,
): ResolvedConfigField<number> {
  const resolved = resolveRawStringField({ primary: key, aliases: [] });
  const parsed = parsePositiveInteger(resolved.value);
  if (parsed !== null) {
    return {
      key: resolved.key,
      value: parsed,
      source: resolved.source,
    };
  }

  return {
    key,
    value: defaultValue,
    source: "default",
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function buildModelCandidates(
  configuredModel: ResolvedConfigField<string>,
  catalogCandidates: readonly string[],
): string[] {
  return unique([configuredModel.value, ...catalogCandidates]);
}

function unknownProviderWarning(
  key: string,
  value: string,
): ProviderResolutionWarning {
  return {
    code: "unknown_intelligence_provider",
    key,
    value,
    message: `Unknown intelligence provider "${value}". Falling back to ${DEFAULT_AI_PROVIDER}.`,
  };
}

function unknownCapabilityProviderWarning(
  key: string,
  value: string,
  slot: CapabilitySlotId,
): ProviderResolutionWarning {
  return {
    code: "unknown_capability_provider",
    key,
    value,
    message: `Unknown ${slot} capability provider "${value}". Falling back to catalog default.`,
  };
}

export class ProviderConfigService {
  static resolveSelectedIntelligenceProviderConfig(): ResolvedIntelligenceProviderConfig {
    const { provider, warnings } = resolveSelectedProviderWithWarnings();
    const config = this.resolveIntelligenceProviderConfig(provider.value, provider);
    return {
      ...config,
      warnings: [...warnings, ...config.warnings],
    };
  }

  static resolveIntelligenceProviderConfig(
    providerId: IntelligenceProviderId,
    providerField?: ResolvedConfigField<IntelligenceProviderId>,
  ): ResolvedIntelligenceProviderConfig {
    const entry = INTELLIGENCE_PROVIDER_CATALOG[providerId];
    const provider = providerField ?? {
      key: "AI_PROVIDER",
      value: providerId,
      source: "default",
    } satisfies ResolvedConfigField<IntelligenceProviderId>;
    const apiKey = resolveSecretField(entry.apiKey);
    const model = resolveConfigField(
      { primary: entry.modelKey, aliases: [] },
      entry.defaultModel,
    );
    const baseUrl = resolveNullableConfigField(
      { primary: entry.baseUrlKey, aliases: [] },
      entry.defaultBaseUrl,
    );

    return {
      provider,
      apiKey,
      model,
      baseUrl,
      modelCandidates: buildModelCandidates(model, entry.modelCandidates),
      timeoutMs: resolvePositiveIntegerField(entry.timeoutMsKey, entry.defaultTimeoutMs),
      retryAttempts: resolvePositiveIntegerField(entry.retryAttemptsKey, entry.defaultRetryAttempts),
      retryDelayMs: resolvePositiveIntegerField(entry.retryDelayMsKey, entry.defaultRetryDelayMs),
      warnings: [],
    };
  }

  static resolveAnthropicProviderConfig(): ResolvedIntelligenceProviderConfig {
    return this.resolveIntelligenceProviderConfig("anthropic");
  }

  static resolveCapabilityProviderConfig(
    slot: CapabilitySlotId,
  ): ResolvedCapabilityProviderConfig {
    const entry = CAPABILITY_PROVIDER_CATALOG[slot];
    const warnings: ProviderResolutionWarning[] = [];
    const explicitProvider = resolveRawStringField({
      primary: entry.providerKey,
      aliases: [],
    });
    const openAiKey = this.resolveOpenAiApiKey();
    const defaultProvider = openAiKey.configured
      ? entry.defaultProviderWhenKeyPresent
      : entry.defaultProviderWhenKeyMissing;

    let provider: ResolvedConfigField<CapabilityProviderId>;
    if (explicitProvider.value) {
      if (isCapabilityProviderSupported(entry, explicitProvider.value)) {
        provider = {
          key: explicitProvider.key,
          value: explicitProvider.value,
          source: explicitProvider.source,
          ...(explicitProvider.aliasOf ? { aliasOf: explicitProvider.aliasOf } : {}),
        };
      } else {
        warnings.push(unknownCapabilityProviderWarning(
          explicitProvider.key,
          explicitProvider.value,
          slot,
        ));
        provider = {
          key: entry.providerKey,
          value: defaultProvider,
          source: "default",
        };
      }
    } else {
      provider = {
        key: entry.providerKey,
        value: defaultProvider,
        source: "default",
      };
    }

    const model = resolveNullableConfigField(
      { primary: entry.modelKey, aliases: [] },
      entry.defaultModel,
    );
    const requirement = findRequirement(entry, provider.value);

    return {
      slot,
      provider,
      model,
      requiredKey: requirement?.apiKey ? resolveSecretField(requirement.apiKey) : null,
      warnings,
    };
  }

  static resolveProviderConfigSnapshot(): ResolvedProviderConfigSnapshot {
    return {
      intelligence: this.resolveSelectedIntelligenceProviderConfig(),
      capabilities: {
        image: this.resolveCapabilityProviderConfig("image"),
        tts: this.resolveCapabilityProviderConfig("tts"),
        stt: this.resolveCapabilityProviderConfig("stt"),
        web_search: this.resolveCapabilityProviderConfig("web_search"),
      },
    };
  }

  static resolveRedactedProviderConfigSnapshot(): RedactedProviderConfigSnapshot {
    return redactProviderConfigSnapshot(this.resolveProviderConfigSnapshot());
  }

  static resolveOpenAiApiKey(): ResolvedSecretField {
    return resolveSecretField(OPENAI_API_KEY_SETTING);
  }

  static isProviderConfigured(): boolean {
    return this.resolveSelectedIntelligenceProviderConfig().apiKey.configured;
  }

  static getCapabilitySlots(): CapabilitySlotId[] {
    return [...CAPABILITY_SLOT_IDS];
  }
}

function findRequirement(
  entry: CapabilityCatalogEntry,
  provider: CapabilityProviderId,
) {
  return entry.requirements.find((requirement) => requirement.provider === provider) ?? null;
}

export function resolveSelectedProviderWithWarnings(): {
  provider: ResolvedConfigField<IntelligenceProviderId>;
  warnings: ProviderResolutionWarning[];
} {
  const resolved = resolveRawStringField(
    { primary: "AI_PROVIDER", aliases: [] },
    DEFAULT_AI_PROVIDER,
  );
  if (resolved.value && isIntelligenceProviderId(resolved.value)) {
    return {
      provider: {
        key: resolved.key,
        value: resolved.value,
        source: resolved.source,
      },
      warnings: [],
    };
  }

  return {
    provider: {
      key: "AI_PROVIDER",
      value: DEFAULT_AI_PROVIDER,
      source: "default",
    },
    warnings: resolved.value
      ? [unknownProviderWarning(resolved.key, resolved.value)]
      : [],
  };
}
