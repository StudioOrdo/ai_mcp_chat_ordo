import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import { getSessionUser } from "@/lib/auth";
import { loadStudioWorkspace } from "@/lib/studio/load-studio-workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};

export default async function StudioPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const user = await getSessionUser();

  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const rawSearchParams = searchParams ? await searchParams : {};
  const workspace = await loadStudioWorkspace(user.id, rawSearchParams);

  return <StudioWorkspace userName={user.name} workspace={workspace} />;
}
