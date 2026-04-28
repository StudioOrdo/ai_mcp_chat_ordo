import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminPageAccessMock,
  loadAdminConversationDetailMock,
  restoreConversationActionMock,
  takeOverConversationActionMock,
  handBackConversationActionMock,
} = vi.hoisted(() => ({
  requireAdminPageAccessMock: vi.fn(),
  loadAdminConversationDetailMock: vi.fn(),
  restoreConversationActionMock: vi.fn(),
  takeOverConversationActionMock: vi.fn(),
  handBackConversationActionMock: vi.fn(),
}));

vi.mock("@/lib/journal/admin-journal", () => ({
  requireAdminPageAccess: requireAdminPageAccessMock,
}));

vi.mock("@/lib/admin/conversations/admin-conversations", () => ({
  loadAdminConversationDetail: loadAdminConversationDetailMock,
}));

vi.mock("@/lib/admin/conversations/admin-conversations-actions", () => ({
  restoreConversationAction: restoreConversationActionMock,
  takeOverConversationAction: takeOverConversationActionMock,
  handBackConversationAction: handBackConversationActionMock,
}));

import AdminConversationDetailPage from "@/app/admin/conversations/[id]/page";
import { createAdminUser } from "@/__test-utils__";


describe("/admin/conversations/[id] page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageAccessMock.mockResolvedValue(createAdminUser());
  });

  it("renders normalized tool summaries alongside raw tool part details", async () => {
    loadAdminConversationDetailMock.mockResolvedValue({
      conversation: {
        id: "conv_1",
        userId: "usr_1",
        userName: "Editor",
        title: "Launch thread",
        status: "active",
        lane: "organization",
        laneConfidence: 0.9,
        messageCount: 1,
        lastToolUsed: "produce_blog_article",
        sessionSource: "authenticated",
        conversationMode: "ai",
        createdAt: "2026-04-09T10:00:00.000Z",
        updatedAt: "2026-04-09T10:05:00.000Z",
        detailHref: "/admin/conversations/conv_1",
        detectedNeedSummary: null,
        recommendedNextStep: null,
        promptVersion: null,
        referralId: null,
        referralSource: null,
        trustedReferrerName: null,
        trustedReferrerCredential: null,
        convertedFrom: null,
        deletedAt: null,
        deletedByUserId: null,
        deleteReason: null,
        purgeAfter: null,
        restoredAt: null,
        importedAt: null,
        importSourceConversationId: null,
        importedFromExportedAt: null,
        purgeEligible: false,
        purgeBlockedReason: null,
      },
      messages: [
        {
          id: "msg_1",
          role: "assistant",
          content: "Done.",
          parts: [
            {
              type: "tool-result",
              name: "produce_blog_article",
              result: {
                id: "post_1",
                slug: "launch-plan",
                status: "draft",
                title: "Launch Plan",
                imageAssetId: "asset_hero_1",
                stages: ["compose_blog_article"],
                summary: 'Produced draft "Launch Plan" at /blog/launch-plan with hero asset asset_hero_1.',
              },
            },
          ],
          tokenEstimate: 10,
          createdAt: "2026-04-09T10:05:00.000Z",
        },
      ],
      transcript: {
        entries: [],
        entryCount: 0,
        inContextCount: 0,
        toolResultCount: 0,
        compactionMarkerCount: 0,
      },
      events: [],
      promptProvenance: [],
      totalTokens: 10,
    });

    render(await AdminConversationDetailPage({ params: Promise.resolve({ id: "conv_1" }) }));

    expect(screen.getByText(/produce_blog_article/i)).toBeInTheDocument();
    expect(screen.getByText(/"imageAssetId": "asset_hero_1"/)).toBeInTheDocument();
  });
});