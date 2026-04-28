import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const {
  requireJournalWorkspaceAccessMock,
  loadJournalAttributionMock,
} = vi.hoisted(() => ({
  requireJournalWorkspaceAccessMock: vi.fn(),
  loadJournalAttributionMock: vi.fn(),
}));

vi.mock("@/lib/journal/admin-journal", () => ({
  requireJournalWorkspaceAccess: requireJournalWorkspaceAccessMock,
}));

vi.mock("@/lib/admin/attribution/admin-attribution", () => ({
  loadJournalAttribution: loadJournalAttributionMock,
}));

vi.mock("@/lib/journal/admin-journal-routes", () => ({
  getAdminJournalAttributionPath: () => "/admin/journal/attribution",
  getAdminJournalDetailPath: (id: string) => `/admin/journal/${id}`,
  getAdminJournalListPath: () => "/admin/journal",
}));

import AttributionPage from "@/app/admin/journal/attribution/page";

describe("AttributionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireJournalWorkspaceAccessMock.mockResolvedValue({ id: "admin_1", roles: ["ADMIN"] });
  });

  it("renders the Content Attribution heading", async () => {
    loadJournalAttributionMock.mockResolvedValue([]);

    const jsx = await AttributionPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByText("Content Attribution")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
    expect(screen.getByLabelText("After")).toBeInTheDocument();
    expect(screen.getByLabelText("Before")).toBeInTheDocument();
  });

  it("renders empty state when no entries exist", async () => {
    loadJournalAttributionMock.mockResolvedValue([]);

    const jsx = await AttributionPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByText("No attribution data yet")).toBeInTheDocument();
  });

  it("renders attribution table with entries", async () => {
    loadJournalAttributionMock.mockResolvedValue([
      {
        postId: "post_1",
        postTitle: "AI Strategy Guide",
        postSlug: "ai-strategy",
        publishedAt: "2024-06-15",
        conversationsSourced: 10,
        leadsGenerated: 4,
        dealsGenerated: 2,
        estimatedRevenue: 5000,
      },
    ]);

    const jsx = await AttributionPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByText("AI Strategy Guide")).toBeInTheDocument();
    expect(screen.getByText("2024-06-15")).toBeInTheDocument();
    expect(screen.getAllByText("$5,000")).toHaveLength(2); // row + totals
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("enforces admin access", async () => {
    requireJournalWorkspaceAccessMock.mockRejectedValue(new Error("redirect:/"));
    loadJournalAttributionMock.mockResolvedValue([]);

    await expect(
      AttributionPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("redirect:/");
  });

  it("passes date filters from search params", async () => {
    loadJournalAttributionMock.mockResolvedValue([]);

    const jsx = await AttributionPage({
      searchParams: Promise.resolve({ after: "2024-01-01", before: "2024-06-30" }),
    });
    render(jsx);

    expect(loadJournalAttributionMock).toHaveBeenCalledWith({
      afterDate: "2024-01-01",
      beforeDate: "2024-06-30",
    });
  });
});
