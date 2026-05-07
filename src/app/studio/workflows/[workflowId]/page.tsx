import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OrdoDetailLayout } from "@/components/ordo-details/OrdoDetailLayout";
import { getSessionUser } from "@/lib/auth";
import { loadStudioWorkflowDetail } from "@/lib/ordo-details/load-studio-object-detail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workflow Detail",
  robots: { index: false, follow: false },
};

export default async function StudioWorkflowDetailPage({
  params,
}: {
  params: Promise<{ workflowId: string }>;
}) {
  const user = await getSessionUser();
  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const { workflowId } = await params;
  const detail = await loadStudioWorkflowDetail(user, workflowId);
  if (!detail) {
    notFound();
  }

  return <OrdoDetailLayout detail={detail} />;
}
