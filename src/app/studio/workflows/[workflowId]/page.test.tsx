import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadStudioWorkflowDetailMock,
  redirectMock,
  notFoundMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadStudioWorkflowDetailMock: vi.fn(),
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
  loadStudioWorkflowDetail: loadStudioWorkflowDetailMock,
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

import StudioWorkflowDetailPage from "./page";

describe("StudioWorkflowDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders owner-scoped workflow detail", async () => {
    const user = { id: "usr_1", roles: ["AUTHENTICATED"] };
    getSessionUserMock.mockResolvedValue(user);
    loadStudioWorkflowDetailMock.mockResolvedValue({ title: "Mission short" });

    render(await StudioWorkflowDetailPage({ params: Promise.resolve({ workflowId: "mwf_1" }) }));

    expect(loadStudioWorkflowDetailMock).toHaveBeenCalledWith(user, "mwf_1");
    expect(screen.getByTestId("ordo-detail-layout")).toHaveTextContent("Mission short");
  });

  it("redirects anonymous users", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_anon", roles: ["ANONYMOUS"] });

    await expect(StudioWorkflowDetailPage({ params: Promise.resolve({ workflowId: "mwf_1" }) })).rejects.toThrow("redirect:/login");
  });
});
