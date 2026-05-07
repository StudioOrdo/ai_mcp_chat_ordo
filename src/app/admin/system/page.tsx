import type { Metadata } from "next";

import { AdminSystemWorkspace } from "@/components/admin/system/AdminSystemWorkspace";
import { loadAdminSystemWorkspace } from "@/lib/admin/system/load-admin-system-workspace";
import { requireAdminPageAccess } from "@/lib/journal/admin-journal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin System",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminSystemPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
} = {}) {
  const user = await requireAdminPageAccess();
  const rawSearchParams = searchParams ? await searchParams : {};
  const workspace = await loadAdminSystemWorkspace(user, rawSearchParams);

  return <AdminSystemWorkspace workspace={workspace} />;
}
