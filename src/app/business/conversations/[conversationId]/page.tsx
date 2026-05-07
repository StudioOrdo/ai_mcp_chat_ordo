import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OrdoDetailLayout } from "@/components/ordo-details/OrdoDetailLayout";
import { getSessionUser } from "@/lib/auth";
import { loadBusinessConversationDetail } from "@/lib/ordo-details/load-business-object-detail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conversation Detail",
  robots: { index: false, follow: false },
};

export default async function BusinessConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const user = await getSessionUser();
  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const { conversationId } = await params;
  const detail = await loadBusinessConversationDetail(user, conversationId);
  if (!detail) {
    notFound();
  }

  return <OrdoDetailLayout detail={detail} />;
}
