import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadStudioMediaDetailMock,
  redirectMock,
  notFoundMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadStudioMediaDetailMock: vi.fn(),
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
  loadStudioMediaDetail: loadStudioMediaDetailMock,
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

import StudioMediaDetailPage from "./page";

describe("StudioMediaDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous users", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_anon", roles: ["ANONYMOUS"] });

    await expect(StudioMediaDetailPage({ params: Promise.resolve({ assetId: "uf_1" }) })).rejects.toThrow("redirect:/login");
  });

  it("renders owner-scoped media detail", async () => {
    const user = { id: "usr_1", roles: ["AUTHENTICATED"] };
    getSessionUserMock.mockResolvedValue(user);
    loadStudioMediaDetailMock.mockResolvedValue({ title: "Hero image" });

    render(await StudioMediaDetailPage({ params: Promise.resolve({ assetId: "uf_1" }) }));

    expect(loadStudioMediaDetailMock).toHaveBeenCalledWith(user, "uf_1");
    expect(screen.getByTestId("ordo-detail-layout")).toHaveTextContent("Hero image");
  });

  it("404s missing media detail", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_1", roles: ["AUTHENTICATED"] });
    loadStudioMediaDetailMock.mockResolvedValue(null);

    await expect(StudioMediaDetailPage({ params: Promise.resolve({ assetId: "uf_missing" }) })).rejects.toThrow("not-found");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
