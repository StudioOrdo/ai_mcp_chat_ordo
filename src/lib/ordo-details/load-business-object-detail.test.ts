import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  businessWorkflowContextReaderMock,
  conversationDataMapperMock,
  getActiveReferralSnapshotMock,
  getProfileMock,
  referralAnalyticsServiceMock,
  loadPersonReadModelItemMock,
  projectBusinessConversationToOrdoDetailMock,
  projectPersonToOrdoDetailMock,
  projectReferralToOrdoDetailMock,
} = vi.hoisted(() => ({
  businessWorkflowContextReaderMock: {
    findByConversationId: vi.fn(),
  },
  conversationDataMapperMock: {
    findById: vi.fn(),
  },
  getActiveReferralSnapshotMock: vi.fn(),
  getProfileMock: vi.fn(),
  referralAnalyticsServiceMock: {
    getOverview: vi.fn(),
    getTimeseries: vi.fn(),
    getPipeline: vi.fn(),
    getRecentActivity: vi.fn(),
  },
  loadPersonReadModelItemMock: vi.fn(),
  projectBusinessConversationToOrdoDetailMock: vi.fn(),
  projectPersonToOrdoDetailMock: vi.fn(),
  projectReferralToOrdoDetailMock: vi.fn(),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getBusinessWorkflowContextReader: () => businessWorkflowContextReaderMock,
  getConversationDataMapper: () => conversationDataMapperMock,
}));

vi.mock("@/lib/profile/profile-service", () => ({
  createProfileService: () => ({
    getProfile: getProfileMock,
  }),
}));

vi.mock("@/lib/referrals/referral-analytics", () => ({
  createReferralAnalyticsService: () => referralAnalyticsServiceMock,
}));

vi.mock("@/lib/referrals/referral-resolver", () => ({
  getActiveReferralSnapshot: getActiveReferralSnapshotMock,
}));

vi.mock("@/lib/business/people-read-model", () => ({
  loadPersonReadModelItem: loadPersonReadModelItemMock,
}));

vi.mock("./ordo-detail-projectors", () => ({
  projectBusinessConversationToOrdoDetail: projectBusinessConversationToOrdoDetailMock,
  projectPersonToOrdoDetail: projectPersonToOrdoDetailMock,
  projectReferralToOrdoDetail: projectReferralToOrdoDetailMock,
}));

import type { SessionUser } from "@/lib/auth";
import {
  loadBusinessConversationDetail,
  loadBusinessPersonDetail,
  loadBusinessReferralDetail,
} from "./load-business-object-detail";

const user: SessionUser = {
  id: "usr_1",
  email: "keith@example.com",
  name: "Keith",
  roles: ["AUTHENTICATED"],
};

const admin: SessionUser = {
  id: "usr_admin",
  email: "admin@example.com",
  name: "Admin",
  roles: ["ADMIN"],
};

describe("business object detail loaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProfileMock.mockResolvedValue({ id: "usr_1", referralCode: "KEITH" });
    referralAnalyticsServiceMock.getOverview.mockResolvedValue({ introductions: 1 });
    referralAnalyticsServiceMock.getTimeseries.mockResolvedValue([]);
    referralAnalyticsServiceMock.getPipeline.mockResolvedValue(null);
    referralAnalyticsServiceMock.getRecentActivity.mockResolvedValue([]);
    projectReferralToOrdoDetailMock.mockReturnValue({ title: "Referral detail" });
    projectBusinessConversationToOrdoDetailMock.mockReturnValue({ title: "Conversation detail" });
    projectPersonToOrdoDetailMock.mockReturnValue({ title: "Person detail" });
  });

  it("rejects referral details for another owner", async () => {
    getActiveReferralSnapshotMock.mockReturnValue({
      userId: "usr_other",
      code: "OTHER",
      name: "Other",
      credential: null,
    });

    const detail = await loadBusinessReferralDetail(user, "OTHER");

    expect(detail).toBeNull();
    expect(getProfileMock).not.toHaveBeenCalled();
    expect(projectReferralToOrdoDetailMock).not.toHaveBeenCalled();
  });

  it("allows staff/admin referral review through the same scoped projector", async () => {
    getActiveReferralSnapshotMock.mockReturnValue({
      userId: "usr_owner",
      code: "OWNER",
      name: "Owner",
      credential: null,
    });
    getProfileMock.mockResolvedValue({ id: "usr_owner", referralCode: "OWNER" });

    const detail = await loadBusinessReferralDetail(admin, "OWNER");

    expect(getProfileMock).toHaveBeenCalledWith("usr_owner");
    expect(projectReferralToOrdoDetailMock).toHaveBeenCalledWith(expect.objectContaining({
      profile: { id: "usr_owner", referralCode: "OWNER" },
      overview: { introductions: 1 },
      timeseries: [],
      recentActivity: [],
    }));
    expect(detail).toEqual({ title: "Referral detail" });
  });

  it("rejects conversations owned by another user", async () => {
    conversationDataMapperMock.findById.mockResolvedValue({
      id: "conv_other",
      userId: "usr_other",
    });

    const detail = await loadBusinessConversationDetail(user, "conv_other");

    expect(detail).toBeNull();
    expect(businessWorkflowContextReaderMock.findByConversationId).not.toHaveBeenCalled();
    expect(projectBusinessConversationToOrdoDetailMock).not.toHaveBeenCalled();
  });

  it("does not attach another user's business context to an owned conversation", async () => {
    conversationDataMapperMock.findById.mockResolvedValue({
      id: "conv_1",
      userId: "usr_1",
    });
    businessWorkflowContextReaderMock.findByConversationId.mockResolvedValue({
      id: "ctx_other",
      userId: "usr_other",
    });

    await loadBusinessConversationDetail(user, "conv_1");

    expect(projectBusinessConversationToOrdoDetailMock).toHaveBeenCalledWith({
      conversation: { id: "conv_1", userId: "usr_1" },
      context: null,
    });
  });

  it("loads owner-scoped person details from the derived people read model", async () => {
    loadPersonReadModelItemMock.mockResolvedValue({
      id: "person:lead:lead_1",
      ownerUserId: "usr_1",
      displayName: "Avery",
    });

    const detail = await loadBusinessPersonDetail(user, "person:lead:lead_1");

    expect(loadPersonReadModelItemMock).toHaveBeenCalledWith("usr_1", "person:lead:lead_1");
    expect(projectPersonToOrdoDetailMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "person:lead:lead_1",
      ownerUserId: "usr_1",
    }));
    expect(detail).toEqual({ title: "Person detail" });
  });

  it("rejects person details from another owner", async () => {
    loadPersonReadModelItemMock.mockResolvedValue({
      id: "person:lead:lead_other",
      ownerUserId: "usr_other",
    });

    const detail = await loadBusinessPersonDetail(user, "person:lead:lead_other");

    expect(detail).toBeNull();
    expect(projectPersonToOrdoDetailMock).not.toHaveBeenCalled();
  });
});
