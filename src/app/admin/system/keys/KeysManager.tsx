"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to update keys.";
}

export function KeysManager({
  hasAnthropic,
  hasOpenAi,
}: {
  hasAnthropic: boolean;
  hasOpenAi: boolean;
}) {
  const router = useRouter();
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openAiKey, setOpenAiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anthropicKey && !openAiKey) {
      setError("Please provide at least one key to update.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/admin/system/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicKey, openAiKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update keys.");
      }

      setSuccess(true);
      setAnthropicKey("");
      setOpenAiKey("");
      router.refresh();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl bg-card border rounded-lg p-6 space-y-6">
      <h2 className="text-xl font-semibold">Update Provider Keys</h2>
      <p className="text-sm text-muted-foreground">
        API keys are securely validated before being saved to the configuration database. 
        Leave a field blank to keep the existing key.
      </p>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-md text-sm">
          Keys successfully validated and updated!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Anthropic API Key {hasAnthropic && <span className="text-xs text-green-600 dark:text-green-400 ml-2">(Currently Configured)</span>}
          </label>
          <input
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={hasAnthropic ? "Leave blank to keep existing key" : "sk-ant-..."}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">
            OpenAI API Key {hasOpenAi && <span className="text-xs text-green-600 dark:text-green-400 ml-2">(Currently Configured)</span>}
          </label>
          <input
            type="password"
            value={openAiKey}
            onChange={(e) => setOpenAiKey(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={hasOpenAi ? "Leave blank to keep existing key" : "sk-..."}
          />
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
            disabled={loading || (!anthropicKey && !openAiKey)}
            className="py-2 px-6 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm font-medium"
          >
            {loading ? "Validating & Saving..." : "Update Keys"}
          </button>
        </div>
      </form>
    </div>
  );
}
