import type {
  RedactedCapabilityProviderConfig,
  RedactedIntelligenceProviderConfig,
  RedactedProviderConfigSnapshot,
  RedactedSecretField,
  ResolvedCapabilityProviderConfig,
  ResolvedIntelligenceProviderConfig,
  ResolvedProviderConfigSnapshot,
  ResolvedSecretField,
} from "./types";

export function redactSecretField(field: ResolvedSecretField): RedactedSecretField {
  return {
    key: field.key,
    source: field.source,
    ...(field.aliasOf ? { aliasOf: field.aliasOf } : {}),
    configured: field.configured,
    last4: field.value && field.value.length >= 4 ? field.value.slice(-4) : null,
  };
}

export function redactIntelligenceProviderConfig(
  config: ResolvedIntelligenceProviderConfig,
): RedactedIntelligenceProviderConfig {
  return {
    ...config,
    apiKey: redactSecretField(config.apiKey),
  };
}

export function redactCapabilityProviderConfig(
  config: ResolvedCapabilityProviderConfig,
): RedactedCapabilityProviderConfig {
  return {
    ...config,
    requiredKey: config.requiredKey ? redactSecretField(config.requiredKey) : null,
  };
}

export function redactProviderConfigSnapshot(
  snapshot: ResolvedProviderConfigSnapshot,
): RedactedProviderConfigSnapshot {
  return {
    intelligence: redactIntelligenceProviderConfig(snapshot.intelligence),
    capabilities: {
      image: redactCapabilityProviderConfig(snapshot.capabilities.image),
      tts: redactCapabilityProviderConfig(snapshot.capabilities.tts),
      stt: redactCapabilityProviderConfig(snapshot.capabilities.stt),
      web_search: redactCapabilityProviderConfig(snapshot.capabilities.web_search),
    },
  };
}
