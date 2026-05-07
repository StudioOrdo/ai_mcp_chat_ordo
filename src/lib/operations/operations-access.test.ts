import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RoleName, User as SessionUser } from "@/core/entities/user";

const { getSessionUserMock, notFoundMock, redirectMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
  resolveSessionAuthorizationRole: (user: Pick<SessionUser, "roles" | "realRoles">) => {
    const roles = [...(user.realRoles ?? []), ...user.roles];
    return (["ADMIN", "STAFF", "APPRENTICE", "AUTHENTICATED", "ANONYMOUS"] as const).find((role) =>
      roles.includes(role),
    ) ?? "ANONYMOUS";
  },
  sessionHasRole: (user: Pick<SessionUser, "roles" | "realRoles">, allowedRoles: RoleName[]) => {
    const roles = new Set([...(user.realRoles ?? []), ...user.roles]);
    return allowedRoles.some((role) => roles.has(role));
  },
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

import {
  canAccessOperationsWorkspace,
  requireOperationsWorkspaceAccess,
} from "@/lib/operations/operations-access";

function createUser(roles: RoleName[]): SessionUser {
  return {
    id: "usr_ops",
    email: "ops@example.com",
    name: "Ops User",
    roles,
  };
}

describe("operations workspace access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows staff and admin through the shared operations role check", () => {
    expect(canAccessOperationsWorkspace(["STAFF"])).toBe(true);
    expect(canAccessOperationsWorkspace(["ADMIN"])).toBe(true);
    expect(canAccessOperationsWorkspace(["APPRENTICE", "STAFF"])).toBe(true);
    expect(canAccessOperationsWorkspace(["AUTHENTICATED"])).toBe(false);
  });

  it("redirects anonymous users to login", async () => {
    getSessionUserMock.mockResolvedValue(createUser(["ANONYMOUS"]));

    await expect(requireOperationsWorkspaceAccess()).rejects.toThrow("redirect:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("fails closed for signed-in roles outside the operations workspace", async () => {
    getSessionUserMock.mockResolvedValue(createUser(["AUTHENTICATED"]));

    await expect(requireOperationsWorkspaceAccess()).rejects.toThrow("notFound");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns the session user for staff and admin", async () => {
    const staffUser = createUser(["STAFF"]);
    const adminUser = createUser(["ADMIN"]);

    getSessionUserMock.mockResolvedValueOnce(staffUser);
    await expect(requireOperationsWorkspaceAccess()).resolves.toEqual(staffUser);

    getSessionUserMock.mockResolvedValueOnce(adminUser);
    await expect(requireOperationsWorkspaceAccess()).resolves.toEqual(adminUser);
  });
});
