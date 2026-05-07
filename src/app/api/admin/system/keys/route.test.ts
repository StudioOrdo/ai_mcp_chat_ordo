import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminPageAccessMock,
  parseLegacyProviderSettingsInputMock,
  parseProviderSettingsUpdateInputMock,
  applySettingsMock,
  getSettingsDtoMock,
} = vi.hoisted(() => ({
  requireAdminPageAccessMock: vi.fn(),
  parseLegacyProviderSettingsInputMock: vi.fn(),
  parseProviderSettingsUpdateInputMock: vi.fn(),
  applySettingsMock: vi.fn(),
  getSettingsDtoMock: vi.fn(),
}));

vi.mock("@/lib/journal/admin-journal", () => ({
  requireAdminPageAccess: requireAdminPageAccessMock,
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
    applySettings: applySettingsMock,
    getSettingsDto: getSettingsDtoMock,
  },
}));

import { GET, POST } from "./route";

const settingsDto = {
  intelligence: {
    provider: { value: "anthropic", source: "sqlite", locked: false },
    apiKey: { configured: true, source: "sqlite", last4: "1234" },
    model: { value: "claude-sonnet-4-6", source: "sqlite", locked: false },
    baseUrl: { value: null, source: "default", locked: false },
  },
  openAiKey: {
    configured: false,
    source: "missing",
    last4: null,
    locked: false,
  },
  capabilities: {
    image: {
      provider: { value: "disabled", source: "sqlite", locked: false },
      model: { value: null, source: "default", locked: false },
      requiredKey: null,
    },
  },
};

const parsedSettings = {
  intelligence: {
    provider: "anthropic",
    apiKey: "submitted-anthropic-key",
    model: "claude-sonnet-4-6",
    baseUrl: null,
  },
  openAiKey: "submitted-openai-key",
  capabilities: {
    image: { provider: "openai", model: "gpt-image-1" },
    tts: { provider: "disabled", model: null },
    stt: { provider: "local_whisper", model: null },
    web_search: { provider: "disabled", model: null },
  },
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/admin/system/keys", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/admin/system/keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageAccessMock.mockResolvedValue({ id: "admin" });
    parseLegacyProviderSettingsInputMock.mockReturnValue(null);
    parseProviderSettingsUpdateInputMock.mockReturnValue(parsedSettings);
    applySettingsMock.mockResolvedValue({
      ok: true,
      snapshot: {},
      warnings: [],
    });
    getSettingsDtoMock.mockReturnValue(settingsDto);
  });

  it("requires admin access and returns redacted settings", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requireAdminPageAccessMock).toHaveBeenCalled();
    expect(body.settings).toEqual(settingsDto);
  });

  it("applies the parsed provider settings after admin access", async () => {
    const body = {
      intelligence: parsedSettings.intelligence,
      openAiKey: parsedSettings.openAiKey,
      capabilities: parsedSettings.capabilities,
    };

    const response = await POST(request(body));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(requireAdminPageAccessMock).toHaveBeenCalled();
    expect(parseProviderSettingsUpdateInputMock).toHaveBeenCalledWith(body);
    expect(applySettingsMock).toHaveBeenCalledWith(parsedSettings);
    expect(json).toEqual({ success: true, settings: settingsDto });
  });

  it("preserves the legacy key update request shape", async () => {
    const legacyBody = {
      anthropicKey: "submitted-anthropic-key",
      openAiKey: "submitted-openai-key",
    };
    parseLegacyProviderSettingsInputMock.mockReturnValueOnce(parsedSettings);

    const response = await POST(request(legacyBody));

    expect(response.status).toBe(200);
    expect(parseLegacyProviderSettingsInputMock).toHaveBeenCalledWith(legacyBody);
    expect(parseProviderSettingsUpdateInputMock).not.toHaveBeenCalled();
    expect(applySettingsMock).toHaveBeenCalledWith(parsedSettings);
  });

  it("does not apply invalid parsed settings", async () => {
    parseProviderSettingsUpdateInputMock.mockReturnValueOnce({
      ok: false,
      error: {
        code: "invalid_provider",
        message: "Unsupported intelligence provider.",
        status: 400,
      },
    });

    const response = await POST(request({ intelligence: { provider: "mystery" } }));

    expect(response.status).toBe(400);
    expect(applySettingsMock).not.toHaveBeenCalled();
  });

  it("returns service validation failures without reporting success", async () => {
    applySettingsMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "validation_failed",
        message: "anthropic Error: invalid key",
        status: 400,
      },
    });

    const response = await POST(request({
      intelligence: parsedSettings.intelligence,
      capabilities: parsedSettings.capabilities,
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("anthropic Error: invalid key");
    expect(getSettingsDtoMock).not.toHaveBeenCalled();
  });
});
