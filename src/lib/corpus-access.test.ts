import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
}));

vi.mock("./auth", async () => {
  const actual = await vi.importActual("./auth") as Record<string, unknown>;
  return { ...actual, getSessionUser: getSessionUserMock };
});

import { getViewerRole, resolveCorpusRole } from "./corpus-access";

describe("corpus-access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses strongest session role for handbook access", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_admin",
      email: "admin@example.com",
      name: "Admin",
      roles: ["AUTHENTICATED", "ADMIN"],
    });

    await expect(getViewerRole()).resolves.toBe("ADMIN");
  });

  it("keeps public-only corpus access anonymous", () => {
    expect(resolveCorpusRole({ role: "ADMIN", publicOnly: true })).toBe("ANONYMOUS");
  });
});
