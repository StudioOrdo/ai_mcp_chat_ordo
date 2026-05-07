import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AdminSystemWorkspaceData } from "@/lib/admin/system/load-admin-system-workspace";

vi.mock("@/app/admin/system/backups/BackupSelfServiceManager", () => ({
  BackupSelfServiceManager: ({ initialView }: { initialView?: string }) => (
    <div data-testid="backup-manager">{initialView}</div>
  ),
}));

import { AdminSystemWorkspace } from "./AdminSystemWorkspace";

function workspace(overrides: Partial<AdminSystemWorkspaceData> = {}): AdminSystemWorkspaceData {
  const sections = [
    "overview",
    "health",
    "providers",
    "tools",
    "capabilities",
    "visibility",
    "prompts",
    "backups",
    "restore-plans",
    "jobs",
    "operations",
    "logs",
    "keys",
  ].map((id) => ({
    id,
    title: id === "restore-plans"
      ? "Restore Plans"
      : id.replaceAll("-", " ").replace(/\b\w/g, (value) => value.toUpperCase()),
    summary: `${id} summary`,
    href: `/admin/system?section=${id}`,
    targetHref: id === "jobs"
      ? "/admin/jobs"
      : id === "tools"
        ? "/admin/system/tools"
        : null,
    targetLabel: id === "jobs"
      ? "Open jobs page"
      : id === "tools"
        ? "Open tools page"
        : null,
    statusLabel: id === "jobs" ? "Review" : null,
    countLabel: id === "jobs" ? "2" : null,
    iconLabel: id.slice(0, 1).toUpperCase(),
  })) as AdminSystemWorkspaceData["sections"];

  return {
    query: { sectionId: null, q: null },
    brief: {
      id: "admin-system-brief",
      sectionId: "admin-system",
      status: "limited",
      title: "System Brief",
      summary: "Admin-only governance view.",
      bullets: ["System health is degraded."],
      recommendedAction: { label: "Review System Health", href: "/admin/system?section=health" },
      evidenceRefs: [],
      limitations: [],
    },
    summary: {
      warningCount: 1,
      healthStatus: "degraded",
      providerReady: true,
      unavailableCapabilities: 0,
      toolCount: 2,
      protectedToolCount: 1,
      toolWarningCount: 0,
      backupWarningCount: 0,
      backupCount: 1,
      restorePlanCount: 1,
      queuedJobs: 1,
      runningJobs: 0,
      failedJobs: 1,
      retryableJobs: 1,
    },
    sections,
    selectedSection: null,
    diagnostics: {
      health: null,
      providers: null,
      backups: {} as AdminSystemWorkspaceData["diagnostics"]["backups"],
      jobs: {
        filters: { status: "all", family: "all", toolName: "" },
        statusCounts: { queued: 1, running: 0, failed: 1 },
        familyCounts: {},
        toolNameCounts: {},
        familyOptions: [],
        toolOptions: [],
        total: 2,
        jobs: [
          {
            id: "job_1",
            toolName: "create_appliance_backup",
            toolLabel: "Create Appliance Backup",
            toolFamily: "system",
            toolFamilyLabel: "System",
            defaultSurface: "global",
            executionPrincipal: "system_worker",
            status: "failed",
            priority: 0,
            userName: null,
            conversationTitle: null,
            progressPercent: null,
            progressLabel: null,
            attemptCount: 2,
            createdAt: "2026-05-06T00:00:00.000Z",
            startedAt: null,
            completedAt: null,
            detailHref: "/admin/jobs/job_1",
            duration: null,
            canManage: true,
            canCancel: false,
            canRequeue: false,
            canRetry: true,
            interactionExecutionState: "failed",
            interactionTimelineSupportLevel: "supported",
            interactionTimelineSummary: null,
            interactionTimelineEventCount: 0,
            interactionRevisionSupportLevel: "unsupported",
            interactionRevisionState: "unsupported",
            interactionRevisionSummary: null,
            interactionRevisionActionCount: 0,
          },
        ],
      },
    },
    loadErrors: [],
    ...overrides,
  };
}

describe("AdminSystemWorkspace", () => {
  it("renders the System Brief and all required second-column sections", () => {
    render(<AdminSystemWorkspace workspace={workspace()} />);

    expect(screen.getByRole("heading", { name: "System Brief" })).toBeInTheDocument();
    const selector = screen.getByLabelText("System sections");

    for (const label of [
      "Overview",
      "Health",
      "Providers",
      "Tools",
      "Capabilities",
      "Visibility",
      "Prompts",
      "Backups",
      "Restore Plans",
      "Jobs",
      "Operations",
      "Logs",
      "Keys",
    ]) {
      expect(within(selector).getByRole("link", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("renders backup controls inside the Backups System section", () => {
    const model = workspace();
    const selectedSection = model.sections.find((section) => section.id === "backups") ?? null;

    render(
      <AdminSystemWorkspace
        workspace={{ ...model, query: { sectionId: "backups", q: null }, selectedSection }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Backups" })).toBeInTheDocument();
    expect(screen.getByTestId("backup-manager")).toHaveTextContent("backups");
  });

  it("renders destructive restore-plan controls inside the Restore Plans section", () => {
    const model = workspace();
    const selectedSection = model.sections.find((section) => section.id === "restore-plans") ?? null;

    render(
      <AdminSystemWorkspace
        workspace={{ ...model, query: { sectionId: "restore-plans", q: null }, selectedSection }}
      />,
    );

    expect(screen.getByText("Restore is destructive.")).toBeInTheDocument();
    expect(screen.getByTestId("backup-manager")).toHaveTextContent("restore-plans");
  });

  it("renders admin queue diagnostics inside the Jobs System section", () => {
    const model = workspace();
    const selectedSection = model.sections.find((section) => section.id === "jobs") ?? null;

    render(
      <AdminSystemWorkspace
        workspace={{ ...model, query: { sectionId: "jobs", q: null }, selectedSection }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Jobs" })).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Retryable")).toBeInTheDocument();
    expect(screen.getByText("Create Appliance Backup")).toBeInTheDocument();
  });

  it("renders tool diagnostics and links to the System Tools page", () => {
    const model = workspace({
      diagnostics: {
        ...workspace().diagnostics,
        providers: {
          intelligence: {
            provider: "anthropic",
            providerSource: "env",
            model: "claude-test",
            modelSource: "env",
            apiKeyConfigured: true,
            apiKeySource: "env",
            baseUrlConfigured: false,
            baseUrlSource: "missing",
            warningCodes: [],
          },
          capabilities: [],
          toolSummary: {
            total: 2,
            byState: { enabled: 2 },
            protectedCount: 1,
            staticLockedCount: 0,
            providerGatedCount: 1,
            warnings: 0,
          },
        },
      },
    });
    const selectedSection = model.sections.find((section) => section.id === "tools") ?? null;

    render(
      <AdminSystemWorkspace
        workspace={{ ...model, query: { sectionId: "tools", q: null }, selectedSection }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Tools" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open tools page" })).toHaveAttribute("href", "/admin/system/tools");
    expect(screen.getByText("Catalog Tools")).toBeInTheDocument();
    expect(screen.getByText("Protected")).toBeInTheDocument();
  });
});
