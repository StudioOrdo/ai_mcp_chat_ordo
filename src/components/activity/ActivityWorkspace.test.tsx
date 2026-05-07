import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityItem } from "@/lib/activity";
import { ActivityWorkspace } from "@/components/activity/ActivityWorkspace";

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

function renderWorkspace(items: ActivityItem[], unreadCount = 1) {
  return render(
    <ActivityWorkspace
      initialResult={{
        items,
        unreadCount,
        pageInfo: {
          page: 1,
          limit: 20,
          total: items.length,
          hasNextPage: false,
          nextPage: null,
        },
      }}
      query={{
        page: 1,
        includeDismissed: false,
        inbox: true,
      }}
    />,
  );
}

describe("ActivityWorkspace", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("does not decrement unread count when an already-read item is pinned", async () => {
    const readItem = activity({
      id: "job:read",
      sourceId: "read",
      title: "Read output",
      receipt: {
        readAt: "2026-05-04T12:00:00.000Z",
        acknowledgedAt: null,
        dismissedAt: null,
        pinnedAt: null,
        updatedAt: "2026-05-04T12:00:00.000Z",
      },
    });
    const unreadItem = activity({
      id: "job:unread",
      sourceId: "unread",
      title: "Unread failed render",
    });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      activity: {
        ...readItem,
        receipt: {
          ...readItem.receipt,
          pinnedAt: "2026-05-04T12:05:00.000Z",
        },
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    renderWorkspace([readItem, unreadItem], 1);

    expect(screen.getByText("1 unread")).toBeInTheDocument();
    expect(screen.getByText("Read output")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Pin" })[0]);

    await waitFor(() => expect(screen.getByText("Activity receipt updated.")).toBeInTheDocument());
    expect(screen.getByText("1 unread")).toBeInTheDocument();
  });

  it("removes dismissed unread items from the view and decrements unread count", async () => {
    const unreadItem = activity({
      id: "job:unread",
      sourceId: "unread",
      title: "Unread failed render",
    });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      activity: {
        ...unreadItem,
        receipt: {
          ...unreadItem.receipt,
          readAt: "2026-05-04T12:00:00.000Z",
          dismissedAt: "2026-05-04T12:00:00.000Z",
        },
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    renderWorkspace([unreadItem], 1);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => expect(screen.getByText("Activity dismissed from this view.")).toBeInTheDocument());
    expect(screen.queryByText("1 unread")).toBeNull();
    expect(screen.getByText("Inbox is clear")).toBeInTheDocument();
  });
});
