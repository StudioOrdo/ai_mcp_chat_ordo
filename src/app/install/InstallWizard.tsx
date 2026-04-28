"use client";

import { useState } from "react";

type Step = "environment" | "providers" | "admin";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function InstallWizard() {
  const [currentStep, setCurrentStep] = useState<Step>("environment");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State
  const [envStatus, setEnvStatus] = useState<"pending" | "success" | "error">("pending");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openAiKey, setOpenAiKey] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const anthropicInputId = "install-anthropic-key";
  const openAiInputId = "install-openai-key";
  const adminEmailInputId = "install-admin-email";
  const adminPasswordInputId = "install-admin-password";

  const checkEnvironment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/install/check");
      if (!res.ok) throw new Error("Environment check failed");
      const data = await res.json() as { ready?: boolean; message?: string };
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

  const handleProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anthropicKey) {
      setError("Anthropic API Key is required.");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/install/validate-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicKey, openAiKey }),
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
        body: JSON.stringify({
          anthropicKey,
          openAiKey,
          adminEmail,
          adminPassword,
        }),
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
        </div>
      )}

      {/* Step 2: Providers */}
      {currentStep === "providers" && (
        <form onSubmit={handleProviderSubmit} className="space-y-4">
          <h2 className="text-xl font-semibold">AI Providers</h2>
          <p className="text-neutral-500 text-sm">
            Enter your API keys. Anthropic is required as the primary intelligence engine.
          </p>
          
          <div className="space-y-2">
            <label htmlFor={anthropicInputId} className="block text-sm font-medium">Anthropic API Key *</label>
            <input
              id={anthropicInputId}
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="sk-ant-..."
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor={openAiInputId} className="block text-sm font-medium">OpenAI API Key (Optional)</label>
            <input
              id={openAiInputId}
              type="password"
              value={openAiKey}
              onChange={(e) => setOpenAiKey(e.target.value)}
              className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="sk-..."
            />
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
