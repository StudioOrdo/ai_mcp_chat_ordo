import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PersonReadModelItem } from "@/lib/business/people-read-model";
import type { OrdoCard } from "@/lib/ordo-cards/ordo-card-types";
import type {
  BusinessWorkspaceData,
  BusinessWorkspaceQuery,
} from "@/lib/business/load-business-workspace";

import { BusinessWorkspace } from "./BusinessWorkspace";

function query(overrides: Partial<BusinessWorkspaceQuery> = {}): BusinessWorkspaceQuery {
  return {
    bucket: null,
    kind: null,
    q: null,
    personId: null,
    stage: null,
    source: null,
    needsAction: null,
    relationshipRole: null,
    affiliateStatus: null,
    page: 1,
    limit: 20,
    ...overrides,
  };
}

function person(overrides: Partial<PersonReadModelItem> = {}): PersonReadModelItem {
  return {
    id: "person:email:ava@example.com",
    ownerUserId: "usr_1",
    stage: "interested",
    stageLabel: "Conversation",
    displayName: "Ava Thompson",
    email: "ava@example.com",
    organization: "Thompson Design Co.",
    summary: "Ava asked about timeline and next steps.",
    nextAction: "Send follow-up with scope.",
    sourceLabels: ["Website", "Contact form"],
    sourceCategories: ["website", "direct_conversation"],
    offerLabels: ["Workflow audit"],
    relationshipRole: "Prospect",
    affiliate: false,
    isAnonymous: false,
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-04T12:00:00.000Z",
    detailHref: "/business/people/person%3Aemail%3Aava%40example.com",
    primaryConversationId: "conv_ava",
    conversationIds: ["conv_ava"],
    leadIds: ["lead_ava"],
    consultationRequestIds: [],
    dealIds: [],
    referralIds: [],
    referralCodes: [],
    offerIds: ["offer_audit"],
    sourceRefs: [{ sourceKind: "conversation", sourceId: "conv_ava", label: "Conversation", href: "/business/conversations/conv_ava" }],
    provenanceRefs: [{ sourceKind: "lead", sourceId: "lead_ava", label: "Lead", href: "/business/conversations/conv_ava" }],
    relationshipTrail: [{
      id: "conversation:conv_ava",
      label: "Conversation started",
      summary: "Ava asked about the timeline.",
      occurredAt: "2026-05-04T12:00:00.000Z",
      sourceRef: { sourceKind: "conversation", sourceId: "conv_ava", label: "Conversation", href: "/business/conversations/conv_ava" },
      sourceActionLabel: "Open conversation",
    }],
    ...overrides,
  };
}

function card(overrides: Partial<OrdoCard> = {}): OrdoCard {
  return {
    id: "tracked_link:referral:KEITH",
    kind: "tracked_link",
    objectRef: { kind: "tracked_link", id: "KEITH", label: "Referral KEITH", href: "/business/referrals/KEITH" },
    bucket: "business_loop",
    status: "published",
    tone: "good",
    title: "Referral QR code",
    summary: "Referral link for Keith.",
    updatedAt: "2026-05-04T12:00:00.000Z",
    ownerUserId: "usr_1",
    roleVisibility: ["AUTHENTICATED"],
    sourceRefs: [{ sourceKind: "referral", sourceId: "KEITH", label: "Referral code" }],
    provenanceRefs: [{ sourceKind: "referral", sourceId: "KEITH", label: "Referral code" }],
    detailHref: "/business/referrals/KEITH",
    primaryAction: { id: "open", label: "Open referral", href: "/business/referrals/KEITH" },
    ...overrides,
  };
}

function workspace(overrides: Partial<BusinessWorkspaceData> = {}): BusinessWorkspaceData {
  const people = overrides.people ?? [person()];
  const activeQuery = overrides.query ?? query();
  const selectedPerson = Object.prototype.hasOwnProperty.call(overrides, "selectedPerson")
    ? overrides.selectedPerson ?? null
    : people[0] ?? null;

  return {
    cards: [card()],
    people,
    selectedPerson,
    peopleTotal: overrides.peopleTotal ?? people.length,
    query: activeQuery,
    summary: {
      total: 1,
      people: people.length,
      needsAttention: 0,
      businessLoop: 1,
      visitor: 0,
      conversation: 1,
      contact: 0,
      offer: 0,
      purchased: 0,
      followUp: 0,
      introductions: 4,
      startedChats: 3,
      registered: 2,
      qualifiedOpportunities: 1,
      referralEnabled: true,
    },
    pageInfo: {
      page: 1,
      limit: 20,
      total: people.length,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    publicOfferHref: "/offers",
    referralUrl: "https://ordo.test/r/KEITH",
    ...overrides,
  };
}

describe("BusinessWorkspace", () => {
  it("renders a compact People selection column instead of heavyweight object cards", () => {
    render(<BusinessWorkspace userName="Keith" workspace={workspace()} />);

    const selection = screen.getByLabelText("People selection");
    expect(selection).toHaveAttribute("data-governance-selector-column", "true");
    expect(within(selection).getByPlaceholderText("Search people...")).toBeInTheDocument();
    const row = within(selection).getByRole("link", { name: /Ava Thompson/i });
    expect(within(row).getByText("Ava Thompson")).toBeInTheDocument();
    expect(within(row).getByText("Thompson Design Co.")).toBeInTheDocument();
    expect(within(row).getByText("Conversation")).toBeInTheDocument();
    expect(within(row).getByText("Website")).toBeInTheDocument();
    expect(within(selection).getByText("Showing 1 of 1 people")).toBeInTheDocument();
    expect(document.querySelector('[data-ordo-card="tracked_link:referral:KEITH"]')).toBeNull();
  });

  it("renders the base People route as a section brief instead of a selected person detail", () => {
    render(<BusinessWorkspace userName="Keith" workspace={workspace()} />);

    expect(document.querySelector('[data-governance-section="business"]')).not.toBeNull();
    expect(document.querySelector('[data-business-brief="true"]')).not.toBeNull();
    expect(document.querySelector('[data-person-detail-header="true"]')).toBeNull();
    expect(screen.getByRole("heading", { name: "Relationship selection", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ava Thompson", level: 1 })).toBeNull();
  });

  it("opens keyboard-accessible filter controls from the filter icon", () => {
    render(<BusinessWorkspace userName="Keith" workspace={workspace()} />);

    const sheet = screen.getByText("Stage").closest("details") as HTMLElement;
    expect(sheet).toHaveAttribute("data-governance-filter-sheet", "true");
    expect(screen.getByLabelText("Open People filters")).toBeInTheDocument();
    expect(within(sheet).getByLabelText("Stage")).toBeInTheDocument();
    expect(within(sheet).getByLabelText("Source")).toBeInTheDocument();
    expect(within(sheet).getByLabelText("Next follow-up")).toBeInTheDocument();
    expect(within(sheet).getByLabelText("Relationship role")).toBeInTheDocument();
    expect(within(sheet).getByLabelText("Affiliate status")).toBeInTheDocument();
  });

  it("marks the selected person and links mobile drill-in state through the person query", () => {
    const ava = person();
    render(<BusinessWorkspace userName="Keith" workspace={workspace({
      people: [ava],
      selectedPerson: ava,
      query: query({ personId: ava.id }),
    })} />);

    const row = document.querySelector(`[data-people-row="${ava.id}"]`);
    expect(row).toHaveAttribute("data-selected", "true");
    expect(row).toHaveAttribute("href", `/business?person=${encodeURIComponent(ava.id)}`);
    expect(screen.getByRole("link", { name: "Back to people" })).toHaveAttribute("href", "/business");
    expect(screen.getByLabelText("Selected relationship")).toHaveAttribute("data-people-detail-column", "true");
    expect(screen.getByLabelText("Selected relationship")).toHaveAttribute("data-governance-main-column", "true");
  });

  it("renders the shared missing-detail state for an unknown selected person", () => {
    render(<BusinessWorkspace userName="Keith" workspace={workspace({
      selectedPerson: null,
      query: query({ personId: "person:missing" }),
    })} />);

    expect(screen.getByText("Relationship was not found.")).toBeInTheDocument();
    expect(screen.getByText("Return to the People brief or select another relationship from the evidence index.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Relationship selection", level: 1 })).toBeNull();
  });

  it("renders the selected person header, source action, and relationship facts before evidence", () => {
    const ava = person({
      referralCodes: ["SARAH"],
      referralIds: ["ref_sarah"],
      sourceLabels: ["QR code", "Referral link"],
      sourceCategories: ["qr_code", "referral_link"],
      relationshipTrail: [
        {
          id: "referral-source:ref_sarah",
          label: "QR / referral source",
          summary: "QR code recorded for referral SARAH.",
          occurredAt: "2026-05-01T12:00:00.000Z",
          sourceRef: { sourceKind: "referral", sourceId: "ref_sarah", label: "Referral SARAH", href: "/business/referrals/SARAH" },
          sourceActionLabel: "Open referral",
        },
        {
          id: "conversation:conv_ava",
          label: "Conversation started",
          summary: "Ava asked about the timeline.",
          occurredAt: "2026-05-04T12:00:00.000Z",
          sourceRef: { sourceKind: "conversation", sourceId: "conv_ava", label: "Conversation", href: "/business/conversations/conv_ava" },
          sourceActionLabel: "Open conversation",
        },
      ],
    });
    render(<BusinessWorkspace userName="Keith" workspace={workspace({
      people: [ava],
      selectedPerson: ava,
      query: query({ personId: ava.id }),
    })} />);

    const detail = screen.getByLabelText("Selected relationship");
    expect(within(detail).getByRole("heading", { name: "Ava Thompson", level: 1 })).toBeInTheDocument();
    expect(within(detail).getByText("Thompson Design Co.")).toBeInTheDocument();
    expect(within(detail).getAllByRole("link", { name: "Open conversation" })[0]).toHaveAttribute("href", "/business/conversations/conv_ava");
    expect(within(detail).getByText("Introduced by")).toBeInTheDocument();
    expect(within(detail).getByRole("link", { name: "Referral SARAH" })).toHaveAttribute("href", "/business/referrals/SARAH");
    expect(within(detail).getByText("Came from")).toBeInTheDocument();
    expect(within(detail).getByText("QR code · Referral link")).toBeInTheDocument();
    expect(within(detail).getByText("Last conversation")).toBeInTheDocument();
    expect(within(detail).getAllByText("May 4 at 12:00 PM").length).toBeGreaterThan(0);
    expect(within(detail).getByText("Next follow-up")).toBeInTheDocument();
    expect(within(detail).getByText("Send follow-up with scope.")).toBeInTheDocument();
    expect(within(detail).getByRole("heading", { name: "Relationship Trail", level: 2 })).toBeInTheDocument();
    expect(within(detail).getByText("QR / referral source")).toBeInTheDocument();
    expect(within(detail).getByText("QR code recorded for referral SARAH.")).toBeInTheDocument();
    expect(within(detail).getByRole("link", { name: "Open referral" })).toHaveAttribute("href", "/business/referrals/SARAH");
    expect(within(detail).getByText("Conversation started")).toBeInTheDocument();
    expect(within(detail).getByText("Ava asked about the timeline.")).toBeInTheDocument();
    expect(within(detail).getAllByRole("link", { name: "Open conversation" }).length).toBeGreaterThan(0);
  });

  it("renders subordinate read-only relationship settings when no durable person write path exists", () => {
    const ava = person({ referralCodes: ["SARAH"], referralIds: ["ref_sarah"] });
    render(<BusinessWorkspace userName="Keith" workspace={workspace({
      people: [ava],
      selectedPerson: ava,
      query: query({ personId: ava.id }),
    })} />);

    const detail = screen.getByLabelText("Selected relationship");
    const trail = detail.querySelector('[data-relationship-trail="true"]');
    const settings = detail.querySelector('[data-relationship-settings-card="true"]') as HTMLElement;

    expect(settings).not.toBeNull();
    expect(trail?.compareDocumentPosition(settings) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(settings).getByRole("heading", { name: "Relationship settings", level: 2 })).toBeInTheDocument();

    const roleControl = within(settings).getByLabelText("Relationship role") as HTMLSelectElement;
    expect(roleControl).toBeDisabled();
    expect(roleControl.value).toBe("Prospect");
    expect(roleControl).toHaveAttribute("data-relationship-role-readonly", "true");

    const affiliateControl = within(settings).getByLabelText("Affiliate") as HTMLInputElement;
    expect(affiliateControl).toBeDisabled();
    expect(affiliateControl.checked).toBe(false);
    expect(affiliateControl).toHaveAttribute("data-affiliate-readonly", "true");
    expect(within(settings).getByRole("link", { name: "Discuss in conversation" })).toHaveAttribute("href", "/business/conversations/conv_ava");
    expect(within(detail).queryByText(/commission|checkout|payment/i)).toBeNull();
  });

  it("reflects affiliate evidence without exposing unsafe mutation controls", () => {
    const affiliate = person({
      displayName: "Sarah Patel",
      organization: "Referral Partner",
      relationshipRole: "Affiliate",
      affiliate: true,
    });

    render(<BusinessWorkspace userName="Keith" workspace={workspace({
      people: [affiliate],
      selectedPerson: affiliate,
      query: query({ personId: affiliate.id }),
    })} />);

    const settings = screen.getByLabelText("Selected relationship")
      .querySelector('[data-relationship-settings-card="true"]') as HTMLElement;
    const roleControl = within(settings).getByLabelText("Relationship role") as HTMLSelectElement;
    const affiliateControl = within(settings).getByLabelText("Affiliate") as HTMLInputElement;

    expect(roleControl.value).toBe("Affiliate");
    expect(roleControl).toBeDisabled();
    expect(affiliateControl.checked).toBe(true);
    expect(affiliateControl).toBeDisabled();
    expect(within(settings).queryByText(/rate|payout|commission|checkout|payment/i)).toBeNull();
  });

  it("routes anonymous relationship setting changes back to chat without inventing a source conversation", () => {
    const anonymous = person({
      id: "person:conversation:conv_anon",
      stage: "anonymous",
      stageLabel: "Visitor",
      displayName: "Referred visitor",
      email: null,
      organization: null,
      sourceLabels: ["QR code"],
      sourceCategories: ["qr_code"],
      nextAction: null,
      primaryConversationId: null,
      conversationIds: [],
      relationshipTrail: [],
      isAnonymous: true,
    });

    render(<BusinessWorkspace userName="Keith" workspace={workspace({
      people: [anonymous],
      selectedPerson: anonymous,
      query: query({ personId: anonymous.id }),
    })} />);

    const settings = screen.getByLabelText("Selected relationship")
      .querySelector('[data-relationship-settings-card="true"]') as HTMLElement;

    expect(within(settings).getByRole("link", { name: "Ask Ordo in chat" })).toHaveAttribute("href", "/");
    expect(within(settings).getByLabelText("Relationship role")).toBeDisabled();
    expect(within(settings).getByLabelText("Affiliate")).toBeDisabled();
  });

  it("keeps anonymous selected people owner-safe without inventing PII", () => {
    const anonymous = person({
      id: "person:conversation:conv_anon",
      stage: "anonymous",
      stageLabel: "Visitor",
      displayName: "Referred visitor",
      email: null,
      organization: null,
      sourceLabels: ["QR code"],
      sourceCategories: ["qr_code"],
      nextAction: null,
      primaryConversationId: null,
      conversationIds: [],
      relationshipTrail: [],
      isAnonymous: true,
    });

    render(<BusinessWorkspace userName="Keith" workspace={workspace({
      people: [anonymous],
      selectedPerson: anonymous,
      query: query({ personId: anonymous.id }),
    })} />);

    const detail = screen.getByLabelText("Selected relationship");
    expect(within(detail).getByRole("heading", { name: "Referred visitor", level: 1 })).toBeInTheDocument();
    expect(within(detail).getAllByText("QR code").length).toBeGreaterThan(0);
    expect(within(detail).queryByText("ava@example.com")).toBeNull();
    expect(within(detail).queryByText("Thompson Design Co.")).toBeNull();
    expect(within(detail).queryByRole("link", { name: "Open conversation" })).toBeNull();
    expect(within(detail).getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("keeps raw donor labels out of normal People list copy", () => {
    render(<BusinessWorkspace userName="Keith" workspace={workspace({
      people: [person({
        sourceLabels: ["QR code"],
        sourceCategories: ["qr_code"],
        summary: "Arrived through QR code.",
      })],
    })} />);

    expect(screen.getAllByText("QR code").length).toBeGreaterThan(0);
    expect(screen.queryByText(/referral_events/i)).toBeNull();
    expect(screen.queryByText(/tracked_link_events/i)).toBeNull();
    expect(screen.queryByText(/offer_events/i)).toBeNull();
    expect(screen.queryByText(/job_/i)).toBeNull();
    expect(screen.queryByText(/^Jobs$/i)).toBeNull();
    expect(screen.queryByText(/^Operations$/i)).toBeNull();
    expect(screen.queryByText(/^Logs$/i)).toBeNull();
  });

  it("renders a truthful empty state without referral dashboard controls", () => {
    render(<BusinessWorkspace userName="Keith" workspace={workspace({
      people: [],
      selectedPerson: null,
      peopleTotal: 0,
      cards: [],
      summary: {
        total: 0,
        people: 0,
        needsAttention: 0,
        businessLoop: 0,
        visitor: 0,
        conversation: 0,
        contact: 0,
        offer: 0,
        purchased: 0,
        followUp: 0,
        introductions: 0,
        startedChats: 0,
        registered: 0,
        qualifiedOpportunities: 0,
        referralEnabled: false,
      },
      pageInfo: {
        page: 1,
        limit: 20,
        total: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      referralUrl: null,
    })} />);

    expect(screen.getByText("No people match this view.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open referral link" })).toBeNull();
    expect(screen.queryByText("Introductions")).toBeNull();
  });
});
