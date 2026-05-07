import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ActivityItem } from "@/lib/activity";
import type { UserDashboardData } from "@/lib/dashboard/load-user-dashboard";
import type { OrdoCard } from "@/lib/ordo-cards/ordo-card-types";
import { UserDashboard } from "./UserDashboard";

function activity(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: "job:job_1",
    sourceKind: "job",
    sourceId: "job_1",
    userId: "usr_1",
    roleVisibility: ["AUTHENTICATED"],
    bucket: "running",
    severity: "info",
    title: "Generate audio",
    summary: "Audio is rendering.",
    statusLabel: "Running",
    sourceStatus: "running",
    href: "/jobs?jobId=job_1",
    primaryAction: {
      id: "open_job",
      label: "Open work",
      href: "/jobs?jobId=job_1",
      tone: "primary",
    },
    secondaryActions: [
      {
        id: "open_conversation",
        label: "Open conversation",
        href: "/?conversationId=conv_1",
        tone: "secondary",
      },
    ],
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

function card(overrides: Partial<OrdoCard> = {}): OrdoCard {
  return {
    id: "content_item:post_1",
    kind: "content_item",
    objectRef: {
      kind: "content_item",
      id: "post_1",
      label: "Launch Post",
      href: "/studio/content/post_1",
    },
    bucket: "business_loop",
    status: "published",
    tone: "good",
    title: "Launch Post",
    summary: "This content has measurable visits.",
    createdAt: "2026-05-04T10:00:00.000Z",
    updatedAt: "2026-05-04T10:01:00.000Z",
    ownerUserId: "usr_1",
    roleVisibility: ["AUTHENTICATED"],
    sourceRefs: [{ sourceKind: "blog_post", sourceId: "post_1", label: "Content record" }],
    provenanceRefs: [{ sourceKind: "blog_post", sourceId: "post_1", label: "Content record" }],
    detailHref: "/studio/content/post_1",
    metrics: [
      { id: "visits", label: "Visits", value: 12 },
      { id: "chats", label: "Chats", value: 2 },
    ],
    primaryAction: {
      id: "open-content",
      label: "Open content",
      href: "/studio/content/post_1",
      tone: "primary",
    },
    secondaryActions: [],
    ...overrides,
  };
}

function emptyResults(): UserDashboardData["results"] {
  return {
    metrics: [
      {
        id: "tracked_visits",
        label: "Visits/scans",
        value: 0,
        summary: "Tracked visits and QR/referral introductions with durable evidence.",
        tone: "neutral",
        href: "/business",
      },
      {
        id: "tracked_chats",
        label: "Tracked chats",
        value: 0,
        summary: "Chats started from content, QR, or referral evidence.",
        tone: "neutral",
        href: "/business",
      },
      {
        id: "offer_choices",
        label: "Offer choices",
        value: 0,
        summary: "Recorded choices from public offers and tracked links.",
        tone: "neutral",
        href: "/offers",
      },
      {
        id: "simulated_purchases",
        label: "Purchases",
        value: 0,
        summary: "Simulated purchase events only; no revenue is inferred.",
        tone: "neutral",
        href: "/offers",
      },
    ],
    resultCards: { total: 0, cards: [] },
    weakSignalCards: { total: 0, cards: [] },
    nextActionCards: { total: 0, cards: [] },
    askOrdoPrompts: [{
      id: "first-offer",
      label: "Ask Ordo to create the first offer",
      prompt: "Help me create one clear public offer with a price, audience, promise, and next step.",
      href: "/",
      sourceRefs: [],
    }],
  };
}

function results(overrides: Partial<UserDashboardData["results"]> = {}): UserDashboardData["results"] {
  return {
    ...emptyResults(),
    metrics: [
      {
        id: "tracked_visits",
        label: "Visits/scans",
        value: 15,
        summary: "Tracked visits and QR/referral introductions with durable evidence.",
        tone: "good",
        href: "/business",
      },
      {
        id: "tracked_chats",
        label: "Tracked chats",
        value: 4,
        summary: "Chats started from content, QR, or referral evidence.",
        tone: "good",
        href: "/business",
      },
      {
        id: "offer_choices",
        label: "Offer choices",
        value: 2,
        summary: "Recorded choices from public offers and tracked links.",
        tone: "good",
        href: "/offers",
      },
      {
        id: "simulated_purchases",
        label: "Purchases",
        value: 1,
        summary: "Simulated purchase events only; no revenue is inferred.",
        tone: "good",
        href: "/offers",
      },
    ],
    resultCards: {
      total: 1,
      cards: [card()],
    },
    weakSignalCards: {
      total: 1,
      cards: [card({
        id: "tracked_link:quiet",
        kind: "tracked_link",
        title: "Quiet QR link",
        summary: "This shared link has no recorded visits yet.",
        detailHref: "/r/QUIET",
        objectRef: { kind: "tracked_link", id: "tl_1", label: "Quiet QR link", href: "/r/QUIET" },
        sourceRefs: [{ sourceKind: "tracked_link", sourceId: "tl_1", label: "Tracked link" }],
        provenanceRefs: [{ sourceKind: "tracked_link", sourceId: "tl_1", label: "Tracked link" }],
        primaryAction: { id: "open-link", label: "Open tracked link", href: "/r/QUIET", tone: "primary" },
      })],
    },
    nextActionCards: {
      total: 1,
      cards: [card({
        id: "person:lead_1",
        kind: "person",
        title: "Pat Prospect",
        summary: "Follow up about the launch offer.",
        detailHref: "/business/people/person%3Alead_1",
        objectRef: { kind: "person", id: "person:lead_1", label: "Pat Prospect", href: "/business/people/person%3Alead_1" },
        sourceRefs: [{ sourceKind: "lead", sourceId: "lead_1", label: "Lead" }],
        provenanceRefs: [{ sourceKind: "lead", sourceId: "lead_1", label: "Lead" }],
        primaryAction: { id: "open-person", label: "Open person", href: "/business/people/person%3Alead_1", tone: "primary" },
      })],
    },
    askOrdoPrompts: [{
      id: "continue-next-action",
      label: "Ask Ordo to continue the top action",
      prompt: "Look at Pat Prospect and recommend the safest next step.",
      href: "/",
      sourceRefs: [{ sourceKind: "lead", sourceId: "lead_1", label: "Lead" }],
    }],
    ...overrides,
  };
}

function dashboard(overrides: Partial<UserDashboardData> = {}): UserDashboardData {
  return {
    attention: {
      total: 1,
      items: [
        activity({
          id: "job:failed",
          sourceId: "failed",
          bucket: "needs_attention",
          statusLabel: "Failed",
          sourceStatus: "failed",
          title: "Fix failed render",
          summary: "Provider failed.",
        }),
      ],
    },
    currentWork: {
      total: 1,
      items: [
        activity({
          id: "media_workflow:mwf_1",
          sourceKind: "media_workflow",
          sourceId: "mwf_1",
          bucket: "running",
          title: "Create promo short",
          href: "/jobs?workflowId=mwf_1",
        }),
      ],
    },
    recentOutputs: {
      total: 1,
      items: [
        activity({
          id: "media_workflow:mwf_done",
          sourceKind: "media_workflow",
          sourceId: "mwf_done",
          bucket: "completed",
          statusLabel: "Succeeded",
          sourceStatus: "succeeded",
          title: "Promo short ready",
          href: "/my/media?assetId=asset_1",
        }),
      ],
    },
    businessLoop: {
      total: 1,
      items: [
        activity({
          id: "referral_milestone:ref_evt",
          sourceKind: "referral_milestone",
          sourceId: "ref_evt",
          bucket: "completed",
          title: "Referral registered",
          href: "/referrals",
        }),
      ],
    },
    referralOverview: {
      introductions: 3,
      startedChats: 2,
      registered: 1,
      qualifiedOpportunities: 1,
      creditStatusLabel: "Pending",
      creditStatusCounts: {
        tracked: 1,
        pending_review: 0,
        approved: 0,
        paid: 0,
        void: 0,
      },
      narrative: "1 qualified opportunity reached downstream milestones.",
    },
    results: results(),
    systemHealth: {
      tone: "attention",
      label: "Review needed",
      summary: "1 item needs a decision or recovery action.",
    },
    activityLoadStatus: "ready",
    activityLoadMessage: null,
    ...overrides,
  };
}

describe("UserDashboard", () => {
  it("renders the Today Brief base route instead of stacked dashboard blocks", () => {
    render(<UserDashboard userName="Keith" dashboard={dashboard()} />);

    expect(screen.getByRole("heading", { name: "Today Brief" })).toBeInTheDocument();
    expect(document.querySelector('[data-dashboard-brief="true"]')).not.toBeNull();
    expect(document.querySelector("[data-dashboard-block]")).toBeNull();
    expect(document.querySelector("[data-ordo-card]")).toBeNull();
    expect(screen.getByText("1 item needs your judgment before Ordo should continue.")).toBeInTheDocument();
    expect(screen.getByText("2 items look blocked, weak, or incomplete enough to fix.")).toBeInTheDocument();
  }, 10_000);

  it("shows an intent-based evidence index with decisions, work, outputs, results, and fixes", () => {
    render(<UserDashboard userName="Keith" dashboard={dashboard()} />);

    expect(screen.getByText("Pat Prospect")).toBeInTheDocument();
    expect(screen.getByText("Fix failed render")).toBeInTheDocument();
    expect(screen.getAllByText("Create promo short").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Promo short ready").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Launch Post").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Quiet QR link").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Referral registered").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Today evidence index")).toHaveAttribute("data-dashboard-decisions-column", "true");
    expect(document.querySelectorAll("[data-dashboard-selection-row]")).toHaveLength(7);
    expect(document.querySelector('[data-dashboard-selection-intent="decide"]')).not.toBeNull();
    expect(document.querySelector('[data-dashboard-selection-intent="watch"]')).not.toBeNull();
    expect(document.querySelector('[data-dashboard-selection-intent="inspect"]')).not.toBeNull();
    expect(document.querySelector('[data-dashboard-selection-intent="learn"]')).not.toBeNull();
    expect(document.querySelector('[data-dashboard-selection-intent="fix"]')).not.toBeNull();
    expect(document.querySelector('[data-dashboard-selection-row="inspect:workflow_run:activity:media_workflow:mwf_done"]')).not.toBeNull();
    expect(document.querySelector('[data-dashboard-selection-row="decide:workflow_run:activity:media_workflow:mwf_done"]')).toBeNull();
  });

  it("keeps Today search and filters in the second column", () => {
    render(<UserDashboard
      userName="Keith"
      dashboard={dashboard()}
      query={{ q: "promo", intent: "watch", objectId: null }}
    />);

    expect(screen.getByRole("textbox", { name: "Search Today" })).toHaveValue("promo");
    expect(screen.getByLabelText("Intent")).toHaveValue("watch");
    expect(screen.getAllByRole("link", { name: /Create promo short/i })[0]).toHaveAttribute(
      "href",
      "/workspace?q=promo&intent=watch&object=watch%3Aworkflow_run%3Aactivity%3Amedia_workflow%3Amwf_1",
    );
    expect(document.querySelectorAll("[data-dashboard-selection-row]")).toHaveLength(1);
  });

  it("shows one selected Today item without repeating the overview above it", () => {
    render(<UserDashboard
      userName="Keith"
      dashboard={dashboard()}
      query={{ q: null, intent: null, objectId: "person:lead_1" }}
    />);

    expect(screen.getByRole("heading", { name: "Pat Prospect", level: 1 })).toBeInTheDocument();
    expect(document.querySelector('[data-dashboard-selected-object="true"]')).not.toBeNull();
    expect(document.querySelector('[data-dashboard-selected-intent="decide"]')).not.toBeNull();
    expect(screen.getByText("Why this is on Today")).toBeInTheDocument();
    expect(screen.getByText("Current state")).toBeInTheDocument();
    expect(screen.getByText("Recommended action")).toBeInTheDocument();
    expect(screen.getByText("Evidence")).toBeInTheDocument();
    expect(screen.getByText("Source links")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open person" })[0]).toHaveAttribute("href", "/business/people/person%3Alead_1");
    expect(screen.getByRole("link", { name: "Back to Today" })).toHaveAttribute("href", "/workspace");
    expect(screen.queryByRole("heading", { name: "Today Brief" })).toBeNull();
  });

  it("exposes Ask Ordo as the operating path for fix details without surfacing raw conversation actions", () => {
    render(<UserDashboard
      userName="Keith"
      dashboard={dashboard()}
      query={{ q: null, intent: null, objectId: "fix:workflow_run:activity:job:failed" }}
    />);

    expect(screen.getByRole("heading", { name: "Fix failed render", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask Ordo" })).toHaveAttribute("href", "/?conversationId=conv_1");
    expect(screen.getByText("Look at Fix failed render. Explain the evidence, the risk, and the safest next action before changing anything.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open conversation" })).toBeNull();
    expect(screen.getAllByText("background service failed.").length).toBeGreaterThan(0);
    expect(screen.queryByText("Provider failed.")).toBeNull();
    expect(document.querySelector('a[href^="/jobs"]')).toBeNull();
    expect(document.querySelector('a[href^="/my/media"]')).toBeNull();
  });

  it("reframes donor media links through Studio when a completed output is selected", () => {
    render(<UserDashboard
      userName="Keith"
      dashboard={dashboard()}
      query={{ q: null, intent: null, objectId: "inspect:workflow_run:activity:media_workflow:mwf_done" }}
    />);

    expect(screen.getByRole("heading", { name: "Promo short ready", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open work" })[0]).toHaveAttribute("href", "/studio/media/asset_1");
    expect(document.querySelector('a[href^="/my/media"]')).toBeNull();
  });

  it("renders a useful empty dashboard without pretending work exists", () => {
    render(<UserDashboard userName="Morgan" dashboard={dashboard({
      attention: { total: 0, items: [] },
      currentWork: { total: 0, items: [] },
      recentOutputs: { total: 0, items: [] },
      businessLoop: { total: 0, items: [] },
      referralOverview: null,
      results: emptyResults(),
      systemHealth: {
        tone: "ready",
        label: "Ready",
        summary: "No active issues are visible for this account.",
      },
    })} />);

    expect(screen.getByRole("heading", { name: "Today Brief" })).toBeInTheDocument();
    expect(screen.getByText("No owner decisions are waiting right now.")).toBeInTheDocument();
    expect(screen.getByText("Start with one concrete outcome in chat so Ordo can turn it into governed work.")).toBeInTheDocument();
    expect(screen.getByText("No Today items match this view")).toBeInTheDocument();
    expect(screen.queryByText("No active background work")).toBeNull();
    expect(screen.queryByText("No completed outputs")).toBeNull();
    expect(screen.queryByText("No measured result yet")).toBeNull();
    expect(screen.queryByText("No weak signals yet")).toBeNull();
    expect(screen.queryByText("No referral milestones yet")).toBeNull();
    expect(screen.getByRole("link", { name: "Ask Ordo to create the first offer" })).toHaveAttribute("href", "/");
  });

  it("keeps diagnostics out of the regular user dashboard copy", () => {
    render(<UserDashboard userName="Keith" dashboard={dashboard()} />);

    const dashboardRoot = screen.getByLabelText("Today");

    expect(within(dashboardRoot).queryByText(/runtime audit/i)).toBeNull();
    expect(within(dashboardRoot).queryByText(/provider/i)).toBeNull();
    expect(within(dashboardRoot).queryByText(/raw log/i)).toBeNull();
    expect(within(dashboardRoot).queryByText(/^job$/i)).toBeNull();
    expect(within(dashboardRoot).queryByText(/job_1/i)).toBeNull();
    expect(within(dashboardRoot).queryByText(/job:failed/i)).toBeNull();
    expect(within(dashboardRoot).queryByText(/\$1,000/i)).toBeNull();
    expect(within(dashboardRoot).queryByText(/roi/i)).toBeNull();
    expect(dashboardRoot.querySelector('a[href^="/jobs"]')).toBeNull();
    expect(dashboardRoot.querySelector('a[href^="/my/media"]')).toBeNull();
  });

  it("shows a role-safe limited state when activity loading failed", () => {
    render(<UserDashboard userName="Keith" dashboard={dashboard({
      activityLoadStatus: "limited",
      activityLoadMessage: "Today is partially unavailable. Try the detail pages if you need to inspect older work.",
      systemHealth: {
        tone: "limited",
        label: "Limited visibility",
        summary: "Some work state could not be loaded.",
      },
    })} />);

    expect(document.querySelector('[data-dashboard-brief-status="limited"]')).not.toBeNull();
    expect(screen.getByText("Today is partially unavailable. Try the detail pages if you need to inspect older work.")).toBeInTheDocument();
    expect(screen.getByText("Limitations")).toBeInTheDocument();
  });
});
