import { describe, expect, it, vi } from "vitest";

import type { Offer } from "@/core/entities/offer";
import type { OfferService } from "@/lib/offers/offer-service";

import { createCreateOfferTool } from "./offer-management.tool";

const now = "2026-05-05T12:00:00.000Z";

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "offer_1",
    slug: "strategy-call",
    ownerUserId: "usr_owner",
    title: "Strategy Call",
    summary: "Turn messy work into a repeatable process.",
    description: "Turn messy work into a repeatable process.",
    audience: "Solopreneurs",
    promise: "A clear operating process.",
    priceCents: 50_000,
    currency: "USD",
    billingKind: "fixed",
    estimatedMinutes: 90,
    status: "draft",
    visibility: "private",
    ctaLabel: "Start a conversation",
    createdFromConversationId: "conv_1",
    createdFromMessageId: "msg_user_1",
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

describe("create_offer tool", () => {
  it("creates a draft offer from signed-in chat context with message provenance", async () => {
    const createDraft = vi.fn(async () => makeOffer());
    const tool = createCreateOfferTool({ createDraft } as unknown as OfferService);

    const result = await tool.command.execute(
      {
        title: "Strategy Call",
        summary: "Turn messy work into a repeatable process.",
        audience: "Solopreneurs",
        promise: "A clear operating process.",
        price_cents: 50_000,
        billing_kind: "fixed",
        estimated_minutes: 90,
      },
      {
        role: "AUTHENTICATED",
        userId: "usr_owner",
        conversationId: "conv_1",
        userMessageId: "msg_user_1",
        toolInvocationId: "tool_call_1",
      },
    );

    expect(createDraft).toHaveBeenCalledWith(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      expect.objectContaining({
        title: "Strategy Call",
        priceCents: 50_000,
        billingKind: "fixed",
        createdFromConversationId: "conv_1",
        createdFromMessageId: "msg_user_1",
      }),
    );
    expect(result).toMatchObject({
      action: "create_offer",
      offer: {
        id: "offer_1",
        manage_url: "/offers",
        public_url: null,
        created_from_conversation_id: "conv_1",
        created_from_message_id: "msg_user_1",
      },
      card: {
        kind: "offer",
        title: "Strategy Call",
      },
    });
  });

  it("fails safely without an authenticated chat context", async () => {
    const createDraft = vi.fn(async () => makeOffer());
    const tool = createCreateOfferTool({ createDraft } as unknown as OfferService);

    await expect(tool.command.execute({ title: "Strategy Call" })).resolves.toEqual({
      error: "Authentication required to create offers.",
    });
    await expect(
      tool.command.execute({ title: "Strategy Call" }, { role: "ANONYMOUS", userId: "anon_1" }),
    ).resolves.toEqual({
      error: "Authentication required to create offers.",
    });
    expect(createDraft).not.toHaveBeenCalled();
  });
});
