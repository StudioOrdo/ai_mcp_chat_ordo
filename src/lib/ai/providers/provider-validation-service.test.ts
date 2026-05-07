import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderValidationService } from "./provider-validation-service";

describe("ProviderValidationService", () => {
  const createAnthropicCompatibleClient = vi.fn();
  const createOpenAiClient = vi.fn();
  const anthropicMessagesCreate = vi.fn();
  const openAiModelsList = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    anthropicMessagesCreate.mockResolvedValue({ id: "msg_1" });
    openAiModelsList.mockResolvedValue({ data: [] });
    createAnthropicCompatibleClient.mockReturnValue({
      messages: {
        create: anthropicMessagesCreate,
      },
    });
    createOpenAiClient.mockReturnValue({
      models: {
        list: openAiModelsList,
      },
    });
  });

  function createService() {
    return new ProviderValidationService({
      createAnthropicCompatibleClient,
      createOpenAiClient,
    });
  }

  it("validates submitted API key values before persistence", async () => {
    const result = await createService().validateIntelligenceProvider({
      provider: "anthropic",
      apiKey: "submitted-key",
      model: "claude-haiku-4-5",
      baseUrl: null,
    });

    expect(result).toMatchObject({
      ok: true,
      provider: "anthropic",
      model: "claude-haiku-4-5",
    });
    expect(createAnthropicCompatibleClient).toHaveBeenCalledWith({
      provider: "anthropic",
      apiKey: "submitted-key",
      baseUrl: null,
    });
  });

  it("uses the selected Anthropic model", async () => {
    await createService().validateIntelligenceProvider({
      provider: "anthropic",
      apiKey: "anthropic-key",
      model: "claude-sonnet-4-6",
      baseUrl: null,
    });

    expect(anthropicMessagesCreate).toHaveBeenCalledWith({
      model: "claude-sonnet-4-6",
      max_tokens: 1,
      messages: [{ role: "user", content: "Ping" }],
    });
  });

  it("uses the selected DeepSeek model and base URL", async () => {
    const result = await createService().validateIntelligenceProvider({
      provider: "deepseek",
      apiKey: "deepseek-key",
      model: "deepseek-v4-pro",
      baseUrl: "https://api.deepseek.com/anthropic",
    });

    expect(result).toMatchObject({
      ok: true,
      provider: "deepseek",
      model: "deepseek-v4-pro",
      baseUrl: "https://api.deepseek.com/anthropic",
    });
    expect(createAnthropicCompatibleClient).toHaveBeenCalledWith({
      provider: "deepseek",
      apiKey: "deepseek-key",
      baseUrl: "https://api.deepseek.com/anthropic",
    });
    expect(anthropicMessagesCreate).toHaveBeenCalledWith({
      model: "deepseek-v4-pro",
      max_tokens: 1,
      messages: [{ role: "user", content: "Ping" }],
    });
  });

  it("returns missing_key without constructing an SDK client", async () => {
    const result = await createService().validateIntelligenceProvider({
      provider: "anthropic",
      apiKey: " ",
      model: "claude-haiku-4-5",
      baseUrl: null,
    });

    expect(result).toMatchObject({
      ok: false,
      provider: "anthropic",
      code: "missing_key",
    });
    expect(createAnthropicCompatibleClient).not.toHaveBeenCalled();
  });

  it("returns structured invalid key failures", async () => {
    anthropicMessagesCreate.mockRejectedValueOnce({
      status: 401,
      error: { message: "invalid api key" },
    });

    const result = await createService().validateIntelligenceProvider({
      provider: "anthropic",
      apiKey: "bad-key",
      model: "claude-haiku-4-5",
      baseUrl: null,
    });

    expect(result).toMatchObject({
      ok: false,
      provider: "anthropic",
      code: "invalid_key",
      status: 401,
      message: "invalid api key",
    });
  });

  it("returns structured invalid model failures", async () => {
    anthropicMessagesCreate.mockRejectedValueOnce({
      status: 404,
      error: { error: { message: "model not found" } },
    });

    const result = await createService().validateIntelligenceProvider({
      provider: "deepseek",
      apiKey: "deepseek-key",
      model: "unknown-model",
      baseUrl: "https://api.deepseek.com/anthropic",
    });

    expect(result).toMatchObject({
      ok: false,
      provider: "deepseek",
      code: "invalid_model",
      status: 404,
      message: "model not found",
    });
  });

  it("validates OpenAI independently from chat readiness", async () => {
    const result = await createService().validateOpenAiProvider({
      apiKey: "openai-key",
    });

    expect(result).toEqual({
      ok: true,
      provider: "openai",
    });
    expect(createAnthropicCompatibleClient).not.toHaveBeenCalled();
    expect(createOpenAiClient).toHaveBeenCalledWith("openai-key");
    expect(openAiModelsList).toHaveBeenCalled();
  });

  it("returns structured OpenAI validation failures", async () => {
    openAiModelsList.mockRejectedValueOnce({
      status: 403,
      error: { message: "forbidden" },
    });

    const result = await createService().validateOpenAiProvider({
      apiKey: "bad-openai-key",
    });

    expect(result).toMatchObject({
      ok: false,
      provider: "openai",
      code: "invalid_key",
      status: 403,
      message: "forbidden",
    });
  });
});
