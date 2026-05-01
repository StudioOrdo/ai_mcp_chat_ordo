import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminPageAccessMock,
  loadAdminJobDetailMock,
  cancelJobActionMock,
  requeueJobActionMock,
  retryJobActionMock,
} = vi.hoisted(() => ({
  requireAdminPageAccessMock: vi.fn(),
  loadAdminJobDetailMock: vi.fn(),
  cancelJobActionMock: vi.fn(),
  requeueJobActionMock: vi.fn(),
  retryJobActionMock: vi.fn(),
}));

vi.mock("@/lib/journal/admin-journal", () => ({
  requireAdminPageAccess: requireAdminPageAccessMock,
}));

vi.mock("@/lib/admin/jobs/admin-jobs", () => ({
  loadAdminJobDetail: loadAdminJobDetailMock,
}));

vi.mock("@/lib/admin/jobs/admin-jobs-actions", () => ({
  cancelJobAction: cancelJobActionMock,
  requeueJobAction: requeueJobActionMock,
  retryJobAction: retryJobActionMock,
}));

import AdminJobDetailPage from "@/app/admin/jobs/[id]/page";

function makeInteraction() {
  return {
    timeline: {
      state: "active",
      supportLevel: "full",
      summary: null,
      events: [],
      artifacts: [],
      nextActions: [],
    },
    revision: {
      state: "unavailable",
      supportLevel: "none",
      summary: null,
      actions: [],
    },
  };
}

describe("/admin/jobs/[id] page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageAccessMock.mockResolvedValue({
      id: "admin_1",
      email: "admin@example.com",
      name: "Admin",
      roles: ["ADMIN"],
    });
  });

  it("renders running job detail with cancel controls", async () => {
    loadAdminJobDetailMock.mockResolvedValue({
      job: {
        id: "job_running",
        toolName: "produce_blog_article",
        toolLabel: "Produce Blog Article",
        toolFamily: "editorial",
        toolFamilyLabel: "Editorial",
        defaultSurface: "global",
        status: "running",
        priority: 100,
        userName: "editor_1",
        conversationTitle: null,
        progressPercent: 64,
        progressLabel: "Drafting",
        attemptCount: 1,
        createdAt: "2026-03-31T10:00:00.000Z",
        startedAt: "2026-03-31T10:01:00.000Z",
        completedAt: null,
        detailHref: "/admin/jobs/job_running",
        duration: "running",
        requestPayload: { brief: "Roadmap" },
        resultPayload: null,
        errorMessage: null,
        dedupeKey: "brief_1",
        initiatorType: "user",
        claimedBy: "worker_1",
        leaseExpiresAt: null,
        failureClass: null,
        nextRetryAt: null,
        recoveryMode: "rerun",
        canManage: true,
        canCancel: true,
        canRetry: false,
      },
      policy: {
        canManage: true,
        canCancel: true,
        canRequeue: true,
        canRetry: false,
        retryMode: "automatic",
        maxAttempts: 3,
        backoffStrategy: "fixed",
        baseDelayMs: 3000,
        retryExhausted: false,
      },
      capabilityPolicy: {
        description: "Run the full editorial production pipeline from composition through draft persistence.",
        executionPrincipal: "system_worker",
        executionAllowedRoles: ["ADMIN"],
        globalViewerRoles: ["ADMIN"],
        globalActionRoles: ["ADMIN"],
        resultRetention: "retain",
        artifactPolicy: "open_artifact",
      },
      events: [
        {
          id: "evt_1",
          eventType: "started",
          eventPayload: { worker: "worker_1" },
          createdAt: "2026-03-31T10:01:00.000Z",
        },
      ],
      interaction: makeInteraction(),
    });

    render(await AdminJobDetailPage({ params: Promise.resolve({ id: "job_running" }) }));

    expect(requireAdminPageAccessMock).toHaveBeenCalled();
    expect(loadAdminJobDetailMock).toHaveBeenCalledWith("job_running", ["ADMIN"]);
    expect(screen.getByRole("heading", { name: "Produce Blog Article" })).toBeInTheDocument();
    expect(screen.getByText("Request payload")).toBeInTheDocument();
    expect(screen.getByText("Event timeline (1)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel job" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Requeue job" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Export log" })).toHaveAttribute("href", "/api/admin/jobs/job_running/export");
    expect(screen.getByText("Capability policy")).toBeInTheDocument();
    expect(screen.getByText("System worker")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry job" })).toBeNull();
  });

  it("renders failed job detail with retry controls and error details", async () => {
    loadAdminJobDetailMock.mockResolvedValue({
      job: {
        id: "job_failed",
        toolName: "publish_content",
        toolLabel: "Publish Content",
        toolFamily: "editorial",
        toolFamilyLabel: "Editorial",
        defaultSurface: "global",
        status: "failed",
        priority: 80,
        userName: null,
        conversationTitle: null,
        progressPercent: null,
        progressLabel: null,
        attemptCount: 2,
        createdAt: "2026-03-31T09:00:00.000Z",
        startedAt: "2026-03-31T09:01:00.000Z",
        completedAt: "2026-03-31T09:02:30.000Z",
        detailHref: "/admin/jobs/job_failed",
        duration: "1.5m",
        requestPayload: { post_id: "post_1" },
        resultPayload: null,
        errorMessage: "Publish target missing.",
        dedupeKey: null,
        initiatorType: "user",
        claimedBy: null,
        leaseExpiresAt: null,
        failureClass: "transient",
        nextRetryAt: null,
        recoveryMode: "rerun",
        canManage: true,
        canCancel: false,
        canRetry: true,
      },
      policy: {
        canManage: true,
        canCancel: false,
        canRequeue: false,
        canRetry: true,
        retryMode: "automatic",
        maxAttempts: 3,
        backoffStrategy: "fixed",
        baseDelayMs: 3000,
        retryExhausted: true,
      },
      capabilityPolicy: {
        description: "Publish an editorial draft and align any linked hero assets for public visibility.",
        executionPrincipal: "system_worker",
        executionAllowedRoles: ["ADMIN"],
        globalViewerRoles: ["ADMIN"],
        globalActionRoles: ["ADMIN"],
        resultRetention: "retain",
        artifactPolicy: "open_artifact",
      },
      events: [],
      interaction: makeInteraction(),
    });

    render(await AdminJobDetailPage({ params: Promise.resolve({ id: "job_failed" }) }));

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Publish target missing.")).toBeInTheDocument();
    expect(screen.getByText("Resilience state")).toBeInTheDocument();
    expect(screen.getAllByText(/Automatic retry/).length).toBeGreaterThan(0);
    expect(screen.getByText("Automatic retries are exhausted for this job. Manual replay is still available.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Export log" })).toHaveAttribute("href", "/api/admin/jobs/job_failed/export");
    expect(screen.getByRole("button", { name: "Retry job" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel job" })).toBeNull();
    expect(screen.getByText("Anonymous / system")).toBeInTheDocument();
  });
});
