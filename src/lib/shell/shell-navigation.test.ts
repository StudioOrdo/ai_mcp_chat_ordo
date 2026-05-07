import { describe, expect, it } from "vitest";

import {
  ACCOUNT_MENU_ROUTE_IDS,
  AUTHENTICATED_ADMIN_RAIL_ROUTE_IDS,
  AUTHENTICATED_WORK_RAIL_ROUTE_IDS,
  CURRENT_OBJECT_CENTERED_SURFACE_GAPS,
  OBJECT_CENTERED_PRIMARY_SURFACES,
  ORDO_OBJECT_KIND_CONTRACTS,
  ORDO_OBJECT_KINDS,
  PRIMARY_NAV_ROUTE_IDS,
  SHELL_ROUTES,
  canRoleAccessShellRoute,
  getShellRouteById,
  getShellRouteVisibilitySnapshot,
  resolveAccountMenuRoutes,
  resolveAuthenticatedAdminRailRoutes,
  resolveAuthenticatedWorkRailRoutes,
  resolvePrimaryNavRoutes,
  resolveRailMenuRoutes,
} from "@/lib/shell/shell-navigation";

const publishedFeedContext = { hasPublicFeedItems: true };
const donorAndDiagnosticRouteIds = [
  "activity",
  "jobs",
  "library",
  "journal-public",
  "my-media",
  "my-content",
  "operations-media",
  "journal-admin",
] as const;
const staleAccountRouteIds = [
  "change-password",
  "preferences",
  "my-conversations",
  "my-offers",
  "my-content",
  "my-media",
  "admin-system",
] as const;
const staleOwnerRailRouteIds = [
  "activity",
  "jobs",
  "library",
  "journal-public",
  "my-media",
  "my-content",
  "operations-media",
  "journal-admin",
  "referrals",
  "profile",
  "change-password",
  "preferences",
] as const;

describe("shell primary nav routes", () => {
  it("keeps feed out of anonymous discovery until content exists", () => {
    const routes = resolvePrimaryNavRoutes({ roles: ["ANONYMOUS"] });

    expect(routes.map((route) => route.id)).toEqual(["home", "offers", "about"]);
    expect(resolvePrimaryNavRoutes({ roles: ["ANONYMOUS"] }, publishedFeedContext).map((route) => route.id)).toEqual([
      "home",
      "feed",
      "offers",
      "about",
    ]);
  });

  it("keeps donor, diagnostic, account, and admin routes out of the public route id set", () => {
    const primaryIds = new Set<string>(PRIMARY_NAV_ROUTE_IDS);

    for (const routeId of [
      ...donorAndDiagnosticRouteIds,
      "admin-dashboard",
      "admin-jobs",
      "admin-system",
      "profile",
      "referrals",
      "ordo-chat",
      "workspace-overview",
      "studio",
      "business",
      "knowledge-base",
    ]) {
      expect(primaryIds.has(routeId)).toBe(false);
    }
  });
});

describe("shell account menu routes", () => {
  it("keeps the account menu to identity and access controls for signed-in users", () => {
    const routes = resolveAccountMenuRoutes({ roles: ["AUTHENTICATED"] });
    const workRailRoutes = resolveAuthenticatedWorkRailRoutes({ roles: ["AUTHENTICATED"] });

    expect(routes.map((route) => route.id)).toEqual([
      "profile",
      "referrals",
    ]);
    expect(routes.map((route) => route.label)).toEqual([
      "My Account",
      "Affiliate Dashboard",
    ]);
    expect(workRailRoutes.map((route) => route.id)).toEqual([
      "ordo-chat",
      "workspace-overview",
      "studio",
      "business",
      "offers",
      "business-about",
      "knowledge-base",
    ]);
    expect(workRailRoutes.map((route) => route.label)).toEqual([
      "Conversations",
      "Today",
      "Studio",
      "People",
      "Offers",
      "About",
      "Knowledge Base",
    ]);
  });

  it("keeps account and rail route id sets locked to canonical IA", () => {
    expect([...ACCOUNT_MENU_ROUTE_IDS]).toEqual(["profile", "referrals"]);
    expect([...AUTHENTICATED_WORK_RAIL_ROUTE_IDS]).toEqual([
      "ordo-chat",
      "workspace-overview",
      "studio",
      "business",
      "offers",
      "business-about",
      "knowledge-base",
    ]);
    expect([...AUTHENTICATED_ADMIN_RAIL_ROUTE_IDS]).toEqual([
      "admin-dashboard",
      "admin-jobs",
      "admin-system",
    ]);
  });

  it("keeps stale account-only and work shortcuts out of the account menu registry", () => {
    const accountIds = new Set<string>(ACCOUNT_MENU_ROUTE_IDS);

    for (const routeId of staleAccountRouteIds) {
      expect(accountIds.has(routeId)).toBe(false);
    }
  });

  it("keeps donor, diagnostic, account, and affiliate routes out of the owner rail registry", () => {
    const ownerRailIds = new Set<string>(AUTHENTICATED_WORK_RAIL_ROUTE_IDS);

    for (const routeId of staleOwnerRailRouteIds) {
      expect(ownerRailIds.has(routeId)).toBe(false);
    }
  });

  it("includes object-centered owner surfaces for apprentices too", () => {
    const routes = resolveAccountMenuRoutes({ roles: ["APPRENTICE"] });

    expect(routes.map((route) => route.id)).toEqual([
      "profile",
      "referrals",
    ]);
  });

  it("keeps admin/global routes separate from the owner rail for staff and admin users", () => {
    expect(resolveAccountMenuRoutes({ roles: ["STAFF"] }).map((route) => route.id)).toEqual([
      "profile",
      "referrals",
    ]);

    expect(resolveAccountMenuRoutes({ roles: ["ADMIN"] }).map((route) => route.id)).toEqual([
      "profile",
      "referrals",
    ]);
    expect(resolveAuthenticatedAdminRailRoutes({ roles: ["STAFF"] }).map((route) => route.id)).toEqual([]);
    expect(resolveAuthenticatedAdminRailRoutes({ roles: ["ADMIN"] }).map((route) => route.id)).toEqual([
      "admin-dashboard",
      "admin-jobs",
      "admin-system",
    ]);
  });

  it("hides account routes for anonymous users", () => {
    const routes = resolveAccountMenuRoutes({ roles: ["ANONYMOUS"] });

    expect(routes).toEqual([]);
    expect(resolveAuthenticatedWorkRailRoutes({ roles: ["ANONYMOUS"] })).toEqual([]);
  });

  it("keeps shared browse routes stateful in the compact rail menu", () => {
    const routes = resolveRailMenuRoutes({ roles: ["ANONYMOUS"] });

    expect(routes.map((route) => route.id)).toEqual(["home", "offers", "about"]);
    expect(resolveRailMenuRoutes({ roles: ["ANONYMOUS"] }, publishedFeedContext).map((route) => route.id)).toEqual([
      "home",
      "feed",
      "offers",
      "about",
    ]);
  });
});

describe("shell route visibility snapshots", () => {
  it("keeps admin system routes hidden from staff and visible to admins", () => {
    const route = getShellRouteById("admin-system");

    expect(canRoleAccessShellRoute(route, "STAFF")).toBe(false);
    expect(getShellRouteVisibilitySnapshot(route, { roles: ["ADMIN"] })).toMatchObject({
      command: true,
      footer: true,
      any: true,
    });
  });

  it("keeps Studio and Business visible for signed-in users but hidden for anonymous visitors", () => {
    const studioRoute = getShellRouteById("studio");
    const businessRoute = getShellRouteById("business");

    expect(canRoleAccessShellRoute(studioRoute, "AUTHENTICATED")).toBe(true);
    expect(canRoleAccessShellRoute(businessRoute, "AUTHENTICATED")).toBe(true);
    expect(canRoleAccessShellRoute(studioRoute, "ANONYMOUS")).toBe(false);
    expect(canRoleAccessShellRoute(businessRoute, "ANONYMOUS")).toBe(false);
  });

  it("keeps donor and diagnostic routes addressable but out of public nav and owner rail", () => {
    const route = getShellRouteById("jobs");

    expect(canRoleAccessShellRoute(route, "AUTHENTICATED")).toBe(false);
    expect(canRoleAccessShellRoute(route, "ANONYMOUS")).toBe(false);

    expect(resolveAuthenticatedWorkRailRoutes({ roles: ["AUTHENTICATED"] }).map((railRoute) => railRoute.id)).not.toContain("my-media");
    expect(resolveAccountMenuRoutes({ roles: ["AUTHENTICATED"] }).map((menuRoute) => menuRoute.id)).not.toContain("my-media");
    expect(resolveAccountMenuRoutes({ roles: ["AUTHENTICATED"] }).map((menuRoute) => menuRoute.id)).not.toContain("my-offers");
    expect(resolveAccountMenuRoutes({ roles: ["AUTHENTICATED"] }).map((menuRoute) => menuRoute.id)).not.toContain("my-conversations");
    expect(resolveAccountMenuRoutes({ roles: ["AUTHENTICATED"] }).map((menuRoute) => menuRoute.id)).not.toContain("my-content");
    expect(resolveAccountMenuRoutes({ roles: ["AUTHENTICATED"] }).map((menuRoute) => menuRoute.id)).not.toContain("preferences");
    expect(canRoleAccessShellRoute(getShellRouteById("my-media"), "AUTHENTICATED")).toBe(false);
    expect(canRoleAccessShellRoute(getShellRouteById("referrals"), "AUTHENTICATED")).toBe(true);
    expect(canRoleAccessShellRoute(getShellRouteById("activity"), "AUTHENTICATED")).toBe(false);
  });

  it("keeps Business route visible in commands while referrals remains an account-only affiliate shortcut", () => {
    const businessRoute = getShellRouteById("business");
    const route = getShellRouteById("referrals");

    expect(getShellRouteVisibilitySnapshot(businessRoute, { roles: ["AUTHENTICATED"] })).toMatchObject({
      command: true,
      footer: true,
      account: true,
      any: true,
    });
    expect(getShellRouteVisibilitySnapshot(route, { roles: ["AUTHENTICATED"] })).toMatchObject({
      command: false,
      footer: false,
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

  it("keeps feed hidden from discovery until public feed content exists", () => {
    const route = getShellRouteById("feed");

    expect(canRoleAccessShellRoute(route, "ANONYMOUS")).toBe(false);
    expect(canRoleAccessShellRoute(route, "ANONYMOUS", publishedFeedContext)).toBe(true);
    expect(getShellRouteVisibilitySnapshot(route, { roles: ["ANONYMOUS"] })).toMatchObject({
      command: false,
      footer: false,
      any: false,
    });
    expect(getShellRouteVisibilitySnapshot(route, { roles: ["ANONYMOUS"] }, publishedFeedContext)).toMatchObject({
      command: true,
      footer: true,
      any: true,
    });
  });
});

describe("object-centered information architecture contract", () => {
  it("maps every non-legacy route to an object-centered surface and disposition", () => {
    const missingContract = SHELL_ROUTES.filter(
      (route) => !route.isLegacy && (!route.targetSurface || !route.routeDisposition),
    );

    expect(missingContract).toEqual([]);
  });

  it("keeps the target signed-in primary surfaces explicit", () => {
    expect(OBJECT_CENTERED_PRIMARY_SURFACES).toEqual([
      "dashboard",
      "studio",
      "business",
      "offers",
      "knowledge_base",
      "profile_settings",
      "admin",
    ]);
  });

  it("marks current signed-in implementation routes as donor or diagnostic surfaces", () => {
    expect(getShellRouteById("workspace-overview")).toMatchObject({
      targetSurface: "dashboard",
      routeDisposition: "primary",
    });
    expect(getShellRouteById("ordo-chat")).toMatchObject({
      targetSurface: "business",
      routeDisposition: "primary",
      label: "Conversations",
      objectKinds: ["conversation", "person"],
    });
    expect(getShellRouteById("business-about")).toMatchObject({
      targetSurface: "public",
      routeDisposition: "primary",
      label: "About",
    });
    expect(getShellRouteById("studio")).toMatchObject({
      targetSurface: "studio",
      routeDisposition: "primary",
      objectKinds: ["media_asset", "content_item", "workflow_run", "operation"],
    });
    expect(getShellRouteById("business")).toMatchObject({
      targetSurface: "business",
      routeDisposition: "primary",
      objectKinds: ["person", "tracked_link", "campaign", "conversation"],
    });
    expect(getShellRouteById("offers")).toMatchObject({
      targetSurface: "offers",
      routeDisposition: "primary",
      objectKinds: ["offer"],
    });
    expect(getShellRouteById("knowledge-base")).toMatchObject({
      label: "Knowledge Base",
      targetSurface: "knowledge_base",
      routeDisposition: "primary",
      objectKinds: ["content_item"],
    });
    expect(getShellRouteById("jobs")).toMatchObject({
      targetSurface: "studio",
      routeDisposition: "donor",
      objectKinds: ["workflow_run"],
    });
    expect(getShellRouteById("my-media")).toMatchObject({
      targetSurface: "studio",
      routeDisposition: "donor",
      objectKinds: ["media_asset", "content_item"],
    });
    expect(getShellRouteById("referrals")).toMatchObject({
      label: "Affiliate Dashboard",
      targetSurface: "business",
      routeDisposition: "donor",
      objectKinds: ["person", "tracked_link", "campaign"],
    });
    expect(getShellRouteById("activity")).toMatchObject({
      targetSurface: "diagnostic",
      routeDisposition: "diagnostic",
    });
    expect(getShellRouteById("operations-media")).toMatchObject({
      targetSurface: "admin",
      routeDisposition: "diagnostic",
    });
  });

  it("keeps object kind contracts grounded in donor sources and default lenses", () => {
    expect(Object.keys(ORDO_OBJECT_KIND_CONTRACTS).sort()).toEqual([...ORDO_OBJECT_KINDS].sort());
    expect(ORDO_OBJECT_KIND_CONTRACTS.media_asset).toMatchObject({
      targetSurface: "studio",
      defaultLens: "provenance",
    });
    expect(ORDO_OBJECT_KIND_CONTRACTS.person).toMatchObject({
      targetSurface: "business",
      defaultLens: "funnel",
    });
    expect(ORDO_OBJECT_KIND_CONTRACTS.offer).toMatchObject({
      targetSurface: "offers",
      defaultLens: "performance",
    });
    expect(ORDO_OBJECT_KIND_CONTRACTS.tracked_link.knownGap).toContain("generic tracked links");
    expect(ORDO_OBJECT_KIND_CONTRACTS.media_asset.donorSources.length).toBeGreaterThan(0);
  });

  it("records no current Studio or Business surface gaps after owner routes exist", () => {
    expect(SHELL_ROUTES.some((route) => route.href === "/studio")).toBe(true);
    expect(SHELL_ROUTES.some((route) => route.href === "/business")).toBe(true);
    expect(CURRENT_OBJECT_CENTERED_SURFACE_GAPS).toEqual([]);
  });

  it("keeps every planned surface donor route grounded in the current shell route table", () => {
    for (const gap of CURRENT_OBJECT_CENTERED_SURFACE_GAPS) {
      for (const routeId of gap.donorRouteIds) {
        expect(() => getShellRouteById(routeId)).not.toThrow();
      }
    }
  });
});
