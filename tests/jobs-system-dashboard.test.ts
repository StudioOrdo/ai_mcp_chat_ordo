import { describe, expect, it, vi, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

function fileExists(relativePath: string): boolean {
  return existsSync(join(process.cwd(), relativePath));
}

// ── Top-level hoisted mocks ────────────────────────────────────────────

const mockJobQueueDataMapper = vi.hoisted(() => ({
  listForAdmin: vi.fn(),
  countForAdmin: vi.fn(),
  countByStatus: vi.fn(),
  countByToolName: vi.fn(),
  listEventsForJob: vi.fn(),
  findJobById: vi.fn(),
  cancelJob: vi.fn(),
  createJob: vi.fn(),
}));

const mockPlatformInteractionFacade = vi.hoisted(() => ({
  listJobInteractionsForAdmin: vi.fn(),
  getJobInteraction: vi.fn(),
}));

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getJobQueueDataMapper: () => mockJobQueueDataMapper,
  getPlatformInteractionFacade: () => mockPlatformInteractionFacade,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── D5.1: JobQueueDataMapper admin methods ─────────────────────────────

describe("JobQueueDataMapper admin methods", () => {
  it("listForAdmin builds dynamic WHERE from status and toolName", () => {
    const source = readSource("src/adapters/JobQueueDataMapper.ts");
    expect(source).toContain("listForAdmin");
    expect(source).toContain("countForAdmin");
    expect(source).toContain("countByStatus");
    expect(source).toContain("countByToolName");
    expect(source).toContain("listEventsForJob");
  });

  it("countByStatus uses GROUP BY to return record mapping", () => {
    const source = readSource("src/adapters/JobQueueDataMapper.ts");
    expect(source).toMatch(/GROUP BY.*status/i);
  });

  it("countByToolName uses GROUP BY on tool_name", () => {
    const source = readSource("src/adapters/JobQueueDataMapper.ts");
    expect(source).toMatch(/GROUP BY.*tool_name/i);
  });
});

// ── D5.1: Job list loader (filters, view models) ──────────────────────

describe("job list loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatformInteractionFacade.getJobInteraction.mockImplementation(async (jobId: string) => ({
      timeline: { state: "active", supportLevel: "full", summary: null, events: [], artifacts: [], nextActions: [] },
      revision: { state: "unavailable", supportLevel: "none", summary: null, actions: [] },
      snapshot: { part: { jobId } },
    }));
    mockJobQueueDataMapper.countForAdmin.mockResolvedValue(2);
    mockJobQueueDataMapper.countByStatus.mockResolvedValue({ queued: 1, running: 1 });
    mockJobQueueDataMapper.countByToolName.mockResolvedValue({ produce_blog_article: 2 });
    mockJobQueueDataMapper.listForAdmin.mockResolvedValue([
      {
        id: "job_1", toolName: "produce_blog_article", status: "queued", priority: 5,
        userId: "usr_1", progressPercent: null, progressLabel: null,
        attemptCount: 1, createdAt: "2024-01-01", startedAt: null,
        completedAt: null, conversationId: "conv_1",
      },
      {
        id: "job_2", toolName: "produce_blog_article", status: "running", priority: 3,
        userId: "usr_2", progressPercent: 50, progressLabel: "Writing",
        attemptCount: 1, createdAt: "2024-01-02", startedAt: "2024-01-02T00:01:00Z",
        completedAt: null, conversationId: "conv_2",
      },
    ]);
  });

  it("parseAdminJobFilters extracts status, family, and toolName", async () => {
    const { parseAdminJobFilters } = await import("@/lib/admin/jobs/admin-jobs");
    const filters = parseAdminJobFilters({ status: "queued", family: "editorial", toolName: "produce_blog_article" });
    expect(filters.status).toBe("queued");
    expect(filters.family).toBe("editorial");
    expect(filters.toolName).toBe("produce_blog_article");
  });

  it("parseAdminJobFilters defaults to all status when empty", async () => {
    const { parseAdminJobFilters } = await import("@/lib/admin/jobs/admin-jobs");
    const filters = parseAdminJobFilters({});
    expect(filters.status).toBe("all");
    expect(filters.family).toBe("all");
    expect(filters.toolName).toBe("");
  });

  it("loadAdminJobList returns view model with counts and mapped entries", async () => {
    const { loadAdminJobList } = await import("@/lib/admin/jobs/admin-jobs");
    const result = await loadAdminJobList({});

    expect(result.total).toBe(2);
    expect(result.statusCounts).toEqual({ queued: 1, running: 1 });
    expect(result.toolNameCounts).toEqual({ produce_blog_article: 2 });
    expect(result.familyCounts).toEqual(expect.objectContaining({ editorial: 2, media: 0 }));
    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0].toolLabel).toBe("Produce Blog Article");
    expect(result.jobs[0].toolFamily).toBe("editorial");
    expect(result.jobs[0].detailHref).toContain("/admin/jobs/job_1");
    expect(result.jobs[1].duration).toBe("running");
    expect(result.jobs[1].canCancel).toBe(true);
  });
});

// ── D5.1: Job detail loader ────────────────────────────────────────────

describe("job detail loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatformInteractionFacade.getJobInteraction.mockResolvedValue({
      timeline: { state: "active", supportLevel: "full", summary: null, events: [], artifacts: [], nextActions: [] },
      revision: { state: "unavailable", supportLevel: "none", summary: null, actions: [] },
      snapshot: { part: { jobId: "job_1" } },
    });
  });

  it("returns detail view model for existing job", async () => {
    mockJobQueueDataMapper.findJobById.mockResolvedValue({
      id: "job_1", toolName: "publish_content", status: "succeeded", priority: 5,
      userId: "usr_1", progressPercent: 100, progressLabel: "Done",
      attemptCount: 1, createdAt: "2024-01-01", startedAt: "2024-01-01T00:01:00Z",
      completedAt: "2024-01-01T00:02:00Z", conversationId: "conv_1",
      requestPayload: { slug: "test" }, resultPayload: { url: "/test" },
      errorMessage: null, dedupeKey: null, initiatorType: "user",
      claimedBy: "worker_1", leaseExpiresAt: null,
    });
    mockJobQueueDataMapper.listEventsForJob.mockResolvedValue([
      { id: "evt_1", eventType: "queued", payload: {}, createdAt: "2024-01-01" },
    ]);

    const { loadAdminJobDetail } = await import("@/lib/admin/jobs/admin-jobs");
    const detail = await loadAdminJobDetail("job_1");

    expect(detail.job.id).toBe("job_1");
    expect(detail.job.toolLabel).toBe("Publish Content");
    expect(detail.job.requestPayload).toEqual({ slug: "test" });
    expect(detail.policy.canManage).toBe(true);
    expect(detail.events).toHaveLength(1);
    expect(detail.events[0].eventType).toBe("queued");
  });

  it("calls notFound for missing job", async () => {
    mockJobQueueDataMapper.findJobById.mockResolvedValue(null);

    const { loadAdminJobDetail } = await import("@/lib/admin/jobs/admin-jobs");
    await expect(loadAdminJobDetail("job_missing")).rejects.toThrow("notFound");
    expect(notFoundMock).toHaveBeenCalled();
  });
});

// ── D5.2: Jobs admin route helpers ─────────────────────────────────────

describe("admin-jobs-routes", () => {
  it("generates list and detail paths", async () => {
    const { getAdminJobsListPath, getAdminJobsDetailPath, getAdminJobsExportPath } = await import(
      "@/lib/admin/jobs/admin-jobs-routes"
    );
    expect(getAdminJobsListPath()).toBe("/admin/jobs");
    expect(getAdminJobsDetailPath("job_1")).toBe("/admin/jobs/job_1");
    expect(getAdminJobsExportPath("job_1")).toBe("/api/admin/jobs/job_1/export");
  });
});

// ── D5.3: Cancel and retry actions ─────────────────────────────────────

describe("cancel and retry actions structure", () => {
  it("cancelJobAction is an explicit server action using runAdminAction", () => {
    const source = readSource("src/lib/admin/jobs/admin-jobs-actions.ts");
    expect(source).toContain('"use server"');
    expect(source).toContain("cancelJobAction");
    expect(source).toContain("runAdminAction");
    expect(source).toContain("cancelJob");
    expect(source).toContain('revalidatePath("/admin/jobs")');
  });

  it("retryJobAction validates retriable statuses before creating new job", () => {
    const source = readSource("src/lib/admin/jobs/admin-jobs-actions.ts");
    expect(source).toContain("retryJobAction");
    expect(source).toContain("RETRIABLE_STATUSES");
    expect(source).toContain("ensureGlobalManagePermission");
    expect(source).toContain("performManualJobReplay");
  });

  it("requeueJobAction performs an audited queue reset for running or queued jobs", () => {
    const source = readSource("src/lib/admin/jobs/admin-jobs-actions.ts");
    expect(source).toContain("requeueJobAction");
    expect(source).toContain("REQUEUEABLE_STATUSES");
    expect(source).toContain('eventType: "requeued"');
    expect(source).toContain('status: "queued"');
  });
});

// ── D5.3: Bulk cancel and retry actions ────────────────────────────────

describe("bulk cancel and retry actions structure", () => {
  it("bulkCancelJobsAction processes comma-separated IDs and only cancels cancelable statuses", () => {
    const source = readSource("src/lib/admin/jobs/admin-jobs-actions.ts");
    expect(source).toContain("bulkCancelJobsAction");
    expect(source).toContain("CANCELABLE_STATUSES");
    expect(source).toMatch(/split.*,/);
  });

  it("bulkRetryJobsAction processes comma-separated IDs and only retries retriable statuses", () => {
    const source = readSource("src/lib/admin/jobs/admin-jobs-actions.ts");
    expect(source).toContain("bulkRetryJobsAction");
    expect(source).toContain("RETRIABLE_STATUSES");
  });

  it("bulkRequeueJobsAction processes comma-separated IDs and only requeues queued or running jobs", () => {
    const source = readSource("src/lib/admin/jobs/admin-jobs-actions.ts");
    expect(source).toContain("bulkRequeueJobsAction");
    expect(source).toContain("REQUEUEABLE_STATUSES");
  });
});

// ── D5.4: Jobs Browse page ─────────────────────────────────────────────

describe("Jobs Browse page structure", () => {
  it("renders AdminSection with filters, status counts, and bulk table", () => {
    const source = readSource("src/app/admin/jobs/page.tsx");
    expect(source).toContain("AdminSection");
    expect(source).toContain("AdminBrowseFilters");
    expect(source).toContain("AdminStatusCounts");
    expect(source).toContain("JobsTableClient");
    expect(source).toContain("AdminEmptyState");
    expect(source).toContain("loadAdminJobList");
    expect(source).toContain('dynamic = "force-dynamic"');
  });

  it("includes JobsRefreshTrigger for auto-refresh without full SSE", () => {
    const source = readSource("src/app/admin/jobs/page.tsx");
    expect(source).toContain("JobsRefreshTrigger");
    // The trigger is a client component that calls router.refresh
    const trigger = readSource("src/components/admin/JobsRefreshTrigger.tsx");
    expect(trigger).toContain('"use client"');
    expect(trigger).toContain("useRouter");
    expect(trigger).toContain("refresh()");
  });
});

// ── D5.5: Jobs Detail page ─────────────────────────────────────────────

describe("Jobs Detail page structure", () => {
  it("renders AdminDetailShell with payload JSON and event timeline", () => {
    const source = readSource("src/app/admin/jobs/[id]/page.tsx");
    expect(source).toContain("AdminDetailShell");
    expect(source).toContain("loadAdminJobDetail");
    expect(source).toContain("Request payload");
    expect(source).toContain("Event timeline");
    expect(source).toContain("JSON.stringify");
  });

  it("shows cancel and retry action buttons based on job status", () => {
    const source = readSource("src/app/admin/jobs/[id]/page.tsx");
    expect(source).toContain("cancelJobAction");
    expect(source).toContain("requeueJobAction");
    expect(source).toContain("retryJobAction");
    expect(source).toContain("canCancel");
    expect(source).toContain("canRequeue");
    expect(source).toContain("canRetry");
    expect(source).toContain("Export log");
    expect(source).toContain("Capability policy");
  });
});

describe("Sprint 4 notification and migration closure", () => {
  it("records both notification_sent and notification_failed audit events in the worker", () => {
    const source = readSource("src/lib/jobs/deferred-job-worker.ts");
    expect(source).toContain('eventType: "notification_sent"');
    expect(source).toContain('eventType: "notification_failed"');
    expect(source).toContain("terminalEventType");
  });

  it("keeps audit-only job events aligned with the current durable job status", () => {
    const source = readSource("src/lib/jobs/job-event-stream.ts");
    expect(source).toContain("buildJobPublication(job, event, renderableEvent)");
    expect(source).toContain("publicationToStreamEvent(publication, job, { sequence: event.sequence })");
    expect(source).toContain("isRenderableJobEventType(event.eventType)");
  });

  it("tracks Sprint 4 in the sprint index and QA script", () => {
    const sprintIndex = readSource("docs/_archive/_specs/job-operations-and-resilience/sprints/README.md");
    const qaScript = readSource("scripts/run-sprint-4-qa.ts");

    expect(fileExists("docs/_archive/_specs/job-operations-and-resilience/sprints/sprint-4-notification-migration-and-qa-closure.md")).toBe(true);
    expect(sprintIndex).toContain("Sprint 4");
    expect(qaScript).toContain("tests/browser-ui/jobs-page.spec.ts");
    expect(qaScript).toContain("tests/browser-ui/push-notifications.spec.ts");
    expect(qaScript).toContain("release evidence regeneration");
  });
});

// ── D5.6: JobsPagePanel monolith deleted ───────────────────────────────

describe("JobsPagePanel monolith deletion", () => {
  it("JobsPagePanel.tsx no longer exists", () => {
    expect(fileExists("src/components/jobs/JobsPagePanel.tsx")).toBe(false);
  });

  it("/jobs route now renders the signed-in workspace instead of redirecting to admin", () => {
    const source = readSource("src/app/jobs/page.tsx");
    expect(source).toContain("loadUserJobsWorkspace");
    expect(source).toContain("<JobsWorkspace");
    expect(source).toContain('redirect("/login")');
    expect(source).not.toContain('redirect("/admin/jobs")');
    // No import of the deleted monolith component
    expect(source).not.toMatch(/from\s+["'].*JobsPagePanel/);
  });
});

// ── D5.7: System page sections ─────────────────────────────────────────

describe("System page configuration sections", () => {
  it("renders 5 configuration sections with AdminCard", () => {
    const source = readSource("src/app/admin/system/page.tsx");
    expect(source).toContain("Health status");
    expect(source).toContain("Provider configuration");
    expect(source).toContain("Capability providers");
    expect(source).toContain("Registered tools");  // Section 4
    expect(source).toContain("Active workers");     // Section 5
  });

  it("reports effective provider diagnostics instead of raw environment variables", () => {
    const source = readSource("src/app/admin/system/page.tsx");
    expect(source).toContain("getProviderDiagnosticsReport");
    expect(source).toContain("providerDiagnostics.intelligence");
    expect(source).toContain("providerDiagnostics.capabilities");
    expect(source).not.toContain("redactValue");
    expect(source).not.toContain("process.env.ANTHROPIC_MODEL");
    expect(source).not.toContain("process.env.OPENAI_API_KEY");
  });

  it("reads tool registry and groups by category", () => {
    const source = readSource("src/app/admin/system/page.tsx");
    expect(source).toContain("getToolComposition");
    expect(source).toContain("registry.getToolNames");
    expect(source).toContain("toolsByCategory");
  });
});

// ── D5.8: Dashboard signal cards ───────────────────────────────────────

describe("Dashboard signal card wiring", () => {
  it("calls the smaller cross-workspace loader set via Promise.allSettled", () => {
    const source = readSource("src/app/admin/page.tsx");
    expect(source).toContain("Promise.allSettled");
    expect(source).toContain("loadSystemHealthBlock");
    expect(source).toContain("loadLeadQueueBlock");
    expect(source).toContain("loadConsultationRequestQueueBlock");
    expect(source).toContain("loadTrainingPathQueueBlock");
    expect(source).toContain("loadOverdueFollowUpsBlock");
    expect(source).toContain("loadRoutingReviewBlock");
    expect(source).toContain("loadAnonymousOpportunitiesBlock");
    expect(source).toContain("loadRecurringPainThemesBlock");
    expect(source).toContain("loadAdminJournalList");
    expect(source).toContain("loadAdminJobList");
  });

  it("renders graceful fallback for failed signals", () => {
    const source = readSource("src/app/admin/page.tsx");
    expect(source).toContain("Data unavailable");
    expect(source).toContain("unavailableCard");
    // Each result checks fulfilled status
    expect(source).toMatch(/\.status === "fulfilled"/);
  });

  it("uses the system second-column workspace layout", () => {
    const source = readSource("src/app/admin/page.tsx");
    expect(source).toContain("shell-governance-grid");
    expect(source).toContain("data-admin-system-workspace");
    expect(source).toContain("data-admin-system-selection-column");
    expect(source).toContain("data-admin-system-main-column");
    expect(source).toContain("ADMIN_DASHBOARD_SECTIONS");
    expect(source).toContain("resolveAdminSectionId");
  });
});

// ── D5.8: Dashboard action chips ───────────────────────────────────────

describe("Dashboard action chips", () => {
  it("overview cards link into their owning workspaces", () => {
    const source = readSource("src/app/admin/page.tsx");
    expect(source).toContain("SectionLink");
    expect(source).toContain('href="/admin/system"');
    expect(source).toContain("getAdminLeadsListPath");
    expect(source).toContain("getAdminJournalListPath");
    expect(source).toContain("getAdminJobsListPath");
    expect(source).toContain('href="/admin/conversations"');
  });

  it("dashboard exposes the new cross-workspace overview cards", () => {
    const source = readSource("src/app/admin/page.tsx");
    expect(source).toContain('href: "/admin?section=system-health"');
    expect(source).toContain('href: "/admin?section=pipeline"');
    expect(source).toContain('href: "/admin?section=conversations"');
    expect(source).toContain('href: "/admin?section=content"');
    expect(source).toContain('href: "/admin?section=jobs"');
    expect(source).toContain("Pipeline attention");
    expect(source).toContain("Conversation attention");
    expect(source).toContain("Content operations");
    expect(source).toContain("Jobs health");
  });
});

// ── D5.8: Overdue follow-ups loader ────────────────────────────────────

describe("Overdue follow-ups loader", () => {
  it("keeps operator compatibility while moving implementation to the cross-feature pipeline slice", () => {
    const operatorSource = readSource("src/lib/operator/loaders/admin-queue-loaders.ts");
    const pipelineSource = readSource("src/lib/admin/pipeline/admin-pipeline-attention.ts");

    expect(operatorSource).toContain("loadOverdueFollowUpsBlock");
    expect(operatorSource).toContain("@/lib/admin/pipeline/admin-pipeline-attention");
    expect(pipelineSource).toContain("overdue_follow_ups");
  });

  it("reads overdue follow-ups through the lead and deal repository seams", () => {
    const source = readSource("src/lib/admin/pipeline/admin-pipeline-attention.ts");
    expect(source).toContain("getLeadRecordDataMapper");
    expect(source).toContain("getDealRecordDataMapper");
    expect(source).toContain("listOverdueFollowUps");
  });
});

// ── D5.9: Navigation configuration ────────────────────────────────────

describe("admin navigation configuration", () => {
  it("all 9 nav items are set to live status", () => {
    const source = readSource("src/lib/admin/admin-navigation.ts");

    // Count occurrences of 'status: "live"' — should be 9
    const liveMatches = source.match(/status:\s*"live"/g) ?? [];
    expect(liveMatches.length).toBe(9);

    // No preview items remain in the config array (the type definition still defines the union)
    const configBlock = source.slice(source.indexOf("ADMIN_NAV_CONFIG"));
    const statusMatches = configBlock.match(/status:\s*"preview"/g) ?? [];
    expect(statusMatches.length).toBe(0);

    // Verify all expected route IDs present
    expect(source).toContain("admin-dashboard");
    expect(source).toContain("admin-users");
    expect(source).toContain("admin-leads");
    expect(source).toContain("admin-affiliates");
    expect(source).toContain("journal-admin");
    expect(source).toContain("admin-prompts");
    expect(source).toContain("admin-conversations");
    expect(source).toContain("admin-jobs");
    expect(source).toContain("admin-system");
  });
});
