import { ProviderConfigService } from "@/lib/ai/providers/provider-config-service";
import { resolveFirstConfiguredSecret, resolveRuntimeSecret } from "@/lib/config/secret-source";

const EMPTY_ENV_MESSAGE = "must be set to a non-empty value";

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const secret = resolveRuntimeSecret(key);
    if (secret.value) {
      return secret.value;
    }
  }

  return undefined;
}

function requireNonEmpty(value: string | null | undefined, keysLabel: string): string {
  if (!value) {
    throw new Error(`${keysLabel} ${EMPTY_ENV_MESSAGE}.`);
  }

  return value;
}

function readPrimary(primaryKey: string): string | undefined {
  const primary = readEnv(primaryKey);
  if (primary) {
    return primary;
  }

  return undefined;
}

export function getAnthropicApiKey(): string {
  const value = ProviderConfigService.resolveAnthropicProviderConfig().apiKey.value;
  return requireNonEmpty(value, "ANTHROPIC_API_KEY or API__ANTHROPIC_API_KEY");
}

export function getOpenaiApiKey(): string {
  const value = ProviderConfigService.resolveOpenAiApiKey().value;
  return requireNonEmpty(value, "OPENAI_API_KEY or API__OPENAI_API_KEY");
}

export function getAnthropicModel(): string {
  return ProviderConfigService.resolveAnthropicProviderConfig().model.value;
}

function parsePositiveIntegerEnv(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function getAnthropicRequestTimeoutMs(): number {
  return ProviderConfigService.resolveAnthropicProviderConfig().timeoutMs.value;
}

export function getTtsFetchTimeoutMs(): number {
  return parsePositiveIntegerEnv(
    readPrimary("TTS_FETCH_TIMEOUT_MS"),
    30000,
  );
}

export function getAnthropicRequestRetryAttempts(): number {
  return ProviderConfigService.resolveAnthropicProviderConfig().retryAttempts.value;
}

export function getAnthropicRequestRetryDelayMs(): number {
  return ProviderConfigService.resolveAnthropicProviderConfig().retryDelayMs.value;
}

export function getModelFallbacks(): string[] {
  return ProviderConfigService.resolveAnthropicProviderConfig().modelCandidates;
}

export function getSelectedIntelligenceModelFallbacks(): string[] {
  return ProviderConfigService.resolveSelectedIntelligenceProviderConfig().modelCandidates;
}

export function validateRequiredRuntimeConfig() {
  const config = ProviderConfigService.resolveSelectedIntelligenceProviderConfig();
  return requireNonEmpty(
    config.apiKey.value,
    config.apiKey.aliasOf
      ? `${config.apiKey.key} or ${config.apiKey.aliasOf}`
      : config.apiKey.key,
  );
}

export function getWebPushPublicKey(): string | null {
  return readEnv("WEB_PUSH_VAPID_PUBLIC_KEY", "NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY") ?? null;
}

export function getWebPushPrivateKey(): string | null {
  return resolveRuntimeSecret("WEB_PUSH_VAPID_PRIVATE_KEY").value;
}

export function getWebPushSubject(): string {
  return readEnv("WEB_PUSH_SUBJECT") ?? "mailto:no-reply@studioordo.local";
}

export function getInternalRuntimeServiceToken(): string {
  return resolveRuntimeSecret("ORDO_INTERNAL_RUNTIME_SERVICE_TOKEN").value ?? "local-dev-runtime-token";
}

export function resolveInternalRuntimeServiceTokenState(): {
  configured: boolean;
  source: "env" | "file" | "default";
  unsafeDefault: boolean;
} {
  const secret = resolveFirstConfiguredSecret(["ORDO_INTERNAL_RUNTIME_SERVICE_TOKEN"]);
  if (secret.value) {
    return {
      configured: true,
      source: secret.source === "file" ? "file" : "env",
      unsafeDefault: false,
    };
  }
  return {
    configured: false,
    source: "default",
    unsafeDefault: true,
  };
}
