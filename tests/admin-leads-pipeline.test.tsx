/**
 * Sprint 3 — Leads Pipeline
 *
 * Tests for D3.1‑D3.7: DataMapper extensions, loaders, actions,
 * workflows, Browse page, and Detail page.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────

const {
  requireAdminPageAccessMock,
  notFoundMock,
  revalidatePathMock,
  // Lead mapper
  leadListForAdminMock,
  leadCountForAdminMock,
  leadCountByTriageStateMock,
  leadFindByIdMock,
  leadListOverdueFollowUpsMock,
  leadUpdateFollowUpMock,
  leadUpdateTriageStateMock,
  // Consultation mapper
  crListForAdminMock,
  crCountForAdminMock,
  crCountByStatusMock,
  crFindByIdMock,
  crFindByConversationIdMock,
  crUpdateStatusMock,
  // Deal mapper
  dealListForAdminMock,
  dealCountForAdminMock,
  dealCountByStatusMock,
  dealFindByIdMock,
  dealFindByLeadRecordIdMock,
  dealListOverdueFollowUpsMock,
  dealUpdateFollowUpMock,
  dealUpdateStatusMock,
  // Training mapper
  trainingListForAdminMock,
  trainingCountForAdminMock,
  trainingCountByStatusMock,
  trainingFindByIdMock,
  trainingUpdateStatusMock,
  // Loader mock
  loadAdminLeadsPipelineMock,
  loadAdminPipelineDetailMock,
  loadLeadQueueBlockMock,
  loadConsultationRequestQueueBlockMock,
  loadTrainingPathQueueBlockMock,
  loadOverdueFollowUpsBlockMock,
  // DB mock for follow_up_at
  getDbMock,
} = vi.hoisted(() => ({
  requireAdminPageAccessMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("notFound");
  }),
  revalidatePathMock: vi.fn(),
  leadListForAdminMock: vi.fn(),
  leadCountForAdminMock: vi.fn(),
  leadCountByTriageStateMock: vi.fn(),
  leadFindByIdMock: vi.fn(),
  leadListOverdueFollowUpsMock: vi.fn(),
  leadUpdateFollowUpMock: vi.fn(),
  leadUpdateTriageStateMock: vi.fn(),
  crListForAdminMock: vi.fn(),
  crCountForAdminMock: vi.fn(),
  crCountByStatusMock: vi.fn(),
  crFindByIdMock: vi.fn(),
  crFindByConversationIdMock: vi.fn(),
  crUpdateStatusMock: vi.fn(),
  dealListForAdminMock: vi.fn(),
  dealCountForAdminMock: vi.fn(),
  dealCountByStatusMock: vi.fn(),
  dealFindByIdMock: vi.fn(),
  dealFindByLeadRecordIdMock: vi.fn(),
  dealListOverdueFollowUpsMock: vi.fn(),
  dealUpdateFollowUpMock: vi.fn(),
  dealUpdateStatusMock: vi.fn(),
  trainingListForAdminMock: vi.fn(),
  trainingCountForAdminMock: vi.fn(),
  trainingCountByStatusMock: vi.fn(),
  trainingFindByIdMock: vi.fn(),
  trainingUpdateStatusMock: vi.fn(),
  loadAdminLeadsPipelineMock: vi.fn(),
  loadAdminPipelineDetailMock: vi.fn(),
  loadLeadQueueBlockMock: vi.fn(),
  loadConsultationRequestQueueBlockMock: vi.fn(),
  loadTrainingPathQueueBlockMock: vi.fn(),
  loadOverdueFollowUpsBlockMock: vi.fn(),
  getDbMock: vi.fn(),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/journal/admin-journal", () => ({
  requireAdminPageAccess: requireAdminPageAccessMock,
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getLeadRecordDataMapper: () => ({
    listForAdmin: leadListForAdminMock,
    countForAdmin: leadCountForAdminMock,
    countByTriageState: leadCountByTriageStateMock,
    findById: leadFindByIdMock,
    listOverdueFollowUps: leadListOverdueFollowUpsMock,
    updateFollowUp: leadUpdateFollowUpMock,
    updateTriageState: leadUpdateTriageStateMock,
  }),
  getConsultationRequestDataMapper: () => ({
    listForAdmin: crListForAdminMock,
    countForAdmin: crCountForAdminMock,
    countByStatus: crCountByStatusMock,
    findById: crFindByIdMock,
    findByConversationId: crFindByConversationIdMock,
    updateStatus: crUpdateStatusMock,
  }),
  getDealRecordDataMapper: () => ({
    listForAdmin: dealListForAdminMock,
    countForAdmin: dealCountForAdminMock,
    countByStatus: dealCountByStatusMock,
    findById: dealFindByIdMock,
    findByLeadRecordId: dealFindByLeadRecordIdMock,
    listOverdueFollowUps: dealListOverdueFollowUpsMock,
    updateFollowUp: dealUpdateFollowUpMock,
    updateStatus: dealUpdateStatusMock,
  }),
  getTrainingPathRecordDataMapper: () => ({
    listForAdmin: trainingListForAdminMock,
    countForAdmin: trainingCountForAdminMock,
    countByStatus: trainingCountByStatusMock,
    findById: trainingFindByIdMock,
    updateStatus: trainingUpdateStatusMock,
  }),
}));

vi.mock("@/lib/admin/leads/admin-leads", () => ({
  loadAdminLeadsPipeline: loadAdminLeadsPipelineMock,
  loadAdminPipelineDetail: loadAdminPipelineDetailMock,
}));

vi.mock("@/lib/admin/leads/admin-leads-attention", () => ({
  loadLeadQueueBlock: loadLeadQueueBlockMock,
  loadConsultationRequestQueueBlock: loadConsultationRequestQueueBlockMock,
  loadTrainingPathQueueBlock: loadTrainingPathQueueBlockMock,
}));

vi.mock("@/lib/admin/pipeline/admin-pipeline-attention", () => ({
  loadOverdueFollowUpsBlock: loadOverdueFollowUpsBlockMock,
}));

vi.mock("@/lib/operator/loaders/admin-loaders", () => ({}));

// ── Imports under test ─────────────────────────────────────────────────

import {
  parseTriageForm,
  parseConsultationStatusForm,
  parseDealStatusForm,
  parseTrainingStatusForm,
  parseFollowUpForm,
  parseBulkTriageForm,
  LEAD_TRIAGE_OPTIONS,
  CONSULTATION_STATUS_OPTIONS,
  DEAL_STATUS_OPTIONS,
  TRAINING_STATUS_OPTIONS,
} from "@/lib/admin/leads/admin-leads-actions";
import {
  LEAD_TRIAGE_WORKFLOW,
  CONSULTATION_WORKFLOW,
  DEAL_WORKFLOW,
  TRAINING_WORKFLOW,
} from "@/lib/admin/leads/admin-leads-workflows";
import { getWorkflowActions } from "@/lib/admin/shared/admin-workflow";
import {
  getAdminLeadsListPath,
  getAdminLeadsDetailPath,
} from "@/lib/admin/leads/admin-leads-routes";
import AdminLeadsPage from "@/app/admin/leads/page";
import AdminLeadsDetailPage from "@/app/admin/leads/[id]/page";

// ── Helper to build FormData ───────────────────────────────────────────

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    fd.set(k, v);
  }
  return fd;
}

// ── D3.3 — Routes ──────────────────────────────────────────────────────

describe("D3.3 — admin leads routes", () => {
  it("returns /admin/leads for list path", () => {
    expect(getAdminLeadsListPath()).toBe("/admin/leads");
  });

  it("returns detail path with id", () => {
    expect(getAdminLeadsDetailPath("lead_abc")).toBe("/admin/leads/lead_abc");
  });
});

// ── D3.5 — Workflows ──────────────────────────────────────────────────

describe("D3.5 — workflow configs", () => {
  it("lead triage workflow allows new→contacted", () => {
    const actions = getWorkflowActions("new", LEAD_TRIAGE_WORKFLOW);
    expect(actions.map((a) => a.nextStatus)).toContain("contacted");
    expect(actions.map((a) => a.nextStatus)).toContain("qualified");
    expect(actions.map((a) => a.nextStatus)).toContain("deferred");
  });

  it("lead triage workflow blocks qualified→new", () => {
    const actions = getWorkflowActions("qualified", LEAD_TRIAGE_WORKFLOW);
    expect(actions.map((a) => a.nextStatus)).not.toContain("new");
  });

  it("consultation workflow allows pending→reviewed/scheduled/declined", () => {
    const actions = getWorkflowActions("pending", CONSULTATION_WORKFLOW);
    const targets = actions.map((a) => a.nextStatus);
    expect(targets).toEqual(expect.arrayContaining(["reviewed", "scheduled", "declined"]));
  });

  it("deal workflow allows draft→qualified/on_hold/declined", () => {
    const actions = getWorkflowActions("draft", DEAL_WORKFLOW);
    const targets = actions.map((a) => a.nextStatus);
    expect(targets).toContain("qualified");
    expect(targets).toContain("on_hold");
    expect(targets).toContain("declined");
  });

  it("deal workflow blocks agreed→draft (no rollback)", () => {
    const actions = getWorkflowActions("agreed", DEAL_WORKFLOW);
    expect(actions.map((a) => a.nextStatus)).not.toContain("draft");
  });

  it("training workflow allows recommended→screening_requested", () => {
    const actions = getWorkflowActions("recommended", TRAINING_WORKFLOW);
    expect(actions.map((a) => a.nextStatus)).toContain("screening_requested");
  });

  it("training workflow closed has no transitions", () => {
    const actions = getWorkflowActions("closed", TRAINING_WORKFLOW);
    expect(actions).toHaveLength(0);
  });
});

// ── D3.4 — Form parsers ───────────────────────────────────────────────

describe("D3.4 — form parsers", () => {
  it("parseTriageForm accepts valid triage state", () => {
    const result = parseTriageForm(makeFormData({ triageState: "contacted" }));
    expect(result.triageState).toBe("contacted");
  });

  it("parseTriageForm rejects invalid state", () => {
    expect(() => parseTriageForm(makeFormData({ triageState: "invalid" }))).toThrow();
  });

  it("parseTriageForm includes founderNote when provided", () => {
    const result = parseTriageForm(makeFormData({ triageState: "qualified", founderNote: "Good lead" }));
    expect(result.founderNote).toBe("Good lead");
  });

  it("parseConsultationStatusForm accepts valid status", () => {
    const result = parseConsultationStatusForm(makeFormData({ status: "reviewed" }));
    expect(result.status).toBe("reviewed");
  });

  it("parseConsultationStatusForm rejects invalid status", () => {
    expect(() => parseConsultationStatusForm(makeFormData({ status: "fake" }))).toThrow();
  });

  it("parseDealStatusForm accepts estimate_ready", () => {
    const result = parseDealStatusForm(makeFormData({ status: "estimate_ready" }));
    expect(result.status).toBe("estimate_ready");
  });

  it("parseDealStatusForm rejects invalid status", () => {
    expect(() => parseDealStatusForm(makeFormData({ status: "won" }))).toThrow();
  });

  it("parseTrainingStatusForm accepts screening_requested", () => {
    const result = parseTrainingStatusForm(makeFormData({ status: "screening_requested" }));
    expect(result.status).toBe("screening_requested");
  });

  it("parseTrainingStatusForm rejects invalid status", () => {
    expect(() => parseTrainingStatusForm(makeFormData({ status: "active" }))).toThrow();
  });

  it("parseFollowUpForm returns date string", () => {
    const result = parseFollowUpForm(makeFormData({ followUpAt: "2025-03-15" }));
    expect(result.followUpAt).toBe("2025-03-15");
  });

  it("parseBulkTriageForm splits comma-separated IDs", () => {
    const result = parseBulkTriageForm(makeFormData({ ids: "lead_1,lead_2,lead_3", triageState: "contacted" }));
    expect(result.ids).toEqual(["lead_1", "lead_2", "lead_3"]);
    expect(result.triageState).toBe("contacted");
  });

  it("parseBulkTriageForm rejects empty IDs", () => {
    expect(() => parseBulkTriageForm(makeFormData({ ids: "", triageState: "contacted" }))).toThrow();
  });

  it("parseBulkTriageForm rejects invalid triage state", () => {
    expect(() => parseBulkTriageForm(makeFormData({ ids: "lead_1", triageState: "bogus" }))).toThrow();
  });
});

// ── D3.4 — Status option arrays ────────────────────────────────────────

describe("D3.4 — status option arrays", () => {
  it("LEAD_TRIAGE_OPTIONS has 4 options", () => {
    expect(LEAD_TRIAGE_OPTIONS).toHaveLength(4);
    expect(LEAD_TRIAGE_OPTIONS.map((o) => o.value)).toEqual(["new", "contacted", "qualified", "deferred"]);
  });

  it("CONSULTATION_STATUS_OPTIONS has 4 options", () => {
    expect(CONSULTATION_STATUS_OPTIONS).toHaveLength(4);
  });

  it("DEAL_STATUS_OPTIONS has 6 options", () => {
    expect(DEAL_STATUS_OPTIONS).toHaveLength(6);
  });

  it("TRAINING_STATUS_OPTIONS has 5 options", () => {
    expect(TRAINING_STATUS_OPTIONS).toHaveLength(5);
  });
});

// ── D3.6 — Browse page rendering ──────────────────────────────────────

describe("D3.6 — leads Browse page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageAccessMock.mockResolvedValue({ id: "admin_1", roles: ["ADMIN"] });
  });

  it("renders pipeline title and description", async () => {
    loadAdminLeadsPipelineMock.mockResolvedValue({
      activeTab: "leads",
      pipelineCounts: { leads: 5, consultations: 3, deals: 2, training: 1 },
      tabData: {
        tab: "leads",
        total: 0,
        statusFilter: "",
        statusCounts: { new: 0, contacted: 0, qualified: 0, deferred: 0 },
        entries: [],
      },
    });

    const jsx = await AdminLeadsPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByText("Leads Pipeline")).toBeInTheDocument();
    expect(requireAdminPageAccessMock).toHaveBeenCalled();
  });

  it("enforces admin access on Browse page", async () => {
    requireAdminPageAccessMock.mockRejectedValue(new Error("redirect:/"));
    await expect(
      AdminLeadsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("redirect:/");
  });

  it("renders empty state when no entries in active tab", async () => {
    loadAdminLeadsPipelineMock.mockResolvedValue({
      activeTab: "consultations",
      pipelineCounts: { leads: 0, consultations: 0, deals: 0, training: 0 },
      tabData: {
        tab: "consultations",
        total: 0,
        statusFilter: "",
        statusCounts: { pending: 0, reviewed: 0, scheduled: 0, declined: 0 },
        entries: [],
      },
    });

    const jsx = await AdminLeadsPage({ searchParams: Promise.resolve({ tab: "consultations" }) });
    render(jsx);

    expect(screen.getByText("No consultation requests yet.")).toBeInTheDocument();
  });

  it("renders tab links for all 4 pipeline tabs", async () => {
    loadAdminLeadsPipelineMock.mockResolvedValue({
      activeTab: "leads",
      pipelineCounts: { leads: 1, consultations: 0, deals: 0, training: 0 },
      tabData: {
        tab: "leads",
        total: 0,
        statusFilter: "",
        statusCounts: { new: 0, contacted: 0, qualified: 0, deferred: 0 },
        entries: [],
      },
    });

    const jsx = await AdminLeadsPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    const nav = screen.getByRole("navigation", { name: "Pipeline tabs" });
    expect(nav).toBeInTheDocument();
    expect(nav.textContent).toContain("Leads");
    expect(nav.textContent).toContain("Consultations");
    expect(nav.textContent).toContain("Deals");
    expect(nav.textContent).toContain("Training");
  });

  it("renders the attention workspace view with queue summaries", async () => {
    loadAdminLeadsPipelineMock.mockResolvedValue({
      activeTab: "leads",
      pipelineCounts: { leads: 5, consultations: 2, deals: 1, training: 3 },
      tabData: {
        tab: "leads",
        total: 0,
        statusFilter: "",
        statusCounts: { new: 0, contacted: 0, qualified: 0, deferred: 0 },
        entries: [],
      },
    });
    loadLeadQueueBlockMock.mockResolvedValue({
      data: {
        summary: {
          submittedLeadCount: 5,
          newLeadCount: 3,
          contactedLeadCount: 1,
          qualifiedLeadCount: 1,
          deferredLeadCount: 0,
        },
        leads: [
          {
            id: "lead_1",
            name: "Alex Founder",
            email: "alex@example.com",
            organization: "North Star",
            recommendedNextAction: "Book founder call",
            triageState: "new",
            submittedAt: "2026-03-31T12:00:00Z",
          },
        ],
        emptyReason: null,
      },
    });
    loadConsultationRequestQueueBlockMock.mockResolvedValue({
      data: {
        summary: { pendingCount: 2, reviewedCount: 1 },
        requests: [
          {
            id: "cr_1",
            conversationTitle: "Consultation Request",
            requestSummary: "Needs a founder session",
            founderNote: null,
            status: "pending",
          },
        ],
        emptyReason: null,
      },
    });
    loadTrainingPathQueueBlockMock.mockResolvedValue({
      data: {
        summary: {
          draftCount: 1,
          recommendedCount: 1,
          apprenticeshipCandidateCount: 0,
          followUpNowCount: 1,
        },
        trainingPaths: [
          {
            id: "training_1",
            primaryGoal: "Career transition",
            currentRoleOrBackground: null,
            recommendedPath: "operator_lab",
            nextAction: "Founder review",
            status: "draft",
          },
        ],
        emptyReason: null,
      },
    });
    loadOverdueFollowUpsBlockMock.mockResolvedValue({
      data: {
        summary: { overdueLeadCount: 1, overdueDealCount: 0, totalOverdueCount: 1 },
        oldestOverdueLead: {
          id: "lead_2",
          name: "Morgan Lead",
          followUpAt: "2026-03-29T09:00:00Z",
        },
        oldestOverdueDeal: null,
      },
    });

    const jsx = await AdminLeadsPage({ searchParams: Promise.resolve({ view: "attention" }) });
    render(jsx);

    expect(screen.getByRole("heading", { name: "Leads Pipeline" })).toBeInTheDocument();
    expect(screen.getByText("Submitted leads")).toBeInTheDocument();
    expect(screen.getByText("Consultation requests")).toBeInTheDocument();
    expect(screen.getByText("Training paths")).toBeInTheDocument();
    expect(screen.getByText("Overdue follow-ups")).toBeInTheDocument();
    expect(screen.getByText("Alex Founder")).toBeInTheDocument();
    expect(loadLeadQueueBlockMock).toHaveBeenCalledWith({ id: "admin_1", roles: ["ADMIN"] });
  });

  it("renders data table rows for leads tab entries", async () => {
    loadAdminLeadsPipelineMock.mockResolvedValue({
      activeTab: "leads",
      pipelineCounts: { leads: 1, consultations: 0, deals: 0, training: 0 },
      tabData: {
        tab: "leads",
        total: 1,
        statusFilter: "",
        statusCounts: { new: 1, contacted: 0, qualified: 0, deferred: 0 },
        entries: [
          {
            id: "lead_abc",
            name: "Test Lead",
            email: "test@example.com",
            organization: "Acme",
            lane: "individual",
            triageLabel: "New",
            isOverdue: false,
            createdLabel: "Jun 1, 2025",
            detailHref: "/admin/leads/lead_abc",
          },
        ],
      },
    });

    const jsx = await AdminLeadsPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getAllByText("Test Lead").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("test@example.com").length).toBeGreaterThanOrEqual(1);
  });
});

// ── D3.7 — Detail page rendering ──────────────────────────────────────

describe("D3.7 — leads Detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageAccessMock.mockResolvedValue({ id: "admin_1", roles: ["ADMIN"] });
  });

  it("renders lead detail with qualification fields", async () => {
    loadAdminPipelineDetailMock.mockResolvedValue({
      entityType: "lead",
      record: {
        id: "lead_abc",
        conversationId: "conv_1",
        lane: "individual",
        name: "Jane Doe",
        email: "jane@example.com",
        organization: "Acme Corp",
        roleOrTitle: "CTO",
        trainingGoal: "AI Ops",
        authorityLevel: "decision_maker",
        urgency: "immediate",
        budgetSignal: "confirmed",
        technicalEnvironment: "AWS",
        trainingFit: "advanced",
        problemSummary: "Needs automation help",
        recommendedNextAction: "Schedule call",
        captureStatus: "submitted",
        triageState: "new",
        founderNote: null,
        lastContactedAt: null,
        createdAt: "2025-06-01T00:00:00Z",
        updatedAt: "2025-06-01T00:00:00Z",
        submittedAt: "2025-06-01T00:00:00Z",
        triagedAt: null,
      },
      followUpAt: null,
      linkedConsultation: null,
      linkedDeal: null,
    });

    const jsx = await AdminLeadsDetailPage({ params: Promise.resolve({ id: "lead_abc" }) });
    render(jsx);

    expect(screen.getByText("Lead: Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("CTO")).toBeInTheDocument();
    expect(screen.getByText("Lead Qualification")).toBeInTheDocument();
  });

  it("enforces admin access on Detail page", async () => {
    requireAdminPageAccessMock.mockRejectedValue(new Error("redirect:/"));
    await expect(
      AdminLeadsDetailPage({ params: Promise.resolve({ id: "lead_abc" }) }),
    ).rejects.toThrow("redirect:/");
  });

  it("renders deal detail with pricing information", async () => {
    loadAdminPipelineDetailMock.mockResolvedValue({
      entityType: "deal",
      record: {
        id: "deal_xyz",
        conversationId: "conv_2",
        consultationRequestId: null,
        leadRecordId: "lead_abc",
        userId: "user_1",
        lane: "organization",
        title: "Enterprise Training",
        organizationName: "Big Corp",
        problemSummary: "Team upskilling",
        proposedScope: "3 modules",
        recommendedServiceType: "operator_intensive",
        estimatedHours: 40,
        estimatedTrainingDays: 5,
        estimatedPrice: 500000,
        status: "draft",
        nextAction: "Send proposal",
        assumptions: null,
        openQuestions: null,
        founderNote: null,
        customerResponseNote: null,
        createdAt: "2025-06-01T00:00:00Z",
        updatedAt: "2025-06-01T00:00:00Z",
      },
      followUpAt: null,
    });

    const jsx = await AdminLeadsDetailPage({ params: Promise.resolve({ id: "deal_xyz" }) });
    render(jsx);

    expect(screen.getByText("Deal: Enterprise Training")).toBeInTheDocument();
    expect(screen.getByText("Big Corp")).toBeInTheDocument();
    expect(screen.getByText("operator_intensive")).toBeInTheDocument();
  });

  it("renders consultation detail", async () => {
    loadAdminPipelineDetailMock.mockResolvedValue({
      entityType: "consultation",
      record: {
        id: "cr_abc",
        conversationId: "conv_3",
        userId: "user_1",
        lane: "organization",
        requestSummary: "Need assessment",
        status: "pending",
        founderNote: null,
        createdAt: "2025-06-01T00:00:00Z",
        updatedAt: "2025-06-01T00:00:00Z",
      },
    });

    const jsx = await AdminLeadsDetailPage({ params: Promise.resolve({ id: "cr_abc" }) });
    render(jsx);

    expect(screen.getByText("Consultation: cr_abc")).toBeInTheDocument();
    expect(screen.getByText("Need assessment")).toBeInTheDocument();
  });

  it("renders training detail", async () => {
    loadAdminPipelineDetailMock.mockResolvedValue({
      entityType: "training",
      record: {
        id: "training_xyz",
        conversationId: "conv_4",
        leadRecordId: null,
        consultationRequestId: null,
        userId: "user_1",
        lane: "individual",
        currentRoleOrBackground: "Junior Dev",
        technicalDepth: "intermediate",
        primaryGoal: "Career growth",
        preferredFormat: "mentorship",
        apprenticeshipInterest: "yes",
        recommendedPath: "mentorship_sprint",
        fitRationale: "Good background",
        customerSummary: "Eager learner",
        status: "recommended",
        nextAction: "Screen candidate",
        founderNote: null,
        createdAt: "2025-06-01T00:00:00Z",
        updatedAt: "2025-06-01T00:00:00Z",
      },
    });

    const jsx = await AdminLeadsDetailPage({ params: Promise.resolve({ id: "training_xyz" }) });
    render(jsx);

    expect(screen.getByText("Training Path: training_xyz")).toBeInTheDocument();
    expect(screen.getByText("Junior Dev")).toBeInTheDocument();
    expect(screen.getByText("Career growth")).toBeInTheDocument();
    expect(screen.getByText("mentorship_sprint")).toBeInTheDocument();
  });

  it("shows overdue warning when lead follow-up is past", async () => {
    loadAdminPipelineDetailMock.mockResolvedValue({
      entityType: "lead",
      record: {
        id: "lead_over",
        conversationId: "conv_1",
        lane: "individual",
        name: "Late Lead",
        email: "late@example.com",
        organization: null,
        roleOrTitle: null,
        trainingGoal: null,
        authorityLevel: null,
        urgency: null,
        budgetSignal: null,
        technicalEnvironment: null,
        trainingFit: null,
        problemSummary: null,
        recommendedNextAction: null,
        captureStatus: "submitted",
        triageState: "contacted",
        founderNote: null,
        lastContactedAt: null,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
        submittedAt: null,
        triagedAt: null,
      },
      followUpAt: "2024-01-01",
      linkedConsultation: null,
      linkedDeal: null,
    });

    const jsx = await AdminLeadsDetailPage({ params: Promise.resolve({ id: "lead_over" }) });
    render(jsx);

    expect(screen.getByText(/Follow-up overdue since/)).toBeInTheDocument();
  });

  it("renders linked consultation and deal in lead sidebar", async () => {
    loadAdminPipelineDetailMock.mockResolvedValue({
      entityType: "lead",
      record: {
        id: "lead_linked",
        conversationId: "conv_1",
        lane: "organization",
        name: "Linked Lead",
        email: "linked@example.com",
        organization: "Linked Corp",
        roleOrTitle: null,
        trainingGoal: null,
        authorityLevel: null,
        urgency: null,
        budgetSignal: null,
        technicalEnvironment: null,
        trainingFit: null,
        problemSummary: null,
        recommendedNextAction: null,
        captureStatus: "submitted",
        triageState: "qualified",
        founderNote: "Great prospect",
        lastContactedAt: "2025-05-15T00:00:00Z",
        createdAt: "2025-05-01T00:00:00Z",
        updatedAt: "2025-05-15T00:00:00Z",
        submittedAt: "2025-05-01T00:00:00Z",
        triagedAt: "2025-05-10T00:00:00Z",
      },
      followUpAt: null,
      linkedConsultation: {
        id: "cr_linked",
        conversationId: "conv_1",
        userId: "user_1",
        lane: "organization",
        requestSummary: "Assessment request",
        status: "reviewed",
        founderNote: null,
        createdAt: "2025-05-05T00:00:00Z",
        updatedAt: "2025-05-05T00:00:00Z",
      },
      linkedDeal: {
        id: "deal_linked",
        conversationId: "conv_1",
        consultationRequestId: "cr_linked",
        leadRecordId: "lead_linked",
        userId: "user_1",
        lane: "organization",
        title: "Linked Deal",
        organizationName: "Linked Corp",
        problemSummary: "Need help",
        proposedScope: "Full engagement",
        recommendedServiceType: "operator_intensive",
        estimatedHours: 20,
        estimatedTrainingDays: null,
        estimatedPrice: 250000,
        status: "qualified",
        nextAction: null,
        assumptions: null,
        openQuestions: null,
        founderNote: null,
        customerResponseNote: null,
        createdAt: "2025-05-10T00:00:00Z",
        updatedAt: "2025-05-10T00:00:00Z",
      },
    });

    const jsx = await AdminLeadsDetailPage({ params: Promise.resolve({ id: "lead_linked" }) });
    render(jsx);

    expect(screen.getByText("Assessment request")).toBeInTheDocument();
    expect(screen.getAllByText("Linked Deal").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Great prospect")).toBeInTheDocument();
  });
});

// ── QA Fix — nextStatus fallback in form parsers ───────────────────────

describe("QA Fix — nextStatus workflow bar fallback", () => {
  it("parseTriageForm accepts nextStatus when triageState is absent", () => {
    const result = parseTriageForm(makeFormData({ nextStatus: "contacted" }));
    expect(result.triageState).toBe("contacted");
  });

  it("parseTriageForm prefers triageState over nextStatus", () => {
    const result = parseTriageForm(makeFormData({ triageState: "qualified", nextStatus: "contacted" }));
    expect(result.triageState).toBe("qualified");
  });

  it("parseConsultationStatusForm accepts nextStatus fallback", () => {
    const result = parseConsultationStatusForm(makeFormData({ nextStatus: "scheduled" }));
    expect(result.status).toBe("scheduled");
  });

  it("parseDealStatusForm accepts nextStatus fallback", () => {
    const result = parseDealStatusForm(makeFormData({ nextStatus: "agreed" }));
    expect(result.status).toBe("agreed");
  });

  it("parseTrainingStatusForm accepts nextStatus fallback", () => {
    const result = parseTrainingStatusForm(makeFormData({ nextStatus: "recommended" }));
    expect(result.status).toBe("recommended");
  });
});

// ── QA Fix — bulk triage bulkAction fallback ───────────────────────────

describe("QA Fix — parseBulkTriageForm bulkAction fallback", () => {
  it("parseBulkTriageForm accepts bulkAction when triageState is absent", () => {
    const result = parseBulkTriageForm(makeFormData({ ids: "lead_1", bulkAction: "contacted" }));
    expect(result.triageState).toBe("contacted");
  });

  it("parseBulkTriageForm prefers triageState over bulkAction", () => {
    const result = parseBulkTriageForm(makeFormData({ ids: "lead_1", triageState: "deferred", bulkAction: "contacted" }));
    expect(result.triageState).toBe("deferred");
  });
});

// ── QA Fix — Detail page founder note editing form ─────────────────────

describe("QA Fix — founder note inline editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageAccessMock.mockResolvedValue({ id: "admin_1", roles: ["ADMIN"] });
  });

  it("renders editable textarea for lead founder note", async () => {
    loadAdminPipelineDetailMock.mockResolvedValue({
      entityType: "lead",
      record: {
        id: "lead_note",
        conversationId: "conv_1",
        lane: "individual",
        name: "Note Lead",
        email: "note@example.com",
        organization: null,
        roleOrTitle: null,
        trainingGoal: null,
        authorityLevel: null,
        urgency: null,
        budgetSignal: null,
        technicalEnvironment: null,
        trainingFit: null,
        problemSummary: null,
        recommendedNextAction: null,
        captureStatus: "submitted",
        triageState: "new",
        founderNote: "Existing note",
        lastContactedAt: null,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
        submittedAt: null,
        triagedAt: null,
      },
      followUpAt: null,
      linkedConsultation: null,
      linkedDeal: null,
    });

    const jsx = await AdminLeadsDetailPage({ params: Promise.resolve({ id: "lead_note" }) });
    render(jsx);

    const textarea = screen.getByDisplayValue("Existing note");
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(screen.getByText("Save note")).toBeInTheDocument();
  });

  it("renders editable textarea for deal founder note", async () => {
    loadAdminPipelineDetailMock.mockResolvedValue({
      entityType: "deal",
      record: {
        id: "deal_note",
        conversationId: "conv_1",
        consultationRequestId: null,
        leadRecordId: null,
        userId: "user_1",
        lane: "organization",
        title: "Note Deal",
        organizationName: "Corp",
        problemSummary: "Need help",
        proposedScope: "Scope",
        recommendedServiceType: "operator_intensive",
        estimatedHours: 10,
        estimatedTrainingDays: null,
        estimatedPrice: 100000,
        status: "draft",
        nextAction: null,
        assumptions: null,
        openQuestions: null,
        founderNote: "Deal note text",
        customerResponseNote: null,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      },
      followUpAt: null,
    });

    const jsx = await AdminLeadsDetailPage({ params: Promise.resolve({ id: "deal_note" }) });
    render(jsx);

    const textarea = screen.getByDisplayValue("Deal note text");
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");
  });
});
