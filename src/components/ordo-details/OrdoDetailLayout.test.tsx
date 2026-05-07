import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { OrdoObjectDetailModel } from "@/lib/ordo-details";

import { OrdoDetailLayout } from "./OrdoDetailLayout";

const detail: OrdoObjectDetailModel = {
  object: {
    kind: "media_asset",
    id: "uf_image_1",
    label: "Hero image",
    status: "ready",
    ownerUserId: "usr_1",
  },
  title: "Hero image",
  summary: "A generated image.",
  defaultLens: "provenance",
  availableLenses: ["overview", "provenance", "performance"],
  primaryCard: {
    id: "media_asset:uf_image_1",
    kind: "media_asset",
    objectRef: { kind: "media_asset", id: "uf_image_1", label: "Hero image", href: "/studio/media/uf_image_1" },
    bucket: "produced",
    status: "succeeded",
    tone: "good",
    title: "Hero image",
    summary: "image - user_file - durable",
    updatedAt: "2026-05-04T12:00:00.000Z",
    ownerUserId: "usr_1",
    roleVisibility: ["AUTHENTICATED"],
    sourceRefs: [{ sourceKind: "asset_catalog", sourceId: "uf_image_1" }],
    provenanceRefs: [{ sourceKind: "job", sourceId: "job_image", href: "/jobs?jobId=job_image" }],
    detailHref: "/studio/media/uf_image_1",
    diagnosticHref: "/my/media?assetId=uf_image_1",
    defaultLens: "provenance",
    primaryAction: { id: "open", label: "Open asset", href: "/studio/media/uf_image_1" },
  },
  sourceRefs: [{ sourceKind: "asset_catalog", sourceId: "uf_image_1" }],
  provenanceRefs: [{ sourceKind: "job", sourceId: "job_image", href: "/jobs?jobId=job_image" }],
  relatedCards: [],
  badges: [
    { id: "kind", label: "media asset" },
    { id: "status", label: "ready", tone: "good" },
  ],
  headerFacts: [
    { id: "state", label: "Current state", value: "ready" },
  ],
  sourceLinks: [
    { id: "source:asset", label: "Asset catalog", href: "/studio/media/uf_image_1" },
  ],
  provenanceLinks: [
    { id: "provenance:job", label: "Producing work", unavailableReason: "Available in System for authorized operators." },
  ],
  adminDiagnostic: {
    label: "Open diagnostics",
    href: "/admin/jobs/job_image",
  },
  diagnosticHref: "/my/media?assetId=uf_image_1",
  roleVisibility: ["AUTHENTICATED"],
  lenses: [
    {
      lens: "overview",
      label: "Overview",
      facts: [{ id: "status", label: "Status", value: "ready" }],
    },
    {
      lens: "provenance",
      label: "Provenance",
      facts: [{ id: "job", label: "Producing work", value: "Recorded production work", sourceRef: { sourceKind: "job", sourceId: "job_image", href: "/jobs?jobId=job_image" } }],
    },
    {
      lens: "performance",
      label: "Performance",
      emptyState: "Media performance metrics are not recorded yet.",
    },
  ],
};

describe("OrdoDetailLayout", () => {
  it("renders object header, lenses, facts, authorized diagnostic link, and truthful empty states", () => {
    render(<OrdoDetailLayout detail={detail} />);

    expect(screen.getByRole("main")).toHaveAttribute("data-ordo-detail-kind", "media_asset");
    expect(screen.getByRole("heading", { name: "Hero image", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open diagnostics" })).toHaveAttribute("href", "/admin/jobs/job_image");
    expect(screen.getByRole("link", { name: "Provenance" })).toHaveAttribute("aria-current", "true");
    expect(screen.getAllByText("Producing work").length).toBeGreaterThan(0);
    expect(screen.getByText("Available in System for authorized operators.")).toBeInTheDocument();
    expect(screen.queryByText("job_image")).toBeNull();
    expect(screen.getByText("Media performance metrics are not recorded yet.")).toBeInTheDocument();

    const provenanceSection = screen.getByRole("heading", { name: "Provenance", level: 2 }).closest("section");
    const overviewSection = screen.getByRole("heading", { name: "Overview", level: 2 }).closest("section");
    expect(
      provenanceSection?.compareDocumentPosition(overviewSection as Node),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("does not render legacy diagnostic hrefs without an authorized admin diagnostic", () => {
    render(<OrdoDetailLayout detail={{
      ...detail,
      adminDiagnostic: null,
      diagnosticHref: "/jobs?jobId=job_image",
    }} />);

    expect(screen.queryByRole("link", { name: "Open diagnostics" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Diagnostic" })).toBeNull();
    expect(screen.queryByRole("link", { name: /job_image/i })).toBeNull();
  });

  it("renders person-specific header facts and source action before generic lenses", () => {
    render(<OrdoDetailLayout detail={{
      ...detail,
      object: {
        kind: "person",
        id: "person:lead:lead_1",
        label: "Avery Lead",
        status: "Offer",
        ownerUserId: "usr_1",
      },
      title: "Avery Lead",
      summary: "Avery chose the launch offer.",
      defaultLens: "funnel",
      availableLenses: ["overview", "history", "funnel"],
      diagnosticHref: undefined,
      personHeader: {
        displayName: "Avery Lead",
        organization: "Avery Co",
        stageLabel: "Offer",
        primaryConversationHref: "/business/conversations/conv_1",
        facts: [
          { id: "introduced-by", label: "Introduced by", value: "Referral KEITH", sourceRef: { sourceKind: "referral", sourceId: "KEITH", label: "Referral", href: "/business/referrals/KEITH" } },
          { id: "came-from", label: "Came from", value: "Website · Contact form" },
          { id: "last-conversation", label: "Last conversation", value: "May 4 at 12:00 PM" },
          { id: "next-follow-up", label: "Next follow-up", value: "Send follow-up." },
        ],
      },
    }} />);

    expect(screen.getByRole("main")).toHaveAttribute("data-ordo-detail-kind", "person");
    expect(screen.getByRole("heading", { name: "Avery Lead", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Avery Co")).toBeInTheDocument();
    expect(screen.getByText("Offer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open conversation" })).toHaveAttribute("href", "/business/conversations/conv_1");
    expect(screen.getByText("Introduced by")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Referral KEITH" })).toHaveAttribute("href", "/business/referrals/KEITH");
    expect(screen.getByText("Website · Contact form")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Diagnostic" })).toBeNull();
  });

  it("renders relationship timeline source links with human action labels", () => {
    render(<OrdoDetailLayout detail={{
      ...detail,
      defaultLens: "history",
      availableLenses: ["history"],
      adminDiagnostic: null,
      lenses: [{
        lens: "history",
        label: "Relationship Trail",
        timeline: [{
          id: "offer_event:offer_evt_1",
          label: "Offer accepted",
          summary: "Workflow audit was accepted.",
          occurredAt: "2026-05-04T12:00:00.000Z",
          sourceRef: { sourceKind: "offer_event", sourceId: "offer_evt_1", label: "Workflow audit", href: "/offers/workflow-audit" },
          sourceActionLabel: "View offer",
        }],
      }],
    }} />);

    expect(screen.getByRole("heading", { name: "Relationship Trail", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View offer" })).toHaveAttribute("href", "/offers/workflow-audit");
    expect(screen.queryByRole("link", { name: "Open source" })).toBeNull();
  });
});
