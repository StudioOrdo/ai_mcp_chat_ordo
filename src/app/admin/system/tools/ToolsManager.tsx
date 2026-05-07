"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { EffectiveToolManifest } from "@/lib/tools/tool-policy-types";

interface ToolBundleView {
  id: string;
  displayName: string;
  toolNames: readonly string[];
}

interface ToolsManagerProps {
  initialManifest: EffectiveToolManifest;
  bundles: readonly ToolBundleView[];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to update tool settings.";
}

function stateLabel(state: string): string {
  return state.replaceAll("_", " ");
}

function providerCapabilityLabel(tool: EffectiveToolManifest["tools"][number]): string | null {
  if (!tool.providerCapabilitySlot || !tool.providerCapabilityProvider || !tool.providerCapabilityState) {
    return null;
  }

  if (tool.providerCapabilityState === "missing_key") {
    return `${tool.providerCapabilitySlot}: missing ${
      tool.providerCapabilityProvider === "openai" ? "OpenAI" : tool.providerCapabilityProvider
    } key`;
  }

  return `${tool.providerCapabilitySlot}: ${stateLabel(tool.providerCapabilityState)}`;
}

const SUMMARY_STATES = [
  "enabled",
  "provider_disabled",
  "missing_provider_key",
  "disabled_by_admin",
  "disabled_by_static_config",
  "disabled_by_install_profile",
] as const;

export function ToolsManager({ initialManifest, bundles }: ToolsManagerProps) {
  const router = useRouter();
  const [manifest, setManifest] = useState(initialManifest);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bundleById = useMemo(() => new Map(bundles.map((bundle) => [bundle.id, bundle])), [bundles]);
  const toolsByBundle = useMemo(() => {
    const grouped = new Map<string, typeof manifest.tools>();
    for (const tool of manifest.tools) {
      const key = tool.bundleId ?? "unbundled";
      grouped.set(key, [...(grouped.get(key) ?? []), tool]);
    }
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [manifest]);
  const summaryByState = useMemo(() => {
    return manifest.tools.reduce<Record<string, number>>((counts, tool) => {
      counts[tool.state] = (counts[tool.state] ?? 0) + 1;
      return counts;
    }, {});
  }, [manifest]);
  const protectedCount = useMemo(() => manifest.tools.filter((tool) => tool.protected).length, [manifest]);
  const staticLockedCount = useMemo(() => manifest.tools.filter((tool) => tool.staticLocked).length, [manifest]);

  async function submit(body: Record<string, string>) {
    const key = Object.values(body).join(":");
    setLoadingKey(key);
    setError(null);

    try {
      const res = await fetch("/api/admin/system/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to update tool settings.");
      }
      setManifest(data.manifest);
      router.refresh();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <div className="admin-route-stack">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-100 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {manifest.warnings.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-100 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {manifest.warnings[0].message}
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Effective Tool State</h2>
          <p className="text-sm text-muted-foreground">
            {manifest.tools.length} catalog tools, {protectedCount} protected, {staticLockedCount} operator locked
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUMMARY_STATES.map((state) => (
            <span key={state} className="rounded border px-2 py-1 text-xs">
              {stateLabel(state)}: {summaryByState[state] ?? 0}
            </span>
          ))}
        </div>
      </section>

      {toolsByBundle.map(([bundleId, tools]) => {
        const bundle = bundleById.get(bundleId);
        const enabledCount = tools.filter((tool) => tool.state === "enabled").length;
        return (
          <section key={bundleId} className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{bundle?.displayName ?? "Unbundled Tools"}</h2>
                <p className="text-sm text-muted-foreground">
                  {enabledCount} of {tools.length} enabled
                </p>
              </div>
              {bundle ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                    disabled={loadingKey !== null}
                    onClick={() => submit({ action: "enable_bundle", bundleId })}
                  >
                    Enable Bundle
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                    disabled={loadingKey !== null}
                    onClick={() => submit({ action: "disable_bundle", bundleId })}
                  >
                    Disable Bundle
                  </button>
                </div>
              ) : null}
            </div>

            <div className="grid gap-2">
              {tools.map((tool) => {
                const enabled = tool.state === "enabled";
                const disabled = loadingKey !== null || tool.protected || tool.staticLocked;
                const capabilityLabel = providerCapabilityLabel(tool);
                return (
                  <div key={tool.name} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{tool.name}</span>
                        <span className="rounded border px-2 py-0.5 text-xs">{stateLabel(tool.state)}</span>
                        {tool.protected ? <span className="rounded border px-2 py-0.5 text-xs">protected</span> : null}
                        {tool.staticLocked ? <span className="rounded border px-2 py-0.5 text-xs">operator locked</span> : null}
                        {capabilityLabel ? <span className="rounded border px-2 py-0.5 text-xs">{capabilityLabel}</span> : null}
                      </div>
                      <p className="mt-1 text-sm text-foreground/70">{tool.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{tool.reason}</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                      disabled={disabled}
                      onClick={() => submit({
                        action: enabled ? "disable_tool" : "enable_tool",
                        toolName: tool.name,
                      })}
                    >
                      {enabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
