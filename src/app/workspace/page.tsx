import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { parseUserDashboardQuery, UserDashboard } from "@/components/dashboard/UserDashboard";
import { getSessionUser } from "@/lib/auth";
import { loadUserDashboard } from "@/lib/dashboard/load-user-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today",
  robots: { index: false, follow: false },
};

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const user = await getSessionUser();

  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const rawSearchParams = searchParams ? await searchParams : {};
  const dashboard = await loadUserDashboard(user.id);
  const query = parseUserDashboardQuery(rawSearchParams);

  return <UserDashboard userName={user.name} dashboard={dashboard} query={query} />;
}
