import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadBusinessPersonDetailMock,
  notFoundMock,
  redirectMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadBusinessPersonDetailMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/ordo-details/load-business-object-detail", () => ({
  loadBusinessPersonDetail: loadBusinessPersonDetailMock,
}));

vi.mock("@/components/ordo-details/OrdoDetailLayout", () => ({
  OrdoDetailLayout: ({ detail }: { detail: { title: string } }) => (
    <div data-testid="person-detail">{detail.title}</div>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

import BusinessPersonDetailPage from "./page";

describe("/business/people/[personId] page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors to login", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_anon", email: "anon@example.com", name: "Anon", roles: ["ANONYMOUS"] });

    await expect(BusinessPersonDetailPage({ params: Promise.resolve({ personId: "person:lead:lead_1" }) })).rejects.toThrow("redirect:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("renders owner-scoped person details", async () => {
    const user = { id: "usr_1", email: "keith@example.com", name: "Keith", roles: ["AUTHENTICATED"] };
    getSessionUserMock.mockResolvedValue(user);
    loadBusinessPersonDetailMock.mockResolvedValue({ title: "Avery Lead" });

    render(await BusinessPersonDetailPage({ params: Promise.resolve({ personId: "person:lead:lead_1" }) }));

    expect(loadBusinessPersonDetailMock).toHaveBeenCalledWith(user, "person:lead:lead_1");
    expect(screen.getByTestId("person-detail")).toHaveTextContent("Avery Lead");
  });

  it("returns notFound when the person is outside the owner scope", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_1", email: "keith@example.com", name: "Keith", roles: ["AUTHENTICATED"] });
    loadBusinessPersonDetailMock.mockResolvedValue(null);

    await expect(BusinessPersonDetailPage({ params: Promise.resolve({ personId: "person:lead:missing" }) })).rejects.toThrow("notFound");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
