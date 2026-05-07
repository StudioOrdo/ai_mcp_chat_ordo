import { describe, it, expect, beforeEach, vi } from "vitest";

// Must import after env setup
let getEnvConfig: typeof import("@/lib/config/env-config").getEnvConfig;
let _resetEnvConfig: typeof import("@/lib/config/env-config")._resetEnvConfig;

beforeEach(async () => {
  vi.unstubAllEnvs();
  const mod = await import("@/lib/config/env-config");
  getEnvConfig = mod.getEnvConfig;
  _resetEnvConfig = mod._resetEnvConfig;
  _resetEnvConfig();
});

describe("getEnvConfig", () => {
  it("returns default values when no env vars are set", () => {
    const config = getEnvConfig();
    expect(config.NODE_ENV).toBe("test");
    expect(config.PORT).toBe(3000);
    expect(config.DATA_DIR).toBe(".data");
  });

  it("parses PORT as a number", () => {
    vi.stubEnv("PORT", "8080");
    _resetEnvConfig();
    const config = getEnvConfig();
    expect(config.PORT).toBe(8080);
  });

  it("caches the config after first call", () => {
    const first = getEnvConfig();
    const second = getEnvConfig();
    expect(first).toBe(second);
  });

  it("_resetEnvConfig clears cache", () => {
    const first = getEnvConfig();
    _resetEnvConfig();
    vi.stubEnv("PORT", "9999");
    const second = getEnvConfig();
    expect(second.PORT).toBe(9999);
    expect(first).not.toBe(second);
  });

  it("accepts optional API keys", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test-key");
    vi.stubEnv("ANTHROPIC_API_KEY_FILE", "/run/secrets/anthropic_api_key");
    vi.stubEnv("DEEPSEEK_API_KEY", "deepseek-key");
    vi.stubEnv("DEEPSEEK_API_KEY_FILE", "/run/secrets/deepseek_api_key");
    vi.stubEnv("OPENAI_API_KEY_FILE", "/run/secrets/openai_api_key");
    vi.stubEnv("ELEVENLABS_API_KEY", "elevenlabs-key");
    vi.stubEnv("ELEVENLABS_API_KEY_FILE", "/run/secrets/elevenlabs_api_key");
    vi.stubEnv("ORDO_INSTALL_TOKEN_FILE", "/run/secrets/ordo_install_token");
    vi.stubEnv("ORDO_INTERNAL_RUNTIME_SERVICE_TOKEN_FILE", "/run/secrets/ordo_internal_runtime_service_token");
    vi.stubEnv("AI_PROVIDER", "deepseek");
    vi.stubEnv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/anthropic");
    vi.stubEnv("TTS_PROVIDER", "openai");
    vi.stubEnv("WEB_SEARCH_MODEL", "gpt-5");
    _resetEnvConfig();
    const config = getEnvConfig();
    expect(config.ANTHROPIC_API_KEY).toBe("sk-test-key");
    expect(config.ANTHROPIC_API_KEY_FILE).toBe("/run/secrets/anthropic_api_key");
    expect(config.DEEPSEEK_API_KEY).toBe("deepseek-key");
    expect(config.DEEPSEEK_API_KEY_FILE).toBe("/run/secrets/deepseek_api_key");
    expect(config.OPENAI_API_KEY_FILE).toBe("/run/secrets/openai_api_key");
    expect(config.ELEVENLABS_API_KEY).toBe("elevenlabs-key");
    expect(config.ELEVENLABS_API_KEY_FILE).toBe("/run/secrets/elevenlabs_api_key");
    expect(config.ORDO_INSTALL_TOKEN_FILE).toBe("/run/secrets/ordo_install_token");
    expect(config.ORDO_INTERNAL_RUNTIME_SERVICE_TOKEN_FILE).toBe("/run/secrets/ordo_internal_runtime_service_token");
    expect(config.AI_PROVIDER).toBe("deepseek");
    expect(config.DEEPSEEK_BASE_URL).toBe("https://api.deepseek.com/anthropic");
    expect(config.TTS_PROVIDER).toBe("openai");
    expect(config.WEB_SEARCH_MODEL).toBe("gpt-5");
  });

  it("accepts hosted network contract env vars", () => {
    vi.stubEnv("ORDO_HOSTED_MODE", "reverse_proxy");
    vi.stubEnv("ORDO_PUBLIC_ORIGIN", "https://tenant.example.com");
    vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://legacy.example.com");
    vi.stubEnv("NEXT_PUBLIC_SITE_ORIGIN", "https://next.example.com");
    vi.stubEnv("TRUST_PROXY_HEADERS", "1");
    vi.stubEnv("ALLOWED_ORIGINS", "https://tenant.example.com");
    _resetEnvConfig();

    const config = getEnvConfig();

    expect(config.ORDO_HOSTED_MODE).toBe("reverse_proxy");
    expect(config.ORDO_PUBLIC_ORIGIN).toBe("https://tenant.example.com");
    expect(config.PUBLIC_SITE_ORIGIN).toBe("https://legacy.example.com");
    expect(config.NEXT_PUBLIC_SITE_ORIGIN).toBe("https://next.example.com");
    expect(config.TRUST_PROXY_HEADERS).toBe("1");
    expect(config.ALLOWED_ORIGINS).toBe("https://tenant.example.com");
  });

  it("rejects invalid hosted network mode", () => {
    vi.stubEnv("ORDO_HOSTED_MODE", "traefik");
    _resetEnvConfig();
    expect(() => getEnvConfig()).toThrow("Environment validation failed");
  });

  it("allows missing optional fields", () => {
    const config = getEnvConfig();
    expect(config.ANTHROPIC_API_KEY).toBeUndefined();
    expect(config.OPENAI_API_KEY).toBeUndefined();
    expect(config.DEFERRED_JOB_POLL_INTERVAL_MS).toBeUndefined();
  });

  it("treats blank optional env vars as unset", () => {
    vi.stubEnv("API__OPENAI_API_KEY", "");
    vi.stubEnv("DEFERRED_JOB_POLL_INTERVAL_MS", "");
    _resetEnvConfig();

    const config = getEnvConfig();

    expect(config.OPENAI_API_KEY).toBeUndefined();
    expect(config.DEFERRED_JOB_POLL_INTERVAL_MS).toBeUndefined();
  });

  it("rejects invalid NODE_ENV", () => {
    vi.stubEnv("NODE_ENV", "staging");
    _resetEnvConfig();
    expect(() => getEnvConfig()).toThrow("Environment validation failed");
  });

  it("coerces numeric env vars", () => {
    vi.stubEnv("DEFERRED_JOB_POLL_INTERVAL_MS", "3000");
    _resetEnvConfig();
    const config = getEnvConfig();
    expect(config.DEFERRED_JOB_POLL_INTERVAL_MS).toBe(3000);
  });

  it("validates appliance resource env vars", () => {
    vi.stubEnv("ORDO_DATA_FREE_WARN_BYTES", "200");
    vi.stubEnv("ORDO_DATA_FREE_BLOCK_BYTES", "100");
    vi.stubEnv("ORDO_DATA_FREE_WARN_PERCENT", "20");
    vi.stubEnv("ORDO_DATA_FREE_BLOCK_PERCENT", "10");
    vi.stubEnv("ORDO_TMP_SIZE", "512m");
    vi.stubEnv("ORDO_MEMORY_LIMIT", "2g");
    vi.stubEnv("ORDO_CPUS", "2.0");
    vi.stubEnv("ORDO_LOG_MAX_FILE", "5");
    _resetEnvConfig();

    const config = getEnvConfig();

    expect(config.ORDO_DATA_FREE_WARN_BYTES).toBe(200);
    expect(config.ORDO_TMP_SIZE).toBe("512m");
    expect(config.ORDO_MEMORY_LIMIT).toBe("2g");
    expect(config.ORDO_CPUS).toBe("2.0");
  });

  it("rejects unsafe appliance resource threshold ordering", () => {
    vi.stubEnv("ORDO_DATA_FREE_WARN_BYTES", "100");
    vi.stubEnv("ORDO_DATA_FREE_BLOCK_BYTES", "200");
    _resetEnvConfig();

    expect(() => getEnvConfig()).toThrow("Environment validation failed");
  });
});
