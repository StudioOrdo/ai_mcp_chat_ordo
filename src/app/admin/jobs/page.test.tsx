import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminPageAccessMock,
  loadAdminJobListMock,
  buildAdminPaginationParamsMock,
  browseFiltersMock,
  statusCountsMock,
  paginationMock,
  jobsTableMock,
  emptyStateMock,
  refreshTriggerMock,
} = vi.hoisted(() => ({
  requireAdminPageAccessMock: vi.fn(),
  loadAdminJobListMock: vi.fn(),
  buildAdminPaginationParamsMock: vi.fn(),
  browseFiltersMock: vi.fn(({ values }: { values: Record<string, unknown> }) => (
    <div data-testid="browse-filters">{JSON.stringify(values)}</div>
  )),
  statusCountsMock: vi.fn(({ items }: { items: Array<{ count: number }> }) => (
    <div data-testid="status-counts">{items.map((item) => item.count).join(",")}</div>
  )),
  paginationMock: vi.fn(({ page, total, pageSize }: { page: number; total: number; pageSize: number }) => (
    <div data-testid="pagination">{page}:{total}:{pageSize}</div>
  )),
  jobsTableMock: vi.fn(({ rows }: { rows: unknown[] }) => (
    <div data-testid="jobs-table">{rows.length}</div>
  )),
  emptyStateMock: vi.fn(({ heading }: { heading: string }) => (
    <div data-testid="empty-state">{heading}</div>
  )),
  refreshTriggerMock: vi.fn(() => <div data-testid="jobs-refresh-trigger" />),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("@/lib/journal/admin-journal", () => ({
  requireAdminPageAccess: requireAdminPageAccessMock,
}));

vi.mock("@/lib/admin/jobs/admin-jobs", () => ({
  loadAdminJobList: loadAdminJobListMock,
}));

vi.mock("@/lib/admin/admin-pagination", () => ({
  buildAdminPaginationParams: buildAdminPaginationParamsMock,
}));

vi.mock("@/components/admin/AdminBrowseFilters", () => ({
  AdminBrowseFilters: browseFiltersMock,
}));

vi.mock("@/components/admin/AdminStatusCounts", () => ({
  AdminStatusCounts: statusCountsMock,
}));

vi.mock("@/components/admin/AdminPagination", () => ({
  AdminPagination: paginationMock,
}));

vi.mock("@/components/admin/JobsTableClient", () => ({
  JobsTableClient: jobsTableMock,
}));

vi.mock("@/components/admin/AdminEmptyState", () => ({
  AdminEmptyState: emptyStateMock,
}));

vi.mock("@/components/admin/JobsRefreshTrigger", () => ({
  JobsRefreshTrigger: refreshTriggerMock,
}));

import AdminJobsPage from "@/app/admin/jobs/page";

describe("/admin/jobs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageAccessMock.mockResolvedValue({
      id: "admin_1",
      email: "admin@example.com",
      name: "Admin",
      roles: ["ADMIN"],
    });
    buildAdminPaginationParamsMock.mockReturnValue({
      page: 2,
      pageSize: 50,
      limit: 50,
      offset: 50,
    });
  });

  it("renders the jobs table with current filters and counts", async () => {
    loadAdminJobListMock.mockResolvedValue({
      filters: { status: "running", family: "editorial", toolName: "produce_blog_article" },
      statusCounts: { queued: 1, running: 2, succeeded: 0, failed: 1, canceled: 0 },
      familyCounts: { editorial: 4 },
      toolNameCounts: { produce_blog_article: 3, publish_content: 1 },
      familyOptions: [{ value: "editorial", label: "Editorial", count: 4 }],
      toolOptions: [
        {
          value: "produce_blog_article",
          label: "Produce Blog Article",
          family: "editorial",
          familyLabel: "Editorial",
          count: 3,
        },
      ],
      total: 4,
      jobs: [{ id: "job_1" }, { id: "job_2" }],
    });

    render(await AdminJobsPage({ searchParams: Promise.resolve({ status: "running", page: "2" }) }));

    expect(requireAdminPageAccessMock).toHaveBeenCalled();
    expect(buildAdminPaginationParamsMock).toHaveBeenCalledWith({ status: "running", page: "2" }, 50);
    expect(loadAdminJobListMock).toHaveBeenCalledWith(
      { status: "running", page: "2" },
      ["ADMIN"],
      { page: 2, pageSize: 50, limit: 50, offset: 50 },
    );
    expect(screen.getByRole("heading", { name: "Jobs" })).toBeInTheDocument();
    expect(screen.getByTestId("browse-filters")).toHaveTextContent("editorial");
    expect(screen.getByTestId("browse-filters")).toHaveTextContent("produce_blog_article");
    expect(screen.getByTestId("status-counts")).toHaveTextContent("1,2,0,1,0");
    expect(screen.getByTestId("jobs-table")).toHaveTextContent("2");
    expect(screen.getByTestId("pagination")).toHaveTextContent("2:4:50");
    expect(screen.getByTestId("jobs-refresh-trigger")).toBeInTheDocument();
  });

  it("renders an empty state when no jobs match the filters", async () => {
    loadAdminJobListMock.mockResolvedValue({
      filters: { status: "all", family: "all", toolName: "" },
      statusCounts: { queued: 0, running: 0, succeeded: 0, failed: 0, canceled: 0 },
      familyCounts: {},
      toolNameCounts: {},
      familyOptions: [],
      toolOptions: [],
      total: 0,
      jobs: [],
    });

    render(await AdminJobsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId("empty-state")).toHaveTextContent("No jobs found");
    expect(jobsTableMock).not.toHaveBeenCalled();
  });
});