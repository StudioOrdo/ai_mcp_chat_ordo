import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadAboutWorkspaceMock,
  loadPublicAboutPageDataMock,
  ownerAboutWorkspaceMock,
  publicAboutSurfaceMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadAboutWorkspaceMock: vi.fn(),
  loadPublicAboutPageDataMock: vi.fn(),
  ownerAboutWorkspaceMock: vi.fn(({
    userName,
    workspace,
  }: {
    userName: string;
    workspace: { brief: { title: string } };
  }) => (
    <div data-testid="owner-about-workspace">
      {userName}:{workspace.brief.title}
    </div>
  )),
  publicAboutSurfaceMock: vi.fn(({ data }: { data: { identityName: string } }) => (
    <div data-testid="public-about-surface">{data.identityName}</div>
  )),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/about/load-about-workspace", () => ({
  loadAboutWorkspace: loadAboutWorkspaceMock,
  loadPublicAboutPageData: loadPublicAboutPageDataMock,
}));

vi.mock("@/components/about/AboutSurfaces", () => ({
  OwnerAboutWorkspace: ownerAboutWorkspaceMock,
  PublicAboutSurface: publicAboutSurfaceMock,
}));

import AboutPage from "@/app/about/page";

describe("/about page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadPublicAboutPageDataMock.mockReturnValue({
      identityName: "Studio Ordo",
    });
    loadAboutWorkspaceMock.mockResolvedValue({
      brief: { title: "Business Story Brief" },
    });
  });

  it("renders the anonymous public About surface without loading owner governance data", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "anon_1",
      email: "anon@example.com",
      name: "Anonymous",
      roles: ["ANONYMOUS"],
    });

    render(await AboutPage({ searchParams: Promise.resolve({ section: "mission" }) }));

    expect(loadPublicAboutPageDataMock).toHaveBeenCalledOnce();
    expect(loadAboutWorkspaceMock).not.toHaveBeenCalled();
    expect(publicAboutSurfaceMock).toHaveBeenCalledWith(
      { data: { identityName: "Studio Ordo" } },
      undefined,
    );
    expect(screen.getByTestId("public-about-surface")).toHaveTextContent("Studio Ordo");
  });

  it("renders the signed-in About governance surface with owner nav state", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_1",
      email: "owner@example.com",
      name: "Keith Williams",
      roles: ["AUTHENTICATED"],
    });

    render(await AboutPage({ searchParams: Promise.resolve({ q: "mission", section: "mission" }) }));

    expect(loadAboutWorkspaceMock).toHaveBeenCalledWith({
      q: "mission",
      section: "mission",
    });
    expect(loadPublicAboutPageDataMock).not.toHaveBeenCalled();
    expect(ownerAboutWorkspaceMock).toHaveBeenCalledWith(
      {
        userName: "Keith Williams",
        workspace: { brief: { title: "Business Story Brief" } },
      },
      undefined,
    );
    expect(screen.getByTestId("owner-about-workspace")).toHaveTextContent(
      "Keith Williams:Business Story Brief",
    );
  });
});
