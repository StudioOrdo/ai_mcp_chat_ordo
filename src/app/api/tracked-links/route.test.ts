import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createForContentItemMock,
  createForOfferMock,
  createForPublicUrlMock,
  getSessionUserMock,
} = vi.hoisted(() => ({
  createForContentItemMock: vi.fn(),
  createForOfferMock: vi.fn(),
  createForPublicUrlMock: vi.fn(),
  getSessionUserMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/tracked-links/tracked-link-service", () => ({
  getTrackedLinkService: () => ({
    createForContentItem: createForContentItemMock,
    createForOffer: createForOfferMock,
    createForPublicUrl: createForPublicUrlMock,
  }),
}));

import { POST } from "./route";

function jsonRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/tracked-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/tracked-links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      id: "usr_owner",
      email: "owner@example.com",
      name: "Owner",
      roles: ["AUTHENTICATED"],
    });
    createForOfferMock.mockResolvedValue({
      id: "tl_1",
      code: "TRACKED1",
      targetKind: "offer",
      targetId: "offer_1",
      destinationUrl: "/offers/strategy-call?tl=TRACKED1",
      status: "active",
    });
    createForPublicUrlMock.mockResolvedValue({
      id: "tl_url_1",
      code: "URLCODE1",
      targetKind: "url",
      targetId: "/feed/launch-note",
      destinationUrl: "/feed/launch-note",
      status: "active",
    });
    createForContentItemMock.mockResolvedValue({
      id: "tl_content_1",
      code: "CONTENT1",
      targetKind: "content_item",
      targetId: "blogpost_1",
      destinationUrl: "/feed/launch-note?tl=CONTENT1",
      status: "active",
    });
  });

  it("creates an owner-governed tracked link for an offer", async () => {
    const response = await POST(jsonRequest({ targetKind: "offer", targetId: "offer_1" }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(createForOfferMock).toHaveBeenCalledWith(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      expect.objectContaining({ offerId: "offer_1" }),
    );
    expect(payload.trackedLink).toMatchObject({
      code: "TRACKED1",
      trackedUrl: "/t/TRACKED1",
      qrCodeUrl: "/api/qr/tracked/TRACKED1",
    });
  });

  it("creates a tracked link for an owned public URL without requiring a content-specific schema", async () => {
    const response = await POST(jsonRequest({
      targetKind: "url",
      destinationUrl: "/feed/launch-note",
      label: "Launch note",
      purpose: "content",
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(createForPublicUrlMock).toHaveBeenCalledWith(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      expect.objectContaining({
        destinationUrl: "/feed/launch-note",
        label: "Launch note",
        purpose: "content",
      }),
    );
    expect(payload.trackedLink).toMatchObject({
      code: "URLCODE1",
      trackedUrl: "/t/URLCODE1",
      qrCodeUrl: "/api/qr/tracked/URLCODE1",
    });
  });

  it("creates an owner-governed tracked link for published content", async () => {
    const response = await POST(jsonRequest({
      targetKind: "content_item",
      targetId: "blogpost_1",
      label: "Launch note QR",
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(createForContentItemMock).toHaveBeenCalledWith(
      { userId: "usr_owner", role: "AUTHENTICATED" },
      expect.objectContaining({
        contentId: "blogpost_1",
        label: "Launch note QR",
      }),
    );
    expect(payload.trackedLink).toMatchObject({
      code: "CONTENT1",
      targetKind: "content_item",
      trackedUrl: "/t/CONTENT1",
      qrCodeUrl: "/api/qr/tracked/CONTENT1",
    });
  });

  it("rejects unsupported target kinds without leaking target metadata", async () => {
    const response = await POST(jsonRequest({ targetKind: "job", targetId: "job_secret" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: "Only offer, content item, and owned public URL tracked-link creation is supported by this endpoint.",
      errorCode: "VALIDATION_ERROR",
    });
    expect(createForOfferMock).not.toHaveBeenCalled();
    expect(createForContentItemMock).not.toHaveBeenCalled();
    expect(createForPublicUrlMock).not.toHaveBeenCalled();
  });
});
