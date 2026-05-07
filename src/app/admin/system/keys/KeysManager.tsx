"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CapabilitySettingsInputMap,
  ProviderSettingsDto,
  ProviderSettingsUpdateInput,
} from "@/lib/ai/providers/provider-settings-service";
import type { CapabilityProviderId, CapabilitySlotId, IntelligenceProviderId } from "@/lib/ai/providers/types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to update provider settings.";
}

const CAPABILITY_LABELS: Record<CapabilitySlotId, string> = {
  image: "Image generation",
  tts: "Text to speech",
  stt: "Speech to text",
  web_search: "Web search",
};

function sourceLabel(source: string): string {
  return source === "env" ? "operator locked" : source;
}

function capabilityRequiredKeyLabel(
  capability: ProviderSettingsDto["capabilities"][CapabilitySlotId],
): string {
  if (!capability.requiredKey) {
    return "not required";
  }
  const status = capability.requiredKey.configured ? "configured" : "missing";
  return `${status} (${sourceLabel(capability.requiredKey.source)})`;
}

function buildCapabilities(settings: ProviderSettingsDto): CapabilitySettingsInputMap {
  return {
    image: {
      provider: settings.capabilities.image.provider.value,
      model: settings.capabilities.image.model.value,
    },
    tts: {
      provider: settings.capabilities.tts.provider.value,
      model: settings.capabilities.tts.model.value,
    },
    stt: {
      provider: settings.capabilities.stt.provider.value,
      model: settings.capabilities.stt.model.value,
    },
    web_search: {
      provider: settings.capabilities.web_search.provider.value,
      model: settings.capabilities.web_search.model.value,
    },
  };
}

export function KeysManager({ initialSettings }: { initialSettings: ProviderSettingsDto }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [provider, setProvider] = useState<IntelligenceProviderId>(initialSettings.intelligence.provider.value);
  const selectedProvider = settings.catalog.intelligenceProviders.find((entry) => entry.id === provider)
    ?? settings.catalog.intelligenceProviders[0];
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initialSettings.intelligence.model.value);
  const [baseUrl, setBaseUrl] = useState(initialSettings.intelligence.baseUrl.value ?? "");
  const [openAiKey, setOpenAiKey] = useState("");
  const [capabilities, setCapabilities] = useState<CapabilitySettingsInputMap>(() => buildCapabilities(initialSettings));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function changeProvider(next: IntelligenceProviderId) {
    const catalogEntry = settings.catalog.intelligenceProviders.find((entry) => entry.id === next);
    setProvider(next);
    setModel(catalogEntry?.defaultModel ?? model);
    setBaseUrl(catalogEntry?.defaultBaseUrl ?? "");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const payload: ProviderSettingsUpdateInput = {
        intelligence: {
          provider,
          apiKey: apiKey || undefined,
          model,
          baseUrl: baseUrl || null,
        },
        openAiKey: openAiKey || undefined,
        capabilities,
      };
      const res = await fetch("/api/admin/system/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || "Failed to update provider settings.");
      }
      const data = await res.json() as { settings?: ProviderSettingsDto };

      setSuccess(true);
      if (data.settings) {
        setSettings(data.settings);
      }
      setApiKey("");
      setOpenAiKey("");
      router.refresh();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl bg-card border rounded-lg p-6 space-y-6">
      <h2 className="text-xl font-semibold">Provider Configuration</h2>
      <p className="text-sm text-muted-foreground">
        Provider settings are validated before being saved. OpenAI is optional
        and only powers selected image, audio, and search capabilities.
      </p>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-md text-sm">
          Provider settings successfully validated and updated.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="provider" className="block text-sm font-medium">Intelligence provider</label>
          <select
            id="provider"
            value={provider}
            onChange={(event) => changeProvider(event.target.value as IntelligenceProviderId)}
            disabled={settings.intelligence.provider.locked}
            className="w-full px-3 py-2 border rounded-md bg-background"
          >
            {settings.catalog.intelligenceProviders.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.label}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Source: {sourceLabel(settings.intelligence.provider.source)}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="provider-key" className="block text-sm font-medium">
            {selectedProvider?.label ?? provider} API key
            {settings.intelligence.apiKey.configured && <span className="text-xs text-green-600 dark:text-green-400 ml-2">(configured)</span>}
          </label>
          <input
            id="provider-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={settings.intelligence.apiKey.source === "env"}
            className="w-full px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={settings.intelligence.apiKey.configured ? "Leave blank to keep existing key" : "Required"}
          />
          <p className="text-xs text-muted-foreground">Source: {sourceLabel(settings.intelligence.apiKey.source)}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="provider-model" className="block text-sm font-medium">Model</label>
          <input
            id="provider-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={settings.intelligence.model.locked}
            className="w-full px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-blue-500 outline-none"
            list="provider-models"
          />
          <datalist id="provider-models">
            {(selectedProvider?.modelCandidates ?? []).map((candidate) => (
              <option key={candidate} value={candidate} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">Source: {sourceLabel(settings.intelligence.model.source)}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="provider-base-url" className="block text-sm font-medium">Base URL</label>
          <input
            id="provider-base-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            disabled={settings.intelligence.baseUrl.locked}
            className="w-full px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={selectedProvider?.defaultBaseUrl ?? "SDK default"}
          />
          <p className="text-xs text-muted-foreground">Source: {sourceLabel(settings.intelligence.baseUrl.source)}</p>
        </div>

        <div className="space-y-2 rounded-md border p-4">
          <label htmlFor="openai-key" className="block text-sm font-medium">
            OpenAI API key for optional capabilities
            {settings.openAiKey.configured && <span className="text-xs text-green-600 dark:text-green-400 ml-2">(configured)</span>}
          </label>
          <input
            id="openai-key"
            type="password"
            value={openAiKey}
            onChange={(e) => setOpenAiKey(e.target.value)}
            disabled={settings.openAiKey.locked}
            className="w-full px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Leave blank to keep existing key"
          />
          <p className="text-xs text-muted-foreground">Source: {sourceLabel(settings.openAiKey.source)}</p>
          <p className="text-xs text-muted-foreground">OpenAI is not the chat provider here.</p>
        </div>

        <div className="space-y-3 rounded-md border p-4">
          <h3 className="text-sm font-semibold">Optional capabilities</h3>
          {(Object.keys(capabilities) as CapabilitySlotId[]).map((slot) => (
            <div key={slot} className="grid gap-2 md:grid-cols-[1fr_160px_1fr] md:items-center">
              <label className="text-sm font-medium" htmlFor={`${slot}-provider`}>
                {CAPABILITY_LABELS[slot]}
              </label>
              <select
                id={`${slot}-provider`}
                value={capabilities[slot].provider}
                onChange={(event) => updateCapability(slot, { provider: event.target.value as CapabilityProviderId })}
                disabled={settings.capabilities[slot].provider.locked}
                className="px-3 py-2 border rounded-md bg-background"
              >
                {settings.catalog.capabilities[slot].supportedProviders.map((candidate) => (
                  <option key={candidate} value={candidate}>{candidate}</option>
                ))}
              </select>
              <input
                aria-label={`${CAPABILITY_LABELS[slot]} model`}
                value={capabilities[slot].model ?? ""}
                onChange={(event) => updateCapability(slot, { model: event.target.value })}
                disabled={settings.capabilities[slot].model.locked || capabilities[slot].provider === "disabled"}
                className="px-3 py-2 border rounded-md bg-background"
                placeholder={settings.catalog.capabilities[slot].defaultModel ?? "default"}
              />
              <p className="text-xs text-muted-foreground md:col-start-2 md:col-span-2">
                Provider source: {sourceLabel(settings.capabilities[slot].provider.source)}.
                {" "}Model source: {sourceLabel(settings.capabilities[slot].model.source)}.
                {" "}Required key: {capabilityRequiredKeyLabel(settings.capabilities[slot])}.
              </p>
            </div>
          ))}
        </div>

        <div className="pt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/admin/system")}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Back to System
          </button>
          <button
            type="submit"
            disabled={loading}
            className="py-2 px-6 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm font-medium"
          >
            {loading ? "Validating & Saving..." : "Save Provider Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
