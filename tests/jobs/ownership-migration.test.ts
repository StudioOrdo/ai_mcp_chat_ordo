import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookiesMock,
  migrateAnonymousConversationsMock,
  findIdsByUserAndConvertedFromMock,
  transferJobsToUserMock,
  repairConversationOwnershipIndexMock,
  linkConversationToAuthenticatedUserMock,
  clearAnonSessionMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  migrateAnonymousConversationsMock: vi.fn(),
  findIdsByUserAndConvertedFromMock: vi.fn(),
  transferJobsToUserMock: vi.fn(),
  repairConversationOwnershipIndexMock: vi.fn(),
  linkConversationToAuthenticatedUserMock: vi.fn(),
  clearAnonSessionMock: vi.fn(),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getConversationDataMapper: () => ({
    findIdsByUserAndConvertedFrom: findIdsByUserAndConvertedFromMock,
  }),
  getJobQueueRepository: () => ({
    transferJobsToUser: transferJobsToUserMock,
  }),
}));

vi.mock("@/lib/chat/conversation-root", () => ({
  getConversationInteractor: () => ({
    migrateAnonymousConversations: migrateAnonymousConversationsMock,
  }),
}));

vi.mock("@/lib/chat/embed-conversation", () => ({
  repairConversationOwnershipIndex: repairConversationOwnershipIndexMock,
}));

vi.mock("@/lib/chat/resolve-user", () => ({
  clearAnonSession: clearAnonSessionMock,
}));

vi.mock("@/lib/referrals/referral-ledger", () => ({
  getReferralLedgerService: () => ({
    linkConversationToAuthenticatedUser: linkConversationToAuthenticatedUserMock,
  }),
}));

import { migrateAnonymousConversationsToUser } from "@/lib/chat/migrate-anonymous-conversations";

describe("job ownership migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookiesMock.mockResolvedValue({
      get: (name: string) => (name === "lms_anon_session" ? { name, value: "seed_123" } : undefined),
    });
    migrateAnonymousConversationsMock.mockResolvedValue(["conv_anon"]);
    findIdsByUserAndConvertedFromMock.mockResolvedValue(["conv_retry"]);
    transferJobsToUserMock.mockResolvedValue([]);
    repairConversationOwnershipIndexMock.mockResolvedValue(undefined);
    linkConversationToAuthenticatedUserMock.mockResolvedValue(undefined);
    clearAnonSessionMock.mockResolvedValue(undefined);
  });

  it("backfills migrated jobs after anonymous conversations attach to a signed-in user", async () => {
    await migrateAnonymousConversationsToUser("usr_owner", "login");

    expect(transferJobsToUserMock).toHaveBeenCalledWith({
      conversationIds: ["conv_anon"],
      userId: "usr_owner",
      previousUserId: "anon_seed_123",
      source: "login",
    });
    expect(repairConversationOwnershipIndexMock).toHaveBeenCalledWith(
      "conv_anon",
      "usr_owner",
      "anon_seed_123",
    );
  });

  it("reuses converted conversations on retry paths so job ownership still backfills", async () => {
    migrateAnonymousConversationsMock.mockResolvedValue([]);

    const result = await migrateAnonymousConversationsToUser("usr_owner", "registration");

    expect(findIdsByUserAndConvertedFromMock).toHaveBeenCalledWith("usr_owner", "anon_seed_123");
    expect(transferJobsToUserMock).toHaveBeenCalledWith({
      conversationIds: ["conv_retry"],
      userId: "usr_owner",
      previousUserId: "anon_seed_123",
      source: "registration",
    });
    expect(result.migratedConversationIds).toEqual(["conv_retry"]);
  });
});