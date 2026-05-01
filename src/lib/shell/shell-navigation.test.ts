import { describe, expect, it } from "vitest";

import {
  canRoleAccessShellRoute,
  getShellRouteById,
  getShellRouteVisibilitySnapshot,
  resolveAccountMenuRoutes,
  resolvePrimaryNavRoutes,
  resolveRailMenuRoutes,
} from "@/lib/shell/shell-navigation";

describe("shell primary nav routes", () => {
  it("keeps the dedicated drawer browse routes available to anonymous users", () => {
    const routes = resolvePrimaryNavRoutes({ roles: ["ANONYMOUS"] });

    expect(routes.map((route) => route.id)).toEqual(["corpus", "journal"]);
  });
});

describe("shell account menu routes", () => {
  it("includes Jobs for signed-in users", () => {
    const routes = resolveAccountMenuRoutes({ roles: ["AUTHENTICATED"] });

    expect(routes.map((route) => route.id)).toEqual([
      "workspace-overview",
      "jobs",
      "my-media",
      "referrals",
      "profile",
    ]);
  });

  it("includes Jobs for apprentices too", () => {
    const routes = resolveAccountMenuRoutes({ roles: ["APPRENTICE"] });

    expect(routes.map((route) => route.id)).toEqual([
      "workspace-overview",
      "jobs",
      "my-media",
      "referrals",
      "profile",
    ]);
  });

  it("adds the operations workspace for staff and admin users", () => {
    expect(resolveAccountMenuRoutes({ roles: ["STAFF"] }).map((route) => route.id)).toEqual([
      "workspace-overview",
      "jobs",
      "my-media",
      "referrals",
      "operations-media",
      "profile",
    ]);

    expect(resolveAccountMenuRoutes({ roles: ["ADMIN"] }).map((route) => route.id)).toEqual([
      "workspace-overview",
      "jobs",
      "my-media",
      "referrals",
      "operations-media",
      "profile",
    ]);
  });

  it("hides account routes for anonymous users", () => {
    const routes = resolveAccountMenuRoutes({ roles: ["ANONYMOUS"] });

    expect(routes).toEqual([]);
  });

  it("keeps shared browse routes available in the compact rail menu", () => {
    const routes = resolveRailMenuRoutes({ roles: ["ANONYMOUS"] });

    expect(routes.map((route) => route.id)).toEqual(["corpus", "journal"]);
  });
});

describe("shell route visibility snapshots", () => {
  it("keeps admin system routes hidden from staff and visible to admins", () => {
    const route = getShellRouteById("admin-system");

    expect(canRoleAccessShellRoute(route, "STAFF")).toBe(false);
    expect(getShellRouteVisibilitySnapshot(route, { roles: ["ADMIN"] })).toMatchObject({
      command: true,
      footer: true,
      account: true,
      any: true,
    });
  });

  it("keeps jobs visible for signed-in users but hidden for anonymous visitors", () => {
    const route = getShellRouteById("jobs");

    expect(canRoleAccessShellRoute(route, "AUTHENTICATED")).toBe(true);
    expect(canRoleAccessShellRoute(route, "ANONYMOUS")).toBe(false);
  });

  it("keeps my media visible for signed-in users but hidden for anonymous visitors", () => {
    const route = getShellRouteById("my-media");

    expect(canRoleAccessShellRoute(route, "AUTHENTICATED")).toBe(true);
    expect(canRoleAccessShellRoute(route, "ANONYMOUS")).toBe(false);
  });

  it("keeps referrals visible for signed-in users but hidden for anonymous visitors", () => {
    const route = getShellRouteById("referrals");

    expect(canRoleAccessShellRoute(route, "AUTHENTICATED")).toBe(true);
    expect(canRoleAccessShellRoute(route, "ANONYMOUS")).toBe(false);
    expect(getShellRouteVisibilitySnapshot(route, { roles: ["AUTHENTICATED"] })).toMatchObject({
      command: true,
      footer: true,
      account: true,
      any: true,
    });
  });

  it("keeps operations media visible for staff and admin but hidden from lower roles", () => {
    const route = getShellRouteById("operations-media");

    expect(canRoleAccessShellRoute(route, "STAFF")).toBe(true);
    expect(canRoleAccessShellRoute(route, "ADMIN")).toBe(true);
    expect(canRoleAccessShellRoute(route, "AUTHENTICATED")).toBe(false);
    expect(canRoleAccessShellRoute(route, "ANONYMOUS")).toBe(false);
  });
});
