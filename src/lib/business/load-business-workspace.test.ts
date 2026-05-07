import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PersonReadModelItem } from "@/lib/business/people-read-model";
import type { OrdoCard } from "@/lib/ordo-cards/ordo-card-types";

const mocks = vi.hoisted(() => ({
  loadPeopleReadModel: vi.fn(),
  loadReferralsWorkspace: vi.fn(),
  listOwnerLinks: vi.fn(),
}));

vi.mock("@/lib/business/people-read-model", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    loadPeopleReadModel: mocks.loadPeopleReadModel,
  };
});

vi.mock("@/lib/referrals/load-referrals-workspace", () => ({
  loadReferralsWorkspace: mocks.loadReferralsWorkspace,
}));

vi.mock("@/lib/tracked-links/tracked-link-service", () => ({
  getTrackedLinkService: () => ({
    listOwnerLinks: mocks.listOwnerLinks,
  }),
}));

vi.mock("@/lib/ordo-cards/ordo-card-projectors", () => ({
  projectPersonToOrdoCard: (person: PersonReadModelItem): OrdoCard => ({
    id: person.id,
    kind: "person",
    objectRef: { kind: "person", id: person.id, label: person.displayName, href: person.detailHref },
    bucket: "business_loop",
    status: "published",
    tone: "neutral",
    title: person.displayName,
    summary: person.summary,
    updatedAt: person.updatedAt,
    ownerUserId: person.ownerUserId,
    roleVisibility: ["AUTHENTICATED"],
    sourceRefs: person.sourceRefs,
    provenanceRefs: person.provenanceRefs,
    detailHref: person.detailHref,
    primaryAction: { id: "open", label: "Open", href: person.detailHref },
  }),
  projectReferralActivityToOrdoCard: vi.fn(),
  projectReferralLinkToOrdoCard: vi.fn(() => null),
  projectTrackedLinkToOrdoCard: vi.fn(),
}));

import { loadBusinessWorkspace, parseBusinessWorkspaceQuery } from "./load-business-workspace";

function person(overrides: Partial<PersonReadModelItem> = {}): PersonReadModelItem {
  return {
    id: "person:email:ava@example.com",
    ownerUserId: "usr_owner",
    stage: "offer_chosen",
    stageLabel: "Offer",
    displayName: "Ava Thompson",
    email: "ava@example.com",
    organization: "Thompson Design Co.",
    summary: "Ava wants a workflow audit.",
    nextAction: "Follow up on the selected offer.",
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
    sourceRefs: [{ sourceKind: "conversation", sourceId: "conv_ava", label: "Conversation" }],
    provenanceRefs: [{ sourceKind: "lead", sourceId: "lead_ava", label: "Lead" }],
    relationshipTrail: [],
    ...overrides,
  };
}

describe("loadBusinessWorkspace People selection query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadPeopleReadModel.mockResolvedValue([
      person(),
      person({
        id: "person:conversation:qr",
        stage: "anonymous",
        stageLabel: "Visitor",
        displayName: "Referred visitor",
        email: null,
        organization: null,
        summary: "Arrived through QR code.",
        nextAction: null,
        sourceLabels: ["QR code"],
        sourceCategories: ["qr_code"],
        offerLabels: [],
        offerIds: [],
      }),
      person({
        id: "person:customer:priya",
        stage: "customer",
        stageLabel: "Purchased",
        displayName: "Priya Shah",
        email: "priya@example.com",
        organization: "Aligned Marketing",
        summary: "Purchased a strategy offer.",
        nextAction: null,
        sourceLabels: ["Referral link"],
        sourceCategories: ["referral_link"],
        offerLabels: ["Strategy sprint"],
        relationshipRole: "Customer",
        affiliate: true,
        referralCodes: ["PARTNER77"],
      }),
    ]);
    mocks.loadReferralsWorkspace.mockResolvedValue({
      profile: {
        affiliateEnabled: false,
        referralCode: null,
        referralUrl: null,
        qrCodeUrl: null,
      },
      overview: null,
      pipeline: { stages: [], outcomes: [] },
      recentActivity: [],
    });
    mocks.listOwnerLinks.mockResolvedValue([]);
  });

  it("normalizes People selection filters without accepting raw donor filter values", () => {
    expect(parseBusinessWorkspaceQuery({
      person: "person:email:ava@example.com",
      stage: "Offer",
      source: "website",
      needs: "offer_in_motion",
      role: "Prospect",
      affiliate: "not_affiliate",
    })).toMatchObject({
      personId: "person:email:ava@example.com",
      stage: "Offer",
      source: "website",
      needsAction: "offer_in_motion",
      relationshipRole: "Prospect",
      affiliateStatus: "not_affiliate",
    });

    expect(parseBusinessWorkspaceQuery({
      source: "tracked_link_events",
      needs: "job_events",
    })).toMatchObject({
      source: null,
      needsAction: null,
    });
  });

  it.each([
    ["Ava", "Ava Thompson"],
    ["Thompson Design", "Ava Thompson"],
    ["ava@example.com", "Ava Thompson"],
    ["Purchased", "Priya Shah"],
    ["Website", "Ava Thompson"],
    ["Workflow audit", "Ava Thompson"],
    ["Referral link", "Priya Shah"],
    ["PARTNER77", "Priya Shah"],
  ])("matches search query %s against grounded person fields", async (q, expectedName) => {
    const workspace = await loadBusinessWorkspace("usr_owner", { q });

    expect(workspace.people.map((item) => item.displayName)).toEqual([expectedName]);
    expect(workspace.selectedPerson?.displayName).toBe(expectedName);
  });

  it("filters by stage, source, next-action state, relationship role, and affiliate status", async () => {
    await expect(loadBusinessWorkspace("usr_owner", { stage: "Visitor" })).resolves.toMatchObject({
      people: [expect.objectContaining({ displayName: "Referred visitor" })],
    });
    await expect(loadBusinessWorkspace("usr_owner", { source: "qr_code" })).resolves.toMatchObject({
      people: [expect.objectContaining({ displayName: "Referred visitor" })],
    });
    await expect(loadBusinessWorkspace("usr_owner", { needs: "offer_in_motion" })).resolves.toMatchObject({
      people: [expect.objectContaining({ displayName: "Ava Thompson" })],
    });
    await expect(loadBusinessWorkspace("usr_owner", { role: "Customer" })).resolves.toMatchObject({
      people: [expect.objectContaining({ displayName: "Priya Shah" })],
    });
    await expect(loadBusinessWorkspace("usr_owner", { affiliate: "affiliate" })).resolves.toMatchObject({
      people: [expect.objectContaining({ displayName: "Priya Shah" })],
    });
  });
});
