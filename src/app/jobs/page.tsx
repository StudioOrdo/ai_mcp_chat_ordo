import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { JobsWorkspace } from "@/components/jobs/JobsWorkspace";
import { getSessionUser } from "@/lib/auth";
import { loadUserJobsWorkspace } from "@/lib/jobs/load-user-jobs-workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jobs",
  robots: { index: false, follow: false },
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const user = await getSessionUser();

  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const rawSearchParams = searchParams ? await searchParams : {};
  const workspace = await loadUserJobsWorkspace(user.id, rawSearchParams);

  return (
    <JobsWorkspace
      userName={user.name}
      workflows={workspace.workflows}
      jobs={workspace.jobs}
      selectedJobId={workspace.selectedJobId}
      selectedJob={workspace.selectedJob}
      selectedJobHistory={workspace.selectedJobHistory}
      query={workspace.query}
      pageInfo={workspace.pageInfo}
    />
  );
}
