import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityItem } from "@/lib/activity";

const {
  getSessionUserMock,
  listUserActivityMock,
  listUserInboxActivityMock,
  redirectMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  listUserActivityMock: vi.fn(),
  listUserInboxActivityMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getActivityReadModel: () => ({
    listUserActivity: listUserActivityMock,
    listUserInboxActivity: listUserInboxActivityMock,
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import ActivityPage from "@/app/activity/page";

function activity(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: "job:job_1",
    sourceKind: "job",
    sourceId: "job_1",
    userId: "usr_1",
    roleVisibility: ["AUTHENTICATED"],
    bucket: "needs_attention",
    severity: "warning",
    title: "Fix failed render",
    summary: "Provider failed.",
    statusLabel: "Failed",
    sourceStatus: "failed",
    href: "/jobs?jobId=job_1",
    primaryAction: {
      id: "open_job",
      label: "Open work",
      href: "/jobs?jobId=job_1",
      tone: "primary",
    },
    secondaryActions: [],
    createdAt: "2026-05-04T10:00:00.000Z",
    updatedAt: "2026-05-04T10:01:00.000Z",
    dedupeKey: "job:job_1",
    receipt: {
      readAt: null,
      acknowledgedAt: null,
      dismissedAt: null,
      pinnedAt: null,
      updatedAt: null,
    },
    ...overrides,
  };
}

describe("/activity page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUserActivityMock.mockResolvedValue({
      items: [activity()],
      pageInfo: {
        page: 1,
        limit: 20,
        total: 1,
        hasNextPage: false,
        nextPage: null,
      },
    });
    listUserInboxActivityMock.mockResolvedValue({
      items: [activity()],
      unreadCount: 1,
      pageInfo: {
        page: 1,
        limit: 20,
        total: 1,
        hasNextPage: false,
        nextPage: null,
      },
    });
  });

  it("redirects anonymous visitors to login", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_anon",
      email: "anon@example.com",
      name: "Anon",
      roles: ["ANONYMOUS"],
    });

    await expect(ActivityPage()).rejects.toThrow("redirect:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(listUserActivityMock).not.toHaveBeenCalled();
  });

  it("renders a signed-in user's activity ledger with query filters", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_1",
      email: "user@example.com",
      name: "User",
      roles: ["AUTHENTICATED"],
    });

    render(await ActivityPage({
      searchParams: Promise.resolve({
        bucket: "needs_attention",
        sourceKind: "job",
        page: "2",
        q: "provider",
      }),
    }));

    expect(listUserActivityMock).toHaveBeenCalledWith("usr_1", {
      bucket: "needs_attention",
      sourceKind: "job",
      page: 2,
      limit: 20,
      q: "provider",
      includeDismissed: false,
    });
    expect(screen.getByRole("heading", { name: "Full activity ledger" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search activity" })).toHaveValue("provider");
    expect(screen.getByText("Fix failed render")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open work" })).toHaveAttribute("href", "/jobs?jobId=job_1");
  });

  it("renders the durable inbox view with unread count and mark-all control", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_1",
      email: "user@example.com",
      name: "User",
      roles: ["AUTHENTICATED"],
    });

    render(await ActivityPage({
      searchParams: Promise.resolve({
        inbox: "true",
      }),
    }));

    expect(listUserInboxActivityMock).toHaveBeenCalledWith("usr_1", {
      bucket: undefined,
      sourceKind: undefined,
      page: 1,
      limit: 20,
      q: undefined,
      includeDismissed: false,
    });
    expect(screen.getByText("1 unread")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark inbox read" })).toBeInTheDocument();
  });

  it("shows an empty state for empty filtered ledgers", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_1",
      email: "user@example.com",
      name: "User",
      roles: ["AUTHENTICATED"],
    });
    listUserActivityMock.mockResolvedValue({
      items: [],
      pageInfo: {
        page: 1,
        limit: 20,
        total: 0,
        hasNextPage: false,
        nextPage: null,
      },
    });

    render(await ActivityPage());

    expect(screen.getByText("No activity for this view")).toBeInTheDocument();
  });
});
