import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadBusinessConversationDetailMock,
  redirectMock,
  notFoundMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadBusinessConversationDetailMock: vi.fn(),
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

vi.mock("@/lib/ordo-details/load-business-object-detail", () => ({
  loadBusinessConversationDetail: loadBusinessConversationDetailMock,
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

import BusinessConversationDetailPage from "./page";

describe("BusinessConversationDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders conversation funnel detail", async () => {
    const user = { id: "usr_1", roles: ["AUTHENTICATED"] };
    getSessionUserMock.mockResolvedValue(user);
    loadBusinessConversationDetailMock.mockResolvedValue({ title: "Referral conversation" });

    render(await BusinessConversationDetailPage({ params: Promise.resolve({ conversationId: "conv_1" }) }));

    expect(loadBusinessConversationDetailMock).toHaveBeenCalledWith(user, "conv_1");
    expect(screen.getByTestId("ordo-detail-layout")).toHaveTextContent("Referral conversation");
  });

  it("redirects anonymous users", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_anon", roles: ["ANONYMOUS"] });

    await expect(BusinessConversationDetailPage({ params: Promise.resolve({ conversationId: "conv_1" }) })).rejects.toThrow("redirect:/login");
  });
});
