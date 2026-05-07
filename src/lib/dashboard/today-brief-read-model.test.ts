import { describe, expect, it } from "vitest";
import type { ActivityItem } from "@/lib/activity";
import type { OrdoCard } from "@/lib/ordo-cards/ordo-card-types";
import type { UserDashboardData } from "./load-user-dashboard";
import { buildTodayBriefReadModel } from "./today-brief-read-model";

function activity(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: "media_workflow:mwf_1",
    sourceKind: "media_workflow",
    sourceId: "mwf_1",
    userId: "usr_1",
    roleVisibility: ["AUTHENTICATED"],
    bucket: "running",
    severity: "info",
    title: "Create promo short",
    summary: "Media work is moving.",
    statusLabel: "Running",
    sourceStatus: "running",
    href: "/studio?object=workflow_run%3Amedia_workflow%3Amwf_1",
    primaryAction: {
      id: "open_work",
      label: "Open work",
      href: "/studio?object=workflow_run%3Amedia_workflow%3Amwf_1",
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
    dedupeKey: "media_workflow:mwf_1",
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
    id: "person:lead_1",
    kind: "person",
    objectRef: {
      kind: "person",
      id: "person:lead_1",
      label: "Pat Prospect",
      href: "/business/people/person%3Alead_1",
    },
    bucket: "needs_attention",
    status: "needs_review",
    tone: "warn",
    title: "Pat Prospect",
    summary: "Follow up about the launch offer.",
    createdAt: "2026-05-04T10:00:00.000Z",
    updatedAt: "2026-05-04T10:01:00.000Z",
    ownerUserId: "usr_1",
    roleVisibility: ["AUTHENTICATED"],
    sourceRefs: [{ sourceKind: "lead", sourceId: "lead_1", label: "Lead" }],
    provenanceRefs: [{ sourceKind: "lead", sourceId: "lead_1", label: "Lead" }],
    detailHref: "/business/people/person%3Alead_1",
    metrics: [],
    primaryAction: {
      id: "open-person",
      label: "Open person",
      href: "/business/people/person%3Alead_1",
      tone: "primary",
    },
    secondaryActions: [],
    ...overrides,
  };
}

function dashboard(overrides: Partial<UserDashboardData> = {}): UserDashboardData {
  return {
    attention: { total: 0, items: [] },
    currentWork: { total: 0, items: [] },
    recentOutputs: { total: 0, items: [] },
    businessLoop: { total: 0, items: [] },
    referralOverview: null,
    results: {
      metrics: [],
      resultCards: { total: 0, cards: [] },
      weakSignalCards: { total: 0, cards: [] },
      nextActionCards: { total: 0, cards: [] },
      askOrdoPrompts: [{
        id: "first-offer",
        label: "Ask Ordo to create the first offer",
        prompt: "Create one clear public offer.",
        href: "/",
        sourceRefs: [],
      }],
    },
    systemHealth: {
      tone: "ready",
      label: "Ready",
      summary: "No active issues are visible for this account.",
    },
    activityLoadStatus: "ready",
    activityLoadMessage: null,
    ...overrides,
  };
}

describe("Today brief read model", () => {
  it("maps owner work into decide, watch, inspect, learn, and fix intents", () => {
    const model = buildTodayBriefReadModel(dashboard({
      attention: {
        total: 1,
        items: [activity({
          id: "job:failed",
          sourceKind: "job",
          sourceId: "failed",
          bucket: "needs_attention",
          statusLabel: "Failed",
          sourceStatus: "failed",
          title: "Recover failed work",
          summary: "Provider log job_failed failed.",
        })],
      },
      currentWork: {
        total: 1,
        items: [activity()],
      },
      recentOutputs: {
        total: 1,
        items: [activity({
          id: "media_workflow:done",
          sourceId: "done",
          bucket: "completed",
          statusLabel: "Succeeded",
          sourceStatus: "succeeded",
          title: "Promo short ready",
        })],
      },
      results: {
        ...dashboard().results,
        nextActionCards: { total: 1, cards: [card()] },
        resultCards: { total: 1, cards: [card({ id: "content_item:post_1", kind: "content_item", title: "Launch post" })] },
        weakSignalCards: { total: 1, cards: [card({ id: "tracked_link:quiet", kind: "tracked_link", title: "Quiet QR link" })] },
      },
    }));

    expect(model.counts).toMatchObject({
      decide: 1,
      watch: 1,
      inspect: 1,
      learn: 1,
      fix: 2,
      total: 6,
    });
    expect(model.items.find((item) => item.title === "Promo short ready")?.intent).toBe("inspect");
    expect(model.items.find((item) => item.title === "Recover failed work")?.intent).toBe("fix");
  });

  it("sanitizes raw job, log, and provider language from owner-facing Today items", () => {
    const model = buildTodayBriefReadModel(dashboard({
      attention: {
        total: 1,
        items: [activity({
          id: "job:job_failed",
          sourceKind: "job",
          sourceId: "job_failed",
          bucket: "needs_attention",
          statusLabel: "Failed",
          sourceStatus: "failed",
          title: "job_job_failed provider failure",
          summary: "Provider log job_abc123 failed.",
        })],
      },
    }));
    const copy = `${model.items[0]?.title} ${model.items[0]?.summary}`;
    const prompt = model.items[0]?.recommendedAction.prompt ?? "";

    expect(copy).not.toMatch(/\bprovider\b/i);
    expect(copy).not.toMatch(/\blogs?\b/i);
    expect(copy).not.toMatch(/\bjob_[a-z0-9-]+\b/i);
    expect(copy).toContain("background service");
    expect(copy).toContain("work item");
    expect(prompt).not.toMatch(/\bprovider\b/i);
    expect(prompt).not.toMatch(/\bjob_[a-z0-9-]+\b/i);
    expect(model.items[0]?.evidenceRefs[0]).toMatchObject({
      kind: "job",
      kindLabel: "Work record",
    });
  });

  it("keeps raw job and donor media routes out of owner-facing Today links", () => {
    const model = buildTodayBriefReadModel(dashboard({
      currentWork: {
        total: 1,
        items: [activity({
          id: "media_workflow:mwf_running",
          sourceKind: "media_workflow",
          sourceId: "mwf_running",
          href: "/jobs?workflowId=mwf_running",
          primaryAction: {
            id: "open-workflow",
            label: "Open workflow",
            href: "/jobs?workflowId=mwf_running",
            tone: "primary",
          },
        })],
      },
      recentOutputs: {
        total: 1,
        items: [activity({
          id: "media_workflow:mwf_done",
          sourceKind: "media_workflow",
          sourceId: "mwf_done",
          bucket: "completed",
          statusLabel: "Succeeded",
          sourceStatus: "succeeded",
          title: "Promo short ready",
          href: "/my/media?assetId=asset_1",
          primaryAction: {
            id: "open-media",
            label: "Open media",
            href: "/my/media?assetId=asset_1",
            tone: "primary",
          },
        })],
      },
    }));
    const hrefs = model.items.flatMap((item) => [
      item.recommendedAction.href,
      ...item.evidenceRefs.map((ref) => ref.href),
      ...item.sourceLinks.map((link) => link.href),
    ]).filter(Boolean);

    expect(hrefs).toContain("/studio/workflows/mwf_running");
    expect(hrefs).toContain("/studio/media/asset_1");
    expect(hrefs.some((href) => href?.startsWith("/jobs"))).toBe(false);
    expect(hrefs.some((href) => href?.startsWith("/my/media"))).toBe(false);
  });

  it("renders a first-action brief when no evidence exists", () => {
    const model = buildTodayBriefReadModel(dashboard());

    expect(model.counts.total).toBe(0);
    expect(model.bullets).toContain("No owner decisions are waiting right now.");
    expect(model.recommendedAction).toMatchObject({
      label: "Ask Ordo to create the first offer",
      href: "/",
    });
  });
});
