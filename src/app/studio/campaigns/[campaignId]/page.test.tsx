import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadStudioCampaignDetailMock,
  redirectMock,
  notFoundMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadStudioCampaignDetailMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/ordo-details/load-studio-object-detail", () => ({
  loadStudioCampaignDetail: loadStudioCampaignDetailMock,
}));

vi.mock("@/components/ordo-details/OrdoDetailLayout", () => ({
  OrdoDetailLayout: ({ detail }: { detail: { title: string } }) => (
    <div data-testid="ordo-detail-layout">{detail.title}</div>
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

import StudioCampaignDetailPage from "./page";

describe("StudioCampaignDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders owner-scoped campaign detail", async () => {
    const user = { id: "usr_1", roles: ["AUTHENTICATED"] };
    getSessionUserMock.mockResolvedValue(user);
    loadStudioCampaignDetailMock.mockResolvedValue({ title: "Content performance loop" });

    render(await StudioCampaignDetailPage({ params: Promise.resolve({ campaignId: "content-performance" }) }));

    expect(loadStudioCampaignDetailMock).toHaveBeenCalledWith(user, "content-performance");
    expect(screen.getByTestId("ordo-detail-layout")).toHaveTextContent("Content performance loop");
  });

  it("redirects anonymous users", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_anon", roles: ["ANONYMOUS"] });

    await expect(StudioCampaignDetailPage({ params: Promise.resolve({ campaignId: "content-performance" }) })).rejects.toThrow("redirect:/login");
  });

  it("404s missing campaign detail", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_1", roles: ["AUTHENTICATED"] });
    loadStudioCampaignDetailMock.mockResolvedValue(null);

    await expect(StudioCampaignDetailPage({ params: Promise.resolve({ campaignId: "missing" }) })).rejects.toThrow("not-found");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
