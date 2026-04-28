import { ConfigurationService } from "@/lib/config/ConfigurationService";
import { InstallWizard } from "./InstallWizard";
import { RedirectAndSetCookie } from "./RedirectAndSetCookie";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Studio Ordo | Installation",
  description: "Set up your Studio Ordo environment.",
};

export default async function InstallPage() {
  const isInitialized = ConfigurationService.isSystemInitialized();

  if (isInitialized) {
    // If we're already initialized but hitting this page, the cookie might be missing.
    // Set the cookie and redirect to dashboard.
    return <RedirectAndSetCookie to="/" />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex flex-col items-center justify-center p-4 font-sans text-neutral-900 dark:text-neutral-100">
      <div className="w-full max-w-xl bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        <div className="bg-neutral-900 text-white p-8 flex flex-col items-center">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Studio Ordo Setup</h1>
          <p className="text-neutral-400 text-center text-sm">
            Configure your AI operator system in less than 5 minutes.
          </p>
        </div>
        <div className="p-8">
          <InstallWizard />
        </div>
      </div>
    </div>
  );
}
