import { beforeEach, describe, expect, it, vi } from "vitest";

const { anthropicConstructorMock, openAiConstructorMock } = vi.hoisted(() => ({
  anthropicConstructorMock: vi.fn(),
  openAiConstructorMock: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: anthropicConstructorMock,
}));

vi.mock("openai", () => ({
  default: openAiConstructorMock,
}));

import {
  ProviderClientConfigurationError,
  ProviderClientFactory,
} from "./provider-client-factory";

describe("ProviderClientFactory", () => {
beforeEach(() => {
    vi.clearAllMocks();
    anthropicConstructorMock.mockImplementation(function AnthropicMock(options) {
      return { options };
    });
    openAiConstructorMock.mockImplementation(function OpenAiMock(options) {
      return { options };
    });
  });

  it("builds an Anthropic client with the selected key", () => {
    const client = ProviderClientFactory.createAnthropicCompatibleClient({
      provider: "anthropic",
      apiKey: "anthropic-key",
      baseUrl: null,
    });

    expect(client).toEqual({ options: { apiKey: "anthropic-key" } });
    expect(anthropicConstructorMock).toHaveBeenCalledWith({
      apiKey: "anthropic-key",
    });
  });

  it("builds a DeepSeek client with the selected key and baseURL", () => {
    ProviderClientFactory.createAnthropicCompatibleClient({
      provider: "deepseek",
      apiKey: "deepseek-key",
      baseUrl: "https://api.deepseek.com/anthropic",
    });

    expect(anthropicConstructorMock).toHaveBeenCalledWith({
      apiKey: "deepseek-key",
      baseURL: "https://api.deepseek.com/anthropic",
    });
  });

  it("builds an OpenAI client with the optional capability key", () => {
    const client = ProviderClientFactory.createOpenAiClient("openai-key");

    expect(client).toEqual({ options: { apiKey: "openai-key" } });
    expect(openAiConstructorMock).toHaveBeenCalledWith({
      apiKey: "openai-key",
    });
  });

  it("fails before SDK construction when a required key is missing", () => {
    expect(() => ProviderClientFactory.createAnthropicCompatibleClient({
      provider: "anthropic",
      apiKey: " ",
      baseUrl: null,
    })).toThrow(ProviderClientConfigurationError);
    expect(() => ProviderClientFactory.createOpenAiClient(null))
      .toThrow(ProviderClientConfigurationError);
    expect(anthropicConstructorMock).not.toHaveBeenCalled();
    expect(openAiConstructorMock).not.toHaveBeenCalled();
  });
});
