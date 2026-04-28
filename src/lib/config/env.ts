const EMPTY_ENV_MESSAGE = "must be set to a non-empty value";

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function requireNonEmpty(value: string | undefined, keysLabel: string): string {
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

function readPrimaryWithAliases(primaryKey: string, ...aliasKeys: string[]): string | undefined {
  return readEnv(primaryKey, ...aliasKeys);
}

export function getAnthropicApiKey(): string {
  const value = readPrimaryWithAliases("ANTHROPIC_API_KEY", "API__ANTHROPIC_API_KEY");
  return requireNonEmpty(value, "ANTHROPIC_API_KEY or API__ANTHROPIC_API_KEY");
}

export function getOpenaiApiKey(): string {
  const value = readPrimaryWithAliases("OPENAI_API_KEY", "API__OPENAI_API_KEY");
  return requireNonEmpty(value, "OPENAI_API_KEY or API__OPENAI_API_KEY");
}

export function getAnthropicModel(): string {
  return readPrimary("ANTHROPIC_MODEL") ?? "claude-haiku-4-5";
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
  return parsePositiveIntegerEnv(
    readPrimary("ANTHROPIC_REQUEST_TIMEOUT_MS"),
    45000,
  );
}

export function getTtsFetchTimeoutMs(): number {
  return parsePositiveIntegerEnv(
    readPrimary("TTS_FETCH_TIMEOUT_MS"),
    30000,
  );
}

export function getAnthropicRequestRetryAttempts(): number {
  return parsePositiveIntegerEnv(
    readPrimary("ANTHROPIC_RETRY_ATTEMPTS"),
    3,
  );
}

export function getAnthropicRequestRetryDelayMs(): number {
  return parsePositiveIntegerEnv(
    readPrimary("ANTHROPIC_RETRY_DELAY_MS"),
    150,
  );
}

export function getModelFallbacks(): string[] {
  const configured = readPrimary("ANTHROPIC_MODEL");
  const models = [
    configured,
    "claude-haiku-4-5",
    "claude-sonnet-4-6",
    "claude-opus-4-6",
  ].filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );

  return [...new Set(models)];
}

export function validateRequiredRuntimeConfig() {
  getAnthropicApiKey();
}

export function getWebPushPublicKey(): string | null {
  return readEnv("WEB_PUSH_VAPID_PUBLIC_KEY", "NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY") ?? null;
}

export function getWebPushPrivateKey(): string | null {
  return readEnv("WEB_PUSH_VAPID_PRIVATE_KEY") ?? null;
}

export function getWebPushSubject(): string {
  return readEnv("WEB_PUSH_SUBJECT") ?? "mailto:no-reply@studioordo.local";
}

export function getInternalRuntimeServiceToken(): string {
  return readEnv("ORDO_INTERNAL_RUNTIME_SERVICE_TOKEN") ?? "local-dev-runtime-token";
}
