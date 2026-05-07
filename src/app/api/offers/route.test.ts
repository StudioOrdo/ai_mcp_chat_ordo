import { beforeEach, describe, expect, it, vi } from "vitest";

const { createDraftMock, getSessionUserMock } = vi.hoisted(() => ({
  createDraftMock: vi.fn(),
  getSessionUserMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/offers/offer-service", () => ({
  getOfferService: () => ({
    createDraft: createDraftMock,
  }),
}));

import { POST } from "./route";

function formRequest(fields: Record<string, string>): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }

  return new Request("http://localhost:3000/api/offers", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/offers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      id: "usr_owner",
      email: "owner@example.com",
      name: "Owner",
      roles: ["AUTHENTICATED"],
    });
    createDraftMock.mockResolvedValue({ id: "offer_1" });
  });

  it("creates a draft offer from owner UI form fields", async () => {
    const response = await POST(formRequest({
      title: "Strategy Call",
      audience: "Solopreneurs",
      promise: "A clear plan",
      summary: "A focused session",
      description: "A focused session",
      price: "500",
      estimatedMinutes: "90",
      billingKind: "fixed",
      visibility: "private",
      ctaLabel: "Start a conversation",
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/offers");
    expect(createDraftMock).toHaveBeenCalledWith(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      expect.objectContaining({
        title: "Strategy Call",
        priceCents: 50_000,
        estimatedMinutes: 90,
        billingKind: "fixed",
        visibility: "private",
      }),
    );
  });

  it("maps offer creation errors without leaking internals", async () => {
    createDraftMock.mockRejectedValue(new Error("database stack trace"));

    const response = await POST(formRequest({ title: "Strategy Call" }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: "Internal server error",
      errorCode: "INTERNAL_ERROR",
    });
  });
});
