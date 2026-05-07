import type { Metadata } from "next";

import { AdminSection } from "@/components/admin/AdminSection";
import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import { getToolAvailabilityService } from "@/lib/tools/tool-availability-service";
import { getToolComposition } from "@/lib/chat/tool-composition-root";
import { ToolsManager } from "./ToolsManager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Tool Settings",
  robots: { index: false, follow: false },
};

export default async function AdminSystemToolsPage() {
  await requireAdminPageAccess();
  const service = getToolAvailabilityService();
  const manifest = await service.getEffectiveManifestFromSettings();
  const bundles = getToolComposition().registry.getBundles().map((bundle) => ({
    id: bundle.id,
    displayName: bundle.displayName,
    toolNames: bundle.toolNames,
  }));

  return (
    <AdminSection
      title="Tool Settings"
      description="Runtime tool availability, operator locks, provider gates, and protected recovery tools."
    >
      <ToolsManager initialManifest={manifest} bundles={bundles} />
    </AdminSection>
  );
}
