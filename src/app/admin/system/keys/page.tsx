import type { Metadata } from "next";
import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import { AdminSection } from "@/components/admin/AdminSection";
import { providerSettingsService } from "@/lib/ai/providers/provider-settings-service";
import { KeysManager } from "./KeysManager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin System - Provider Keys",
  robots: { index: false, follow: false },
};

export default async function AdminKeysPage() {
  await requireAdminPageAccess();
  const settings = providerSettingsService.getSettingsDto();

  return (
    <AdminSection
      title="Provider Settings"
      description="Configure intelligence provider, optional capability providers, model settings, and API keys."
    >
      <div className="admin-route-stack">
        <KeysManager initialSettings={settings} />
      </div>
    </AdminSection>
  );
}
