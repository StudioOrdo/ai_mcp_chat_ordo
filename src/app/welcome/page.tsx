import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome to Studio Ordo",
  robots: { index: false, follow: false },
};

import { resolveInstallState } from "@/lib/appliance/install/install-state";

export default async function WelcomePage() {
  const installState = resolveInstallState();
  if (!installState.ownerConfigured) {
    redirect("/install");
  }

  const user = await getSessionUser();

  if (!user) {
    // If somehow the session isn't loaded or cookie isn't valid, send them back to login
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-8 shadow-sm flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold mb-2 text-neutral-900 dark:text-white">Installation Complete</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-8 leading-relaxed">
          Your AI operator system is successfully configured and securely linked to your intelligence providers. The workspace is ready.
        </p>

        <Link
          href="/"
          className="w-full py-3 px-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium rounded-md hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
        >
          Enter Workspace &rarr;
        </Link>
      </div>
    </div>
  );
}
