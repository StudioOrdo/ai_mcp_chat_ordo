import type {
  CapabilityProviderId,
  CapabilitySlotId,
  IntelligenceProviderId,
} from "./types";

export interface ProviderSettingKeys {
  primary: string;
  aliases: readonly string[];
}

export interface IntelligenceProviderCatalogEntry {
  id: IntelligenceProviderId;
  label: string;
  apiKey: ProviderSettingKeys;
  modelKey: string;
  baseUrlKey: string;
  defaultBaseUrl: string | null;
  defaultModel: string;
  modelCandidates: readonly string[];
  timeoutMsKey: string;
  retryAttemptsKey: string;
  retryDelayMsKey: string;
  defaultTimeoutMs: number;
  defaultRetryAttempts: number;
  defaultRetryDelayMs: number;
}

export interface CapabilityProviderRequirement {
  provider: Exclude<CapabilityProviderId, "disabled">;
  apiKey: ProviderSettingKeys | null;
}

export interface CapabilityCatalogEntry {
  slot: CapabilitySlotId;
  providerKey: string;
  modelKey: string;
  supportedProviders: readonly CapabilityProviderId[];
  defaultProviderWhenKeyPresent: CapabilityProviderId;
  defaultProviderWhenKeyMissing: CapabilityProviderId;
  defaultModel: string | null;
  requirements: readonly CapabilityProviderRequirement[];
}

export const DEFAULT_AI_PROVIDER: IntelligenceProviderId = "anthropic";
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5";
export const ANTHROPIC_MODEL_CANDIDATES = [
  "claude-haiku-4-5",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
] as const;

export const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com/anthropic";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
export const DEEPSEEK_MODEL_CANDIDATES = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
] as const;

export const OPENAI_API_KEY_SETTING: ProviderSettingKeys = {
  primary: "OPENAI_API_KEY",
  aliases: ["API__OPENAI_API_KEY"],
};

export const INTELLIGENCE_PROVIDER_CATALOG = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    apiKey: {
      primary: "ANTHROPIC_API_KEY",
      aliases: ["API__ANTHROPIC_API_KEY"],
    },
    modelKey: "ANTHROPIC_MODEL",
    baseUrlKey: "ANTHROPIC_BASE_URL",
    defaultBaseUrl: null,
    defaultModel: DEFAULT_ANTHROPIC_MODEL,
    modelCandidates: ANTHROPIC_MODEL_CANDIDATES,
    timeoutMsKey: "ANTHROPIC_REQUEST_TIMEOUT_MS",
    retryAttemptsKey: "ANTHROPIC_RETRY_ATTEMPTS",
    retryDelayMsKey: "ANTHROPIC_RETRY_DELAY_MS",
    defaultTimeoutMs: 45000,
    defaultRetryAttempts: 3,
    defaultRetryDelayMs: 150,
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    apiKey: {
      primary: "DEEPSEEK_API_KEY",
      aliases: [],
    },
    modelKey: "DEEPSEEK_MODEL",
    baseUrlKey: "DEEPSEEK_BASE_URL",
    defaultBaseUrl: DEFAULT_DEEPSEEK_BASE_URL,
    defaultModel: DEFAULT_DEEPSEEK_MODEL,
    modelCandidates: DEEPSEEK_MODEL_CANDIDATES,
    timeoutMsKey: "DEEPSEEK_REQUEST_TIMEOUT_MS",
    retryAttemptsKey: "DEEPSEEK_RETRY_ATTEMPTS",
    retryDelayMsKey: "DEEPSEEK_RETRY_DELAY_MS",
    defaultTimeoutMs: 45000,
    defaultRetryAttempts: 3,
    defaultRetryDelayMs: 150,
  },
} as const satisfies Record<IntelligenceProviderId, IntelligenceProviderCatalogEntry>;

export const CAPABILITY_PROVIDER_CATALOG = {
  image: {
    slot: "image",
    providerKey: "IMAGE_PROVIDER",
    modelKey: "IMAGE_MODEL",
    supportedProviders: ["disabled", "openai"],
    defaultProviderWhenKeyPresent: "openai",
    defaultProviderWhenKeyMissing: "disabled",
    defaultModel: "gpt-image-1",
    requirements: [{ provider: "openai", apiKey: OPENAI_API_KEY_SETTING }],
  },
  tts: {
    slot: "tts",
    providerKey: "TTS_PROVIDER",
    modelKey: "TTS_MODEL",
    supportedProviders: ["disabled", "openai"],
    defaultProviderWhenKeyPresent: "openai",
    defaultProviderWhenKeyMissing: "disabled",
    defaultModel: "tts-1",
    requirements: [{ provider: "openai", apiKey: OPENAI_API_KEY_SETTING }],
  },
  stt: {
    slot: "stt",
    providerKey: "STT_PROVIDER",
    modelKey: "STT_MODEL",
    supportedProviders: ["disabled", "local_whisper", "openai"],
    defaultProviderWhenKeyPresent: "disabled",
    defaultProviderWhenKeyMissing: "disabled",
    defaultModel: null,
    requirements: [
      { provider: "openai", apiKey: OPENAI_API_KEY_SETTING },
      { provider: "local_whisper", apiKey: null },
    ],
  },
  web_search: {
    slot: "web_search",
    providerKey: "WEB_SEARCH_PROVIDER",
    modelKey: "WEB_SEARCH_MODEL",
    supportedProviders: ["disabled", "openai"],
    defaultProviderWhenKeyPresent: "openai",
    defaultProviderWhenKeyMissing: "disabled",
    defaultModel: "gpt-5",
    requirements: [{ provider: "openai", apiKey: OPENAI_API_KEY_SETTING }],
  },
} as const satisfies Record<CapabilitySlotId, CapabilityCatalogEntry>;

export const CAPABILITY_SLOT_IDS = Object.keys(
  CAPABILITY_PROVIDER_CATALOG,
) as CapabilitySlotId[];

export function isIntelligenceProviderId(value: string): value is IntelligenceProviderId {
  return Object.prototype.hasOwnProperty.call(INTELLIGENCE_PROVIDER_CATALOG, value);
}

export function isCapabilityProviderSupported(
  entry: CapabilityCatalogEntry,
  value: string,
): value is CapabilityProviderId {
  return entry.supportedProviders.includes(value as CapabilityProviderId);
}
