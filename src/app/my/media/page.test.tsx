import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  redirectMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import MyMediaPage from "@/app/my/media/page";

describe("/my/media page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors to login", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_anon", email: "anon@example.com", name: "Anon", roles: ["ANONYMOUS"] });

    await expect(MyMediaPage()).rejects.toThrow("redirect:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects signed-in users to the Studio media selector", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_signed_in", email: "signed@example.com", name: "Apprentice", roles: ["APPRENTICE"] });

    await expect(MyMediaPage({ searchParams: Promise.resolve({ q: "hero" }) })).rejects.toThrow(
      "redirect:/studio?kind=media_asset&q=hero",
    );

    expect(redirectMock).toHaveBeenCalledWith("/studio?kind=media_asset&q=hero");
  });

  it("preserves selected asset intent when retiring the donor route", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_signed_in", email: "signed@example.com", name: "Apprentice", roles: ["APPRENTICE"] });

    await expect(MyMediaPage({ searchParams: Promise.resolve({ assetId: "uf_1" }) })).rejects.toThrow(
      "redirect:/studio?kind=media_asset&object=media_asset%3Auf_1",
    );

    expect(redirectMock).toHaveBeenCalledWith("/studio?kind=media_asset&object=media_asset%3Auf_1");
  });
});
