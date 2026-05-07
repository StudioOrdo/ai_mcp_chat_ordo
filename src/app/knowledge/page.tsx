import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { KnowledgeBaseWorkspace } from "@/components/knowledge/KnowledgeBaseWorkspace";
import { getSessionUser } from "@/lib/auth";
import { loadKnowledgeBaseWorkspace } from "@/lib/knowledge/load-knowledge-base-workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Knowledge Base",
  robots: { index: false, follow: false },
};

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const user = await getSessionUser();

  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const rawSearchParams = searchParams ? await searchParams : {};
  const workspace = await loadKnowledgeBaseWorkspace(user, rawSearchParams);

  return <KnowledgeBaseWorkspace userName={user.name} workspace={workspace} />;
}
