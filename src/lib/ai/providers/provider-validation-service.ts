import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";

import {
  ProviderClientConfigurationError,
  ProviderClientFactory,
} from "./provider-client-factory";
import type { IntelligenceProviderId } from "./types";

export type ProviderValidationProvider = IntelligenceProviderId | "openai";

export type ProviderValidationErrorCode =
  | "missing_key"
  | "invalid_key"
  | "invalid_model"
  | "provider_unreachable"
  | "unsupported_provider"
  | "unexpected_error";

export interface IntelligenceProviderValidationInput {
  provider: IntelligenceProviderId;
  apiKey: string | null;
  model: string;
  baseUrl: string | null;
}

export interface OpenAiProviderValidationInput {
  apiKey: string | null;
}

export interface ProviderValidationSuccess {
  ok: true;
  provider: ProviderValidationProvider;
  model?: string;
  baseUrl?: string | null;
}

export interface ProviderValidationFailure {
  ok: false;
  provider: ProviderValidationProvider;
  model?: string;
  baseUrl?: string | null;
  code: ProviderValidationErrorCode;
  message: string;
  status?: number;
}

export type ProviderValidationResult =
  | ProviderValidationSuccess
  | ProviderValidationFailure;

interface ProviderValidationServiceDeps {
  createAnthropicCompatibleClient: typeof ProviderClientFactory.createAnthropicCompatibleClient;
  createOpenAiClient: typeof ProviderClientFactory.createOpenAiClient;
}

const DEFAULT_DEPS: ProviderValidationServiceDeps = {
  createAnthropicCompatibleClient:
    ProviderClientFactory.createAnthropicCompatibleClient,
  createOpenAiClient: ProviderClientFactory.createOpenAiClient,
};

function normalizeNonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const nestedError = (error as {
      error?: { error?: { message?: string }; message?: string };
      message?: string;
    }).error;
    const message = nestedError?.error?.message
      ?? nestedError?.message
      ?? (error as { message?: string }).message;

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

function getStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null) {
    const status = (error as { status?: unknown; code?: unknown }).status
      ?? (error as { status?: unknown; code?: unknown }).code;
    if (typeof status === "number") {
      return status;
    }
  }

  return undefined;
}

function classifyError(
  error: unknown,
): { code: ProviderValidationErrorCode; message: string; status?: number } {
  if (error instanceof ProviderClientConfigurationError) {
    return {
      code: "missing_key",
      message: error.message,
    };
  }

  const status = getStatus(error);
  const message = getErrorMessage(error, "Provider validation failed.");
  const lower = message.toLowerCase();

  if (status === 401 || status === 403 || lower.includes("api key")) {
    return { code: "invalid_key", message, status };
  }

  if (
    status === 404
    || lower.includes("model")
    || lower.includes("not_found")
    || lower.includes("not found")
  ) {
    return { code: "invalid_model", message, status };
  }

  if (
    status === 408
    || status === 409
    || status === 425
    || status === 429
    || (typeof status === "number" && status >= 500)
  ) {
    return { code: "provider_unreachable", message, status };
  }

  return { code: "unexpected_error", message, status };
}

function failure(
  input: {
    provider: ProviderValidationProvider;
    model?: string;
    baseUrl?: string | null;
  },
  error: { code: ProviderValidationErrorCode; message: string; status?: number },
): ProviderValidationFailure {
  return {
    ok: false,
    provider: input.provider,
    ...(input.model ? { model: input.model } : {}),
    ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
    code: error.code,
    message: error.message,
    ...(error.status !== undefined ? { status: error.status } : {}),
  };
}

export function toProviderValidationHttpMessage(
  result: ProviderValidationFailure,
): string {
  switch (result.provider) {
    case "anthropic":
      return `Anthropic Error: ${result.message}`;
    case "deepseek":
      return `DeepSeek Error: ${result.message}`;
    case "openai":
      return `OpenAI Error: ${result.message}`;
  }
}

export class ProviderValidationService {
  constructor(
    private readonly deps: ProviderValidationServiceDeps = DEFAULT_DEPS,
  ) {}

  async validateIntelligenceProvider(
    input: IntelligenceProviderValidationInput,
  ): Promise<ProviderValidationResult> {
    const model = normalizeNonEmpty(input.model);
    if (!model) {
      return failure(input, {
        code: "invalid_model",
        message: `${input.provider} model is required.`,
      });
    }

    const apiKey = normalizeNonEmpty(input.apiKey);
    if (!apiKey) {
      return failure({ ...input, model }, {
        code: "missing_key",
        message: `${input.provider} API key is required.`,
      });
    }

    let client: Anthropic;
    try {
      client = this.deps.createAnthropicCompatibleClient({
        provider: input.provider,
        apiKey,
        baseUrl: input.baseUrl,
      });
    } catch (error) {
      return failure({ ...input, model }, classifyError(error));
    }

    try {
      await client.messages.create({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "Ping" }],
      });
      return {
        ok: true,
        provider: input.provider,
        model,
        baseUrl: normalizeNonEmpty(input.baseUrl),
      };
    } catch (error) {
      return failure({ ...input, model }, classifyError(error));
    }
  }

  async validateOpenAiProvider(
    input: OpenAiProviderValidationInput,
  ): Promise<ProviderValidationResult> {
    const apiKey = normalizeNonEmpty(input.apiKey);
    if (!apiKey) {
      return failure({ provider: "openai" }, {
        code: "missing_key",
        message: "OpenAI API key is required.",
      });
    }

    let client: OpenAI;
    try {
      client = this.deps.createOpenAiClient(apiKey);
    } catch (error) {
      return failure({ provider: "openai" }, classifyError(error));
    }

    try {
      await client.models.list();
      return {
        ok: true,
        provider: "openai",
      };
    } catch (error) {
      return failure({ provider: "openai" }, classifyError(error));
    }
  }
}

export const providerValidationService = new ProviderValidationService();
