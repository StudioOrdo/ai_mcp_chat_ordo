import type Anthropic from "@anthropic-ai/sdk";

import { resolveProviderPolicy, type ProviderResiliencePolicy } from "@/lib/chat/provider-policy";

import { ProviderClientFactory } from "./provider-client-factory";
import { ProviderConfigService } from "./provider-config-service";
import type {
  IntelligenceProviderId,
  ProviderConfigSource,
  ResolvedIntelligenceProviderConfig,
} from "./types";

export class SelectedIntelligenceRuntimeConfigurationError extends Error {
  readonly code = "missing_key" as const;

  constructor(message: string) {
    super(message);
    this.name = "SelectedIntelligenceRuntimeConfigurationError";
  }
}

export interface SelectedIntelligenceRuntime {
  provider: IntelligenceProviderId;
  client: Anthropic;
  model: string;
  baseUrl: string | null;
  policy: ProviderResiliencePolicy;
  metadata: {
    providerSource: ProviderConfigSource;
    apiKeySource: ProviderConfigSource;
    apiKeyConfigured: boolean;
    modelSource: ProviderConfigSource;
    baseUrlSource: ProviderConfigSource;
  };
}

function requireSelectedProviderKey(config: ResolvedIntelligenceProviderConfig): string {
  if (!config.apiKey.configured || !config.apiKey.value) {
    throw new SelectedIntelligenceRuntimeConfigurationError(
      `${config.provider.value} API key is required for intelligence provider runtime.`,
    );
  }

  return config.apiKey.value;
}

export function createSelectedIntelligenceRuntime(
  config: ResolvedIntelligenceProviderConfig = ProviderConfigService.resolveSelectedIntelligenceProviderConfig(),
): SelectedIntelligenceRuntime {
  const apiKey = requireSelectedProviderKey(config);
  const client = ProviderClientFactory.createAnthropicCompatibleClient({
    provider: config.provider.value,
    apiKey,
    baseUrl: config.baseUrl.value,
  });

  return {
    provider: config.provider.value,
    client,
    model: config.model.value,
    baseUrl: config.baseUrl.value,
    policy: resolveProviderPolicy(config),
    metadata: {
      providerSource: config.provider.source,
      apiKeySource: config.apiKey.source,
      apiKeyConfigured: config.apiKey.configured,
      modelSource: config.model.source,
      baseUrlSource: config.baseUrl.source,
    },
  };
}
