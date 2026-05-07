import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import type { AnthropicCompatibleProviderId } from "./types";

export class ProviderClientConfigurationError extends Error {
  readonly code = "missing_key" as const;

  constructor(message: string) {
    super(message);
    this.name = "ProviderClientConfigurationError";
  }
}

export interface AnthropicCompatibleClientConfig {
  provider: AnthropicCompatibleProviderId;
  apiKey: string | null;
  baseUrl: string | null;
}

function normalizeRequiredSecret(value: string | null, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new ProviderClientConfigurationError(`${label} is required.`);
  }

  return trimmed;
}

function normalizeOptionalString(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export class ProviderClientFactory {
  static createAnthropicCompatibleClient(
    config: AnthropicCompatibleClientConfig,
  ): Anthropic {
    const apiKey = normalizeRequiredSecret(
      config.apiKey,
      `${config.provider} API key`,
    );
    const baseURL = normalizeOptionalString(config.baseUrl);

    return new Anthropic({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });
  }

  static createOpenAiClient(apiKey: string | null): OpenAI {
    return new OpenAI({
      apiKey: normalizeRequiredSecret(apiKey, "OpenAI API key"),
    });
  }
}
