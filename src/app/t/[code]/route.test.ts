import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { recordPublicVisitMock } = vi.hoisted(() => ({
  recordPublicVisitMock: vi.fn(),
}));

vi.mock("@/lib/tracked-links/tracked-link-service", () => ({
  getTrackedLinkService: () => ({
    recordPublicVisit: recordPublicVisitMock,
  }),
}));

import { GET } from "./route";

function request(path = "/t/TRACKED1", cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

describe("GET /t/[code]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordPublicVisitMock.mockResolvedValue({
      link: {
        id: "tl_1",
        code: "TRACKED1",
        destinationUrl: "/offers/strategy-call?tl=TRACKED1",
      },
      event: { wasInserted: true },
    });
  });

  it("records the visit and redirects to the tracked destination", async () => {
    const response = await GET(request(), { params: Promise.resolve({ code: "TRACKED1" }) });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/offers/strategy-call?tl=TRACKED1");
    expect(response.headers.get("set-cookie")).toContain("ordo_tracked_link_visit=");
    expect(recordPublicVisitMock).toHaveBeenCalledWith(expect.objectContaining({
      code: "TRACKED1",
      anonymousVisitId: expect.any(String),
    }));
  });

  it("redirects to a safe unavailable page when the code is inactive", async () => {
    recordPublicVisitMock.mockResolvedValue({ link: null, event: null });

    const response = await GET(request(), { params: Promise.resolve({ code: "missing" }) });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/offers?link=unavailable");
  });
});
