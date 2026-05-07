import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderSettingsDto } from "@/lib/ai/providers/provider-settings-service";

import { KeysManager } from "./KeysManager";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

const baseSettings: ProviderSettingsDto = {
  intelligence: {
    provider: {
      key: "AI_PROVIDER",
      value: "anthropic",
      source: "sqlite",
      locked: false,
    },
    apiKey: {
      key: "ANTHROPIC_API_KEY",
      source: "sqlite",
      configured: true,
      last4: "1234",
    },
    model: {
      key: "ANTHROPIC_MODEL",
      value: "claude-sonnet-4-6",
      source: "sqlite",
      locked: false,
    },
    baseUrl: {
      key: "ANTHROPIC_BASE_URL",
      value: null,
      source: "default",
      locked: false,
    },
    timeoutMs: {
      key: "ANTHROPIC_REQUEST_TIMEOUT_MS",
      value: 45000,
      source: "default",
    },
    retryAttempts: {
      key: "ANTHROPIC_RETRY_ATTEMPTS",
      value: 3,
      source: "default",
    },
    retryDelayMs: {
      key: "ANTHROPIC_RETRY_DELAY_MS",
      value: 150,
      source: "default",
    },
    warnings: [],
    modelCandidates: ["claude-sonnet-4-6", "claude-haiku-4-5"],
  },
  openAiKey: {
    key: "OPENAI_API_KEY",
    source: "missing",
    configured: false,
    last4: null,
    locked: false,
  },
  capabilities: {
    image: {
      slot: "image",
      provider: { key: "IMAGE_PROVIDER", value: "disabled", source: "sqlite", locked: false },
      model: { key: "IMAGE_MODEL", value: null, source: "default", locked: false },
      requiredKey: null,
      warnings: [],
    },
    tts: {
      slot: "tts",
      provider: { key: "TTS_PROVIDER", value: "disabled", source: "sqlite", locked: false },
      model: { key: "TTS_MODEL", value: null, source: "default", locked: false },
      requiredKey: null,
      warnings: [],
    },
    stt: {
      slot: "stt",
      provider: { key: "STT_PROVIDER", value: "local_whisper", source: "sqlite", locked: false },
      model: { key: "STT_MODEL", value: null, source: "default", locked: false },
      requiredKey: null,
      warnings: [],
    },
    web_search: {
      slot: "web_search",
      provider: { key: "WEB_SEARCH_PROVIDER", value: "disabled", source: "sqlite", locked: false },
      model: { key: "WEB_SEARCH_MODEL", value: null, source: "default", locked: false },
      requiredKey: null,
      warnings: [],
    },
  },
  catalog: {
    intelligenceProviders: [
      {
        id: "anthropic",
        label: "Anthropic",
        defaultModel: "claude-haiku-4-5",
        defaultBaseUrl: null,
        modelCandidates: ["claude-haiku-4-5", "claude-sonnet-4-6"],
      },
      {
        id: "deepseek",
        label: "DeepSeek",
        defaultModel: "deepseek-v4-flash",
        defaultBaseUrl: "https://api.deepseek.com/anthropic",
        modelCandidates: ["deepseek-v4-flash", "deepseek-v4-pro"],
      },
    ],
    capabilities: {
      image: {
        supportedProviders: ["disabled", "openai"],
        defaultModel: "gpt-image-1",
      },
      tts: {
        supportedProviders: ["disabled", "openai"],
        defaultModel: "tts-1",
      },
      stt: {
        supportedProviders: ["disabled", "local_whisper", "openai"],
        defaultModel: null,
      },
      web_search: {
        supportedProviders: ["disabled", "openai"],
        defaultModel: "gpt-5",
      },
    },
  },
};

describe("KeysManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      success: true,
      settings: baseSettings,
    }), { status: 200 })));
  });

  it("renders redacted settings and operator-locked env fields", () => {
    render(<KeysManager initialSettings={{
      ...baseSettings,
      intelligence: {
        ...baseSettings.intelligence,
        model: {
          ...baseSettings.intelligence.model,
          source: "env",
          locked: true,
        },
      },
    }} />);

    expect(screen.getByLabelText("Model")).toBeDisabled();
    expect(screen.getAllByText("Source: operator locked")).toHaveLength(1);
    expect(screen.getByLabelText("OpenAI API key for optional capabilities")).toBeInTheDocument();
    expect(screen.getByText("Source: missing")).toBeInTheDocument();
    expect(screen.getByText("OpenAI is not the chat provider here.")).toBeInTheDocument();
    expect(screen.getAllByText("Provider source: sqlite. Model source: default. Required key: not required.")).toHaveLength(4);
  });

  it("shows per-capability required key status and source", () => {
    render(<KeysManager initialSettings={{
      ...baseSettings,
      capabilities: {
        ...baseSettings.capabilities,
        image: {
          ...baseSettings.capabilities.image,
          provider: {
            ...baseSettings.capabilities.image.provider,
            value: "openai",
          },
          model: {
            ...baseSettings.capabilities.image.model,
            value: "gpt-image-1",
            source: "sqlite",
          },
          requiredKey: {
            key: "OPENAI_API_KEY",
            source: "missing",
            configured: false,
            last4: null,
          },
        },
      },
    }} />);

    expect(screen.getByText("Provider source: sqlite. Model source: sqlite. Required key: missing (missing).")).toBeInTheDocument();
  });

  it("submits intelligence provider and optional capability settings", async () => {
    render(<KeysManager initialSettings={baseSettings} />);

    fireEvent.change(screen.getByLabelText("Intelligence provider"), {
      target: { value: "deepseek" },
    });
    fireEvent.change(screen.getByLabelText(/DeepSeek API key/), {
      target: { value: "deepseek-key" },
    });
    fireEvent.change(screen.getByLabelText("OpenAI API key for optional capabilities"), {
      target: { value: "openai-key" },
    });
    fireEvent.change(screen.getByLabelText("Image generation"), {
      target: { value: "openai" },
    });
    fireEvent.change(screen.getByLabelText("Image generation model"), {
      target: { value: "gpt-image-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Provider Settings" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/system/keys",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        }),
      );
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse(String(init?.body));
    expect(payload).toMatchObject({
      intelligence: {
        provider: "deepseek",
        apiKey: "deepseek-key",
        model: "deepseek-v4-flash",
        baseUrl: "https://api.deepseek.com/anthropic",
      },
      openAiKey: "openai-key",
      capabilities: {
        image: {
          provider: "openai",
          model: "gpt-image-1",
        },
        stt: {
          provider: "local_whisper",
          model: null,
        },
      },
    });
    expect(refreshMock).toHaveBeenCalled();
  });
});
