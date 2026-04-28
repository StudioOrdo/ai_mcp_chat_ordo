import type { Metadata } from "next";
import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import { AdminSection } from "@/components/admin/AdminSection";
import { KeysManager } from "./KeysManager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin System - Provider Keys",
  robots: { index: false, follow: false },
};

export default async function AdminKeysPage() {
  await requireAdminPageAccess();

  // Determine if keys are already configured by checking environment variables
  // (which are populated from ConfigurationService at runtime/boot)
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAi = !!process.env.OPENAI_API_KEY;

  return (
    <AdminSection
      title="Manage Provider Keys"
      description="Update and validate intelligence provider API keys for the workspace."
    >
      <div className="admin-route-stack">
        <KeysManager hasAnthropic={hasAnthropic} hasOpenAi={hasOpenAi} />
      </div>
    </AdminSection>
  );
}
