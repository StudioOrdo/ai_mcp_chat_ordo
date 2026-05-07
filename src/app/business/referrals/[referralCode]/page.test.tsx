import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadBusinessReferralDetailMock,
  redirectMock,
  notFoundMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadBusinessReferralDetailMock: vi.fn(),
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
  loadBusinessReferralDetail: loadBusinessReferralDetailMock,
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

import BusinessReferralDetailPage from "./page";

describe("BusinessReferralDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous users before referral evidence can be inspected", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_anon", roles: ["ANONYMOUS"] });

    await expect(BusinessReferralDetailPage({ params: Promise.resolve({ referralCode: "KEITH" }) })).rejects.toThrow("redirect:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(loadBusinessReferralDetailMock).not.toHaveBeenCalled();
  });

  it("renders referral performance detail", async () => {
    const user = { id: "usr_1", roles: ["AUTHENTICATED"] };
    getSessionUserMock.mockResolvedValue(user);
    loadBusinessReferralDetailMock.mockResolvedValue({ title: "Referral QR code" });

    render(await BusinessReferralDetailPage({ params: Promise.resolve({ referralCode: "KEITH" }) }));

    expect(loadBusinessReferralDetailMock).toHaveBeenCalledWith(user, "KEITH");
    expect(screen.getByTestId("ordo-detail-layout")).toHaveTextContent("Referral QR code");
  });

  it("404s unauthorized referral codes", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_1", roles: ["AUTHENTICATED"] });
    loadBusinessReferralDetailMock.mockResolvedValue(null);

    await expect(BusinessReferralDetailPage({ params: Promise.resolve({ referralCode: "OTHER" }) })).rejects.toThrow("not-found");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
