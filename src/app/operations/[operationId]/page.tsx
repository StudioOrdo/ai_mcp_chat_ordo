import type { Metadata } from "next";

import { OperationDetailWorkspace } from "@/components/operations/OperationDetailWorkspace";
import { requireOperationsWorkspaceAccess } from "@/lib/operations/operations-access";
import { loadOperationDetailWorkspace } from "@/lib/operations/operation-workspace-loader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operation Detail",
  robots: { index: false, follow: false },
};

export default async function OperationDetailPage({
  params,
}: {
  params: Promise<{ operationId: string }>;
}) {
  const user = await requireOperationsWorkspaceAccess();
  const { operationId } = await params;
  const detail = await loadOperationDetailWorkspace(user, operationId);

  return <OperationDetailWorkspace detail={detail} />;
}
