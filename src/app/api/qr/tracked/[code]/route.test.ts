import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { findActiveByCodeMock } = vi.hoisted(() => ({
  findActiveByCodeMock: vi.fn(),
}));

vi.mock("@/lib/tracked-links/tracked-link-service", () => ({
  getTrackedLinkService: () => ({
    findActiveByCode: findActiveByCodeMock,
  }),
}));

import { GET } from "./route";

function request(path = "/api/qr/tracked/TRACKED1"): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("GET /api/qr/tracked/[code]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findActiveByCodeMock.mockResolvedValue({
      id: "tl_1",
      code: "TRACKED1",
      destinationUrl: "/offers/strategy-call?tl=TRACKED1",
      status: "active",
    });
  });

  it("renders a PNG QR for an active tracked link", async () => {
    const response = await GET(request(), { params: Promise.resolve({ code: "TRACKED1" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(await response.arrayBuffer()).toBeInstanceOf(ArrayBuffer);
    expect(findActiveByCodeMock).toHaveBeenCalledWith("TRACKED1");
  });

  it("returns a generic not-found response for invalid or archived links", async () => {
    findActiveByCodeMock.mockResolvedValue(null);
    const response = await GET(request(), { params: Promise.resolve({ code: "missing" }) });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: "Tracked link not found" });
  });
});
