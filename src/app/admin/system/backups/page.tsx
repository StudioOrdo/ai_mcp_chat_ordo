import type { Metadata } from "next";

import { getBackupSelfService } from "@/adapters/RepositoryFactory";
import { AdminSection } from "@/components/admin/AdminSection";
import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import { BackupSelfServiceManager } from "./BackupSelfServiceManager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Backups",
  robots: { index: false, follow: false },
};

export default async function AdminSystemBackupsPage() {
  await requireAdminPageAccess();
  const dashboard = await getBackupSelfService().getDashboard();

  return (
    <AdminSection
      title="Backups"
      description="Create backups, inspect restore readiness, and safely queue governed restore work."
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "System", href: "/admin/system" },
        { label: "Backups" },
      ]}
    >
      <BackupSelfServiceManager dashboard={dashboard} />
    </AdminSection>
  );
}
