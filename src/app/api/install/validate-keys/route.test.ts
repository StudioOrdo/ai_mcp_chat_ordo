import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  isSystemInitializedMock,
  parseLegacyProviderSettingsInputMock,
  parseProviderSettingsUpdateInputMock,
  validateInstallSettingsMock,
  guardInstallMutationMock,
} = vi.hoisted(() => ({
  isSystemInitializedMock: vi.fn(),
  parseLegacyProviderSettingsInputMock: vi.fn(),
  parseProviderSettingsUpdateInputMock: vi.fn(),
  validateInstallSettingsMock: vi.fn(),
  guardInstallMutationMock: vi.fn(),
}));

vi.mock("@/lib/config/ConfigurationService", () => ({
  ConfigurationService: {
    isSystemInitialized: isSystemInitializedMock,
  },
}));

vi.mock("@/lib/appliance/install/install-token", () => ({
  guardInstallMutation: guardInstallMutationMock,
}));

vi.mock("@/lib/ai/providers/provider-settings-service", () => ({
  parseLegacyProviderSettingsInput: parseLegacyProviderSettingsInputMock,
  parseProviderSettingsUpdateInput: parseProviderSettingsUpdateInputMock,
  isProviderSettingsFailure: (value: unknown) =>
    typeof value === "object"
    && value !== null
    && "ok" in value
    && value.ok === false,
  providerSettingsService: {
    validateInstallSettings: validateInstallSettingsMock,
  },
}));

import { POST } from "./route";

const parsedSettings = {
  intelligence: {
    provider: "deepseek",
    apiKey: "submitted-deepseek-key",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com/anthropic",
  },
  openAiKey: null,
  capabilities: {
    image: { provider: "disabled", model: null },
    tts: { provider: "disabled", model: null },
    stt: { provider: "local_whisper", model: null },
    web_search: { provider: "disabled", model: null },
  },
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/install/validate-keys", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/install/validate-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSystemInitializedMock.mockReturnValue(false);
    guardInstallMutationMock.mockReturnValue({ ok: true });
    parseLegacyProviderSettingsInputMock.mockReturnValue(null);
    parseProviderSettingsUpdateInputMock.mockReturnValue(parsedSettings);
    validateInstallSettingsMock.mockResolvedValue({
      ok: true,
      snapshot: {},
      warnings: [],
    });
  });

  it("validates the parsed install provider payload through the settings service", async () => {
    const body = {
      intelligence: parsedSettings.intelligence,
      capabilities: parsedSettings.capabilities,
    };

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(parseProviderSettingsUpdateInputMock).toHaveBeenCalledWith(body);
    expect(validateInstallSettingsMock).toHaveBeenCalledWith(parsedSettings);
  });

  it("preserves the legacy request shape before falling back to the new payload parser", async () => {
    const legacyBody = {
      anthropicKey: "submitted-anthropic-key",
      openAiKey: "submitted-openai-key",
    };
    parseLegacyProviderSettingsInputMock.mockReturnValueOnce(parsedSettings);

    const response = await POST(request(legacyBody));

    expect(response.status).toBe(200);
    expect(parseLegacyProviderSettingsInputMock).toHaveBeenCalledWith(legacyBody);
    expect(parseProviderSettingsUpdateInputMock).not.toHaveBeenCalled();
    expect(validateInstallSettingsMock).toHaveBeenCalledWith(parsedSettings);
  });

  it("returns structured parser failures", async () => {
    parseProviderSettingsUpdateInputMock.mockReturnValueOnce({
      ok: false,
      error: {
        code: "invalid_provider",
        message: "Unsupported intelligence provider.",
        status: 400,
      },
    });

    const response = await POST(request({ intelligence: { provider: "mystery" } }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Unsupported intelligence provider.");
    expect(validateInstallSettingsMock).not.toHaveBeenCalled();
  });

  it("returns structured service validation failures", async () => {
    validateInstallSettingsMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "validation_failed",
        message: "deepseek Error: invalid key",
        status: 400,
      },
    });

    const response = await POST(request({
      intelligence: parsedSettings.intelligence,
      capabilities: parsedSettings.capabilities,
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("deepseek Error: invalid key");
  });

  it("rejects validation after initialization", async () => {
    guardInstallMutationMock.mockReturnValueOnce({
      ok: false,
      response: Response.json({ error: "System is already initialized." }, { status: 400 }),
    });

    const response = await POST(request({
      intelligence: parsedSettings.intelligence,
      capabilities: parsedSettings.capabilities,
    }));

    expect(response.status).toBe(400);
    expect(validateInstallSettingsMock).not.toHaveBeenCalled();
  });
});
