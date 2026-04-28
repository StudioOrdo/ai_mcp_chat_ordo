import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import SignupPage from "@/app/signup/page";

describe("/signup page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to the canonical register route", async () => {
    expect(() => SignupPage()).toThrow("redirect:/register");
    expect(redirectMock).toHaveBeenCalledWith("/register");
  });
});