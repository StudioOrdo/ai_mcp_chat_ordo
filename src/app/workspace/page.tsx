import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WorkspaceOverviewSurface } from "@/frameworks/ui/WorkspaceOverviewSurface";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Current Work",
  robots: { index: false, follow: false },
};

export default async function WorkspacePage() {
  const user = await getSessionUser();

  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  return <WorkspaceOverviewSurface />;
}