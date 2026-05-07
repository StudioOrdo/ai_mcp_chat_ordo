"use client";

import { useState } from "react";
import type {
  CapabilitySettingsInputMap,
  ProviderSettingsUpdateInput,
} from "@/lib/ai/providers/provider-settings-service";
import type { CapabilityProviderId, CapabilitySlotId, IntelligenceProviderId } from "@/lib/ai/providers/types";
import type { InstallStateView } from "@/lib/appliance/install/install-state";

type Step = "environment" | "providers" | "admin";

const PROVIDER_DEFAULTS = {
  anthropic: {
    label: "Anthropic",
    defaultModel: "claude-haiku-4-5",
    defaultBaseUrl: "",
    models: ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-6"],
  },
  deepseek: {
    label: "DeepSeek",
    defaultModel: "deepseek-v4-flash",
    defaultBaseUrl: "https://api.deepseek.com/anthropic",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"],
  },
} as const;

const CAPABILITY_LABELS: Record<CapabilitySlotId, string> = {
  image: "Image generation",
  tts: "Text to speech",
  stt: "Speech to text",
  web_search: "Web search",
};

const DEFAULT_CAPABILITIES: CapabilitySettingsInputMap = {
  image: { provider: "disabled", model: "gpt-image-1" },
  tts: { provider: "disabled", model: "tts-1" },
  stt: { provider: "disabled", model: null },
  web_search: { provider: "disabled", model: "gpt-5" },
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function InstallWizard({ initialInstallState }: { initialInstallState: InstallStateView }) {
  const [currentStep, setCurrentStep] = useState<Step>("environment");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State
  const [envStatus, setEnvStatus] = useState<"pending" | "success" | "error">("pending");
  const [provider, setProvider] = useState<IntelligenceProviderId>("anthropic");
  const [providerKey, setProviderKey] = useState("");
  const [providerModel, setProviderModel] = useState<string>(PROVIDER_DEFAULTS.anthropic.defaultModel);
  const [providerBaseUrl, setProviderBaseUrl] = useState("");
  const [openAiKey, setOpenAiKey] = useState("");
  const [capabilities, setCapabilities] = useState<CapabilitySettingsInputMap>(DEFAULT_CAPABILITIES);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [installToken, setInstallToken] = useState("");
  const [installTokenRequired, setInstallTokenRequired] = useState(initialInstallState.installTokenRequired);
  const providerInputId = "install-provider-key";
  const openAiInputId = "install-openai-key";
  const adminEmailInputId = "install-admin-email";
  const adminPasswordInputId = "install-admin-password";
  const installTokenInputId = "install-token";

  const checkEnvironment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/install/check");
      if (!res.ok) throw new Error("Environment check failed");
      const data = await res.json() as InstallStateView;
      setInstallTokenRequired(data.installTokenRequired);
      if (data.ready) {
        setEnvStatus("success");
        setTimeout(() => setCurrentStep("providers"), 800);
      } else {
        throw new Error(data.message || "Permissions issue detected.");
      }
    } catch (error) {
      setEnvStatus("error");
      setError(getErrorMessage(error, "Environment check failed."));
    } finally {
      setLoading(false);
    }
  };

  function buildProviderPayload(): ProviderSettingsUpdateInput {
    return {
      intelligence: {
        provider,
        apiKey: providerKey,
        model: providerModel,
        baseUrl: providerBaseUrl || null,
      },
      openAiKey: openAiKey || undefined,
      capabilities,
    };
  }

  function withInstallToken<T extends object>(payload: T): T & { installToken?: string } {
    return installTokenRequired ? { ...payload, installToken } : payload;
  }

  function changeProvider(next: IntelligenceProviderId) {
    setProvider(next);
    setProviderModel(PROVIDER_DEFAULTS[next].defaultModel);
    setProviderBaseUrl(PROVIDER_DEFAULTS[next].defaultBaseUrl);
  }

  function updateCapability(slot: CapabilitySlotId, patch: Partial<{ provider: CapabilityProviderId; model: string }>) {
    setCapabilities((current) => ({
      ...current,
      [slot]: {
        ...current[slot],
        ...patch,
      },
    }));
  }

  const handleProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerKey) {
      setError(`${PROVIDER_DEFAULTS[provider].label} API Key is required.`);
      return;
    }
    if (installTokenRequired && !installToken.trim()) {
      setError("Install token is required for hosted setup.");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/install/validate-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withInstallToken(buildProviderPayload())),
      });

      if (!res.ok) {
        const errData = await res.json() as { error?: string };
        throw new Error(errData.error || "Failed to validate API keys.");
      }

      setCurrentStep("admin");
    } catch (error) {
      setError(getErrorMessage(error, "Failed to validate API keys."));
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminPassword) {
      setError("Admin email and password are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/install/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withInstallToken({
          ...buildProviderPayload(),
          adminEmail,
          adminPassword,
        })),
      });

      if (!res.ok) {
        const errData = await res.json() as { error?: string };
        throw new Error(errData.error || "Failed to initialize system.");
      }

      // Success! Set cookie and redirect
      document.cookie = "ordo_installed=1; path=/; max-age=31536000";
      window.location.href = "/welcome";
    } catch (error) {
      setError(getErrorMessage(error, "Failed to initialize system."));
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Stepper Header */}
      <div className="flex items-center justify-between mb-4">
        {["environment", "providers", "admin"].map((step, idx) => {
          const isActive = currentStep === step;
          const isPast =
            ["environment", "providers", "admin"].indexOf(currentStep) > idx;

          return (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : isPast
                    ? "bg-green-500 text-white"
                    : "bg-neutral-200 text-neutral-500 dark:bg-neutral-700"
                }`}
              >
                {idx + 1}
              </div>
              {idx < 2 && (
                <div
                  className={`w-16 h-1 mx-2 rounded ${
                    isPast ? "bg-green-500" : "bg-neutral-200 dark:bg-neutral-700"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 border border-red-200 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Environment */}
      {currentStep === "environment" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">System Diagnostics</h2>
          <p className="text-neutral-500 text-sm">
            Before we begin, we need to ensure the system can write to the local SQLite database.
          </p>
          <button
            onClick={checkEnvironment}
            disabled={loading || envStatus === "success"}
            className="w-full py-2 px-4 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {loading ? "Checking..." : envStatus === "success" ? "All clear!" : "Run Diagnostics"}
          </button>
          {installTokenRequired && (
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
              <label htmlFor={installTokenInputId} className="block text-sm font-medium text-amber-900 dark:text-amber-100">
                Hosted install token
              </label>
              <input
                id={installTokenInputId}
                type="password"
                value={installToken}
                onChange={(event) => setInstallToken(event.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700 focus:ring-2 focus:ring-amber-500 outline-none"
                autoComplete="one-time-code"
              />
            </div>
          )}
        </div>
      )}

      {/* Step 2: Providers */}
      {currentStep === "providers" && (
        <form onSubmit={handleProviderSubmit} className="space-y-4">
          <h2 className="text-xl font-semibold">AI Providers</h2>
          <p className="text-neutral-500 text-sm">
            Choose the intelligence provider for chat and reasoning. OpenAI is
            optional and only powers selected image, audio, and search capabilities.
          </p>

          <div className="space-y-2">
            <label htmlFor="install-provider" className="block text-sm font-medium">Intelligence provider</label>
            <select
              id="install-provider"
              value={provider}
              onChange={(e) => changeProvider(e.target.value as IntelligenceProviderId)}
              className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="anthropic">Anthropic</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <label htmlFor={providerInputId} className="block text-sm font-medium">{PROVIDER_DEFAULTS[provider].label} API Key *</label>
            <input
              id={providerInputId}
              type="password"
              value={providerKey}
              onChange={(e) => setProviderKey(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={provider === "anthropic" ? "sk-ant-..." : "DeepSeek API key"}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="install-provider-model" className="block text-sm font-medium">Model</label>
            <input
              id="install-provider-model"
              value={providerModel}
              onChange={(e) => setProviderModel(e.target.value)}
              list="install-provider-models"
              className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <datalist id="install-provider-models">
              {PROVIDER_DEFAULTS[provider].models.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <label htmlFor="install-provider-base-url" className="block text-sm font-medium">Base URL</label>
            <input
              id="install-provider-base-url"
              value={providerBaseUrl}
              onChange={(e) => setProviderBaseUrl(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={PROVIDER_DEFAULTS[provider].defaultBaseUrl || "SDK default"}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor={openAiInputId} className="block text-sm font-medium">OpenAI API Key (Optional Capabilities)</label>
            <input
              id={openAiInputId}
              type="password"
              value={openAiKey}
              onChange={(e) => setOpenAiKey(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="sk-..."
            />
            <p className="text-xs text-neutral-500">Used only for enabled OpenAI-backed image, audio, and search capabilities.</p>
          </div>

          <div className="space-y-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-700">
            <h3 className="text-sm font-semibold">Optional capabilities</h3>
            {(Object.keys(capabilities) as CapabilitySlotId[]).map((slot) => (
              <div key={slot} className="grid gap-2 md:grid-cols-[1fr_150px_1fr] md:items-center">
                <label htmlFor={`install-${slot}-provider`} className="text-sm font-medium">
                  {CAPABILITY_LABELS[slot]}
                </label>
                <select
                  id={`install-${slot}-provider`}
                  value={capabilities[slot].provider}
                  onChange={(event) => updateCapability(slot, { provider: event.target.value as CapabilityProviderId })}
                  className="px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700"
                >
                  <option value="disabled">disabled</option>
                  {slot === "stt" ? <option value="local_whisper">local_whisper</option> : null}
                  <option value="openai">openai</option>
                </select>
                <input
                  aria-label={`${CAPABILITY_LABELS[slot]} model`}
                  value={capabilities[slot].model ?? ""}
                  onChange={(event) => updateCapability(slot, { model: event.target.value })}
                  disabled={capabilities[slot].provider === "disabled"}
                  className="px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700 disabled:opacity-50"
                  placeholder={DEFAULT_CAPABILITIES[slot].model ?? "default"}
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Validating Keys..." : "Continue to Identity"}
          </button>
        </form>
      )}

      {/* Step 3: Admin User */}
      {currentStep === "admin" && (
        <form onSubmit={handleFinalSubmit} className="space-y-4">
          <h2 className="text-xl font-semibold">Admin Account</h2>
          <p className="text-neutral-500 text-sm">
            Create the primary owner account for this workspace.
          </p>
          
          <div className="space-y-2">
            <label htmlFor={adminEmailInputId} className="block text-sm font-medium">Email Address</label>
            <input
              id={adminEmailInputId}
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor={adminPasswordInputId} className="block text-sm font-medium">Password</label>
            <input
              id={adminPasswordInputId}
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="pt-4 flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep("providers")}
              className="px-4 py-2 text-neutral-600 hover:text-neutral-900"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="py-2 px-6 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm font-medium"
            >
              {loading ? "Bootstrapping System..." : "Initialize System"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
