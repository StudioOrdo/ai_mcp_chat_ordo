import type { Metadata } from "next";

import { OperationsWorkspace } from "@/components/operations/OperationsWorkspace";
import { requireOperationsWorkspaceAccess } from "@/lib/operations/operations-access";
import { loadOperationsWorkspace } from "@/lib/operations/operation-workspace-loader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operations",
  robots: { index: false, follow: false },
};

export default async function OperationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const user = await requireOperationsWorkspaceAccess();
  const workspace = await loadOperationsWorkspace(user, searchParams ? await searchParams : {});

  return <OperationsWorkspace workspace={workspace} />;
}
