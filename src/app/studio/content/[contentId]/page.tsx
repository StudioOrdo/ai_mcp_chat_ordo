import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OrdoDetailLayout } from "@/components/ordo-details/OrdoDetailLayout";
import { getSessionUser } from "@/lib/auth";
import { loadStudioContentDetail } from "@/lib/ordo-details/load-studio-object-detail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Content Detail",
  robots: { index: false, follow: false },
};

export default async function StudioContentDetailPage({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const user = await getSessionUser();
  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const { contentId } = await params;
  const detail = await loadStudioContentDetail(user, contentId);
  if (!detail) {
    notFound();
  }

  return <OrdoDetailLayout detail={detail} />;
}
