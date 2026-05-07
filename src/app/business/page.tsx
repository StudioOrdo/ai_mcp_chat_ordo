import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BusinessWorkspace } from "@/components/business/BusinessWorkspace";
import { getSessionUser } from "@/lib/auth";
import { loadBusinessWorkspace } from "@/lib/business/load-business-workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "People",
  robots: { index: false, follow: false },
};

export default async function BusinessPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const user = await getSessionUser();

  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const rawSearchParams = searchParams ? await searchParams : {};
  const workspace = await loadBusinessWorkspace(user.id, rawSearchParams);

  return <BusinessWorkspace userName={user.name} workspace={workspace} />;
}
