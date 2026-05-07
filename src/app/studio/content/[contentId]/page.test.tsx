import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadStudioContentDetailMock,
  redirectMock,
  notFoundMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadStudioContentDetailMock: vi.fn(),
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
  loadStudioContentDetail: loadStudioContentDetailMock,
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

import StudioContentDetailPage from "./page";

describe("StudioContentDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders owner-scoped content detail", async () => {
    const user = { id: "usr_1", roles: ["AUTHENTICATED"] };
    getSessionUserMock.mockResolvedValue(user);
    loadStudioContentDetailMock.mockResolvedValue({ title: "Launch Note" });

    render(await StudioContentDetailPage({ params: Promise.resolve({ contentId: "blogpost_1" }) }));

    expect(loadStudioContentDetailMock).toHaveBeenCalledWith(user, "blogpost_1");
    expect(screen.getByTestId("ordo-detail-layout")).toHaveTextContent("Launch Note");
  });

  it("redirects anonymous users", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_anon", roles: ["ANONYMOUS"] });

    await expect(StudioContentDetailPage({ params: Promise.resolve({ contentId: "blogpost_1" }) })).rejects.toThrow("redirect:/login");
  });

  it("404s missing content detail", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_1", roles: ["AUTHENTICATED"] });
    loadStudioContentDetailMock.mockResolvedValue(null);

    await expect(StudioContentDetailPage({ params: Promise.resolve({ contentId: "blogpost_missing" }) })).rejects.toThrow("not-found");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
