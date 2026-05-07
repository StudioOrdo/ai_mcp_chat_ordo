import type { Metadata } from "next";

import { AdminSection } from "@/components/admin/AdminSection";
import { SystemOperationsManager } from "@/components/admin/system/SystemOperationsManager";
import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import { loadAdminSystemOperations } from "@/lib/operations/operation-workspace-loader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin System Operations",
  robots: { index: false, follow: false },
};

export default async function AdminSystemOperationsPage() {
  const user = await requireAdminPageAccess();
  const workspace = await loadAdminSystemOperations(user);

  return (
    <AdminSection
      title="System Operations"
      description="Appliance operation health, high-risk actions, and durable evidence for system work."
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "System", href: "/admin/system" },
        { label: "Operations" },
      ]}
    >
      <SystemOperationsManager workspace={workspace} />
    </AdminSection>
  );
}
