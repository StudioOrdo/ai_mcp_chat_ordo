import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  archiveOfferMock,
  getSessionUserMock,
  publishOfferMock,
  updateOfferMock,
} = vi.hoisted(() => ({
  archiveOfferMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  publishOfferMock: vi.fn(),
  updateOfferMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/offers/offer-service", () => ({
  getOfferService: () => ({
    archiveOffer: archiveOfferMock,
    publishOffer: publishOfferMock,
    updateOffer: updateOfferMock,
  }),
}));

import { POST } from "./route";

function formRequest(fields: Record<string, string>): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }

  return new Request("http://localhost:3000/api/offers/offer_1", {
    method: "POST",
    body: form,
  });
}

const params = { params: Promise.resolve({ offerId: "offer_1" }) };

describe("POST /api/offers/[offerId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      id: "usr_owner",
      email: "owner@example.com",
      name: "Owner",
      roles: ["AUTHENTICATED"],
    });
  });

  it("publishes and archives through the offer governance service", async () => {
    expect((await POST(formRequest({ action: "publish" }), params)).status).toBe(303);
    expect(publishOfferMock).toHaveBeenCalledWith({ userId: "usr_owner", role: "AUTHENTICATED" }, "offer_1");

    expect((await POST(formRequest({ action: "archive" }), params)).status).toBe(303);
    expect(archiveOfferMock).toHaveBeenCalledWith({ userId: "usr_owner", role: "AUTHENTICATED" }, "offer_1");
  });

  it("updates editable owner offer fields", async () => {
    const response = await POST(formRequest({
      action: "update",
      title: "Updated Strategy Call",
      audience: "Solo founders",
      promise: "A clearer process",
      summary: "Updated summary",
      description: "Updated description",
      price: "750",
      estimatedMinutes: "120",
      billingKind: "fixed",
      visibility: "public",
      ctaLabel: "Start now",
    }), params);

    expect(response.status).toBe(303);
    expect(updateOfferMock).toHaveBeenCalledWith(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      expect.objectContaining({
        offerId: "offer_1",
        title: "Updated Strategy Call",
        priceCents: 75_000,
        estimatedMinutes: 120,
        visibility: "public",
      }),
    );
  });

  it("rejects unsupported actions with a safe validation response", async () => {
    const response = await POST(formRequest({ action: "delete" }), params);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: "Unsupported offer action.",
      errorCode: "VALIDATION_ERROR",
    });
  });
});
