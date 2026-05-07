import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InstallWizard } from "./InstallWizard";

describe("InstallWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/install/check") {
        return new Response(JSON.stringify({
          ready: true,
          state: "ready_for_setup",
          hostedMode: "local",
          ownerConfigured: false,
          setupAllowed: true,
          installTokenRequired: false,
        }), { status: 200 });
      }
      if (url === "/api/install/validate-keys") {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (url === "/api/install/setup") {
        return new Response(JSON.stringify({ error: "setup blocked in test" }), { status: 500 });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function moveToProviderStep(): Promise<void> {
    render(<InstallWizard initialInstallState={{
      ready: true,
      state: "ready_for_setup",
      hostedMode: "local",
      ownerConfigured: false,
      setupAllowed: true,
      installTokenRequired: false,
    }} />);
    fireEvent.click(screen.getByRole("button", { name: "Run Diagnostics" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/install/check"));
    await screen.findByText("AI Providers", {}, { timeout: 1500 });
  }

  it("lets installs choose DeepSeek without requiring OpenAI", async () => {
    await moveToProviderStep();

    fireEvent.change(screen.getByLabelText("Intelligence provider"), {
      target: { value: "deepseek" },
    });
    fireEvent.change(screen.getByLabelText("DeepSeek API Key *"), {
      target: { value: "deepseek-key" },
    });
    fireEvent.change(screen.getByLabelText("Speech to text"), {
      target: { value: "local_whisper" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue to Identity" }));

    await screen.findByText("Admin Account");

    const validateCall = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/install/validate-keys");
    expect(validateCall).toBeDefined();
    const payload = JSON.parse(String(validateCall?.[1]?.body));
    expect(payload).toMatchObject({
      intelligence: {
        provider: "deepseek",
        apiKey: "deepseek-key",
        model: "deepseek-v4-flash",
        baseUrl: "https://api.deepseek.com/anthropic",
      },
      capabilities: {
        image: { provider: "disabled", model: "gpt-image-1" },
        tts: { provider: "disabled", model: "tts-1" },
        stt: { provider: "local_whisper", model: null },
        web_search: { provider: "disabled", model: "gpt-5" },
      },
    });
    expect(payload.openAiKey).toBeUndefined();
  });

  it("sends provider settings with final setup", async () => {
    await moveToProviderStep();

    fireEvent.change(screen.getByLabelText("Anthropic API Key *"), {
      target: { value: "anthropic-key" },
    });
    fireEvent.change(screen.getByLabelText("OpenAI API Key (Optional Capabilities)"), {
      target: { value: "openai-key" },
    });
    fireEvent.change(screen.getByLabelText("Image generation"), {
      target: { value: "openai" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue to Identity" }));
    await screen.findByText("Admin Account");

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Initialize System" }));

    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(([url]) => url === "/api/install/setup")).toBe(true);
    });

    const setupCall = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/install/setup");
    const payload = JSON.parse(String(setupCall?.[1]?.body));
    expect(payload).toMatchObject({
      adminEmail: "admin@example.com",
      adminPassword: "password123",
      intelligence: {
        provider: "anthropic",
        apiKey: "anthropic-key",
        model: "claude-haiku-4-5",
        baseUrl: null,
      },
      openAiKey: "openai-key",
      capabilities: {
        image: { provider: "openai", model: "gpt-image-1" },
      },
    });
  });
});
