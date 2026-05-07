import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OrdoDetailLayout } from "@/components/ordo-details/OrdoDetailLayout";
import { getSessionUser } from "@/lib/auth";
import { loadBusinessPersonDetail } from "@/lib/ordo-details/load-business-object-detail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Person Detail",
  robots: { index: false, follow: false },
};

export default async function BusinessPersonDetailPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const user = await getSessionUser();
  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const { personId } = await params;
  const detail = await loadBusinessPersonDetail(user, personId);
  if (!detail) {
    notFound();
  }

  return <OrdoDetailLayout detail={detail} />;
}
