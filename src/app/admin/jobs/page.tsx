import type { Metadata } from "next";

import { AdminSection } from "@/components/admin/AdminSection";
import { AdminStatusCounts } from "@/components/admin/AdminStatusCounts";
import { AdminBrowseFilters } from "@/components/admin/AdminBrowseFilters";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { JobsTableClient } from "@/components/admin/JobsTableClient";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { JobsRefreshTrigger } from "@/components/admin/JobsRefreshTrigger";
import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import { loadAdminJobList } from "@/lib/admin/jobs/admin-jobs";
import { buildAdminPaginationParams } from "@/lib/admin/admin-pagination";
import {
  bulkCancelJobsAction,
  bulkRequeueJobsAction,
  bulkRetryJobsAction,
} from "@/lib/admin/jobs/admin-jobs-actions";
import { getAdminJobsListPath } from "@/lib/admin/jobs/admin-jobs-routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Jobs",
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Canceled",
};

const STATUS_ORDER = ["queued", "running", "succeeded", "failed", "canceled"];

function buildAdminJobsHref({
  status,
  family,
  toolName,
}: {
  status?: string;
  family?: string;
  toolName?: string;
}): string {
  const params = new URLSearchParams();

  if (status && status !== "all") {
    params.set("status", status);
  }

  if (family && family !== "all") {
    params.set("family", family);
  }

  if (toolName) {
    params.set("toolName", toolName);
  }

  const query = params.toString();
  return query ? `${getAdminJobsListPath()}?${query}` : getAdminJobsListPath();
}

async function handleBulkAction(formData: FormData) {
  "use server";
  const action = formData.get("bulkAction");
  if (action === "cancel") {
    await bulkCancelJobsAction(formData);
  } else if (action === "requeue") {
    await bulkRequeueJobsAction(formData);
  } else if (action === "retry") {
    await bulkRetryJobsAction(formData);
  }
}

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminPageAccess();
  const raw = await searchParams;
  const pagination = buildAdminPaginationParams(raw, 50);
  const listView = await loadAdminJobList(raw, admin.roles, pagination);

  const familyFilterOptions = listView.familyOptions.map((option) => ({
    value: option.value,
    label: `${option.label} (${option.count})`,
  }));

  const toolFilterOptions = listView.toolOptions.map((option) => ({
    value: option.value,
    label: `${option.label} (${option.count})`,
  }));

  const statusCounts = [
    {
      label: "All",
      count: listView.total,
      filterHref: buildAdminJobsHref({
        family: listView.filters.family,
        toolName: listView.filters.toolName,
      }),
      active: listView.filters.status === "all",
    },
    ...STATUS_ORDER.map((s) => ({
      label: STATUS_LABELS[s] ?? s,
      count: listView.statusCounts[s] ?? 0,
      filterHref: buildAdminJobsHref({
        status: s,
        family: listView.filters.family,
        toolName: listView.filters.toolName,
      }),
      active: listView.filters.status === s,
    })),
  ];

  return (
    <AdminSection
      title="Jobs"
      description="Platform job interactions. Browse execution, revision, and retry state for deferred jobs without leaving the admin queue."
    >
      <div className="admin-route-stack">
        <AdminStatusCounts items={statusCounts} />

        <AdminBrowseFilters
          fields={[
            {
              name: "family",
              label: "Family",
              type: "select",
              options: familyFilterOptions,
            },
            {
              name: "toolName",
              label: "Capability",
              type: "select",
              options: toolFilterOptions,
            },
          ]}
          values={{
            family: listView.filters.family === "all" ? "" : listView.filters.family,
            toolName: listView.filters.toolName,
          }}
        />

        {listView.jobs.length === 0 ? (
          <AdminEmptyState
            heading="No jobs found"
            description="No jobs match the current filters."
          />
        ) : (
          <JobsTableClient
            action={handleBulkAction}
            rows={listView.jobs as unknown as Record<string, unknown>[]}
          />
        )}
        <AdminPagination
          page={pagination.page}
          total={listView.total}
          pageSize={pagination.pageSize}
          baseHref={getAdminJobsListPath()}
        />
      </div>
      <JobsRefreshTrigger />
    </AdminSection>
  );
}
