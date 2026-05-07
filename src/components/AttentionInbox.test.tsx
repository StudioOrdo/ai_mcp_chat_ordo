import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttentionInbox } from "@/components/AttentionInbox";
import type { ActivityItem } from "@/lib/activity";

function activity(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: "job:job_failed",
    sourceKind: "job",
    sourceId: "job_failed",
    userId: "usr_1",
    roleVisibility: ["AUTHENTICATED"],
    bucket: "needs_attention",
    severity: "warning",
    title: "Fix failed render",
    summary: "Provider failed.",
    statusLabel: "Failed",
    sourceStatus: "failed",
    href: "/jobs?jobId=job_failed",
    primaryAction: {
      id: "open_job",
      label: "Open work",
      href: "/jobs?jobId=job_failed",
      tone: "primary",
    },
    secondaryActions: [],
    createdAt: "2026-05-04T10:00:00.000Z",
    updatedAt: "2026-05-04T10:01:00.000Z",
    dedupeKey: "job:job_failed",
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

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AttentionInbox", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue(jsonResponse({
      activity: [activity()],
      unreadCount: 1,
      pageInfo: {
        page: 1,
        limit: 8,
        total: 1,
        hasNextPage: false,
        nextPage: null,
      },
    }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("loads the durable attention inbox instead of hardcoded platform updates", async () => {
    render(<AttentionInbox user={{ id: "usr_1", roles: ["AUTHENTICATED"] }} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/activity?inbox=true&limit=8"));
    expect(await screen.findByText("1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open attention inbox" }));

    expect(screen.getByText("Fix failed render")).toBeInTheDocument();
    expect(screen.queryByText("Workspace search updated")).not.toBeInTheDocument();
    expect(screen.queryByText("Deferred job notifications routed")).not.toBeInTheDocument();
  });

  it("marks the inbox read without deleting activity", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        activity: [activity()],
        unreadCount: 1,
        pageInfo: {
          page: 1,
          limit: 8,
          total: 1,
          hasNextPage: false,
          nextPage: null,
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        activity: [activity({ receipt: {
          readAt: "2026-05-04T12:00:00.000Z",
          acknowledgedAt: null,
          dismissedAt: null,
          pinnedAt: null,
          updatedAt: "2026-05-04T12:00:00.000Z",
        } })],
        unreadCount: 0,
        pageInfo: {
          page: 1,
          limit: 25,
          total: 1,
          hasNextPage: false,
          nextPage: null,
        },
      }));

    render(<AttentionInbox user={{ id: "usr_1", roles: ["AUTHENTICATED"] }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Open attention inbox" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/activity/receipts", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ action: "mark_read", inbox: true }),
    })));
    expect(await screen.findByText("Inbox marked read.")).toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.getByText("Fix failed render")).toBeInTheDocument();
  });
});
