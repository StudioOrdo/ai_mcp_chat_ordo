export type IntelligenceProviderId = "anthropic" | "deepseek";
export type AnthropicCompatibleProviderId = IntelligenceProviderId;

export type CapabilitySlotId = "image" | "tts" | "stt" | "web_search";
export type CapabilityProviderId = "disabled" | "openai" | "local_whisper";

export type ProviderConfigSource = "env" | "file" | "sqlite" | "default" | "missing";

export interface ResolvedConfigField<T> {
  key: string;
  value: T;
  source: ProviderConfigSource;
  aliasOf?: string;
}

export interface ResolvedSecretField {
  key: string;
  value: string | null;
  source: ProviderConfigSource;
  aliasOf?: string;
  configured: boolean;
}

export interface RedactedSecretField {
  key: string;
  source: ProviderConfigSource;
  aliasOf?: string;
  configured: boolean;
  last4: string | null;
}

export interface ProviderResolutionWarning {
  code: "unknown_intelligence_provider" | "unknown_capability_provider";
  key: string;
  value: string;
  message: string;
}

export interface ResolvedIntelligenceProviderConfig {
  provider: ResolvedConfigField<IntelligenceProviderId>;
  apiKey: ResolvedSecretField;
  model: ResolvedConfigField<string>;
  baseUrl: ResolvedConfigField<string | null>;
  modelCandidates: string[];
  timeoutMs: ResolvedConfigField<number>;
  retryAttempts: ResolvedConfigField<number>;
  retryDelayMs: ResolvedConfigField<number>;
  warnings: ProviderResolutionWarning[];
}

export interface ResolvedCapabilityProviderConfig {
  slot: CapabilitySlotId;
  provider: ResolvedConfigField<CapabilityProviderId>;
  model: ResolvedConfigField<string | null>;
  requiredKey: ResolvedSecretField | null;
  warnings: ProviderResolutionWarning[];
}

export interface RedactedIntelligenceProviderConfig {
  provider: ResolvedConfigField<IntelligenceProviderId>;
  apiKey: RedactedSecretField;
  model: ResolvedConfigField<string>;
  baseUrl: ResolvedConfigField<string | null>;
  modelCandidates: string[];
  timeoutMs: ResolvedConfigField<number>;
  retryAttempts: ResolvedConfigField<number>;
  retryDelayMs: ResolvedConfigField<number>;
  warnings: ProviderResolutionWarning[];
}

export interface RedactedCapabilityProviderConfig {
  slot: CapabilitySlotId;
  provider: ResolvedConfigField<CapabilityProviderId>;
  model: ResolvedConfigField<string | null>;
  requiredKey: RedactedSecretField | null;
  warnings: ProviderResolutionWarning[];
}

export interface ResolvedProviderConfigSnapshot {
  intelligence: ResolvedIntelligenceProviderConfig;
  capabilities: Record<CapabilitySlotId, ResolvedCapabilityProviderConfig>;
}

export interface RedactedProviderConfigSnapshot {
  intelligence: RedactedIntelligenceProviderConfig;
  capabilities: Record<CapabilitySlotId, RedactedCapabilityProviderConfig>;
}
