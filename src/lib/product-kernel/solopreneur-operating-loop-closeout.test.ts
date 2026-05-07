import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  OBJECT_CENTERED_PRIMARY_SURFACES,
  ORDO_OBJECT_KIND_CONTRACTS,
  ORDO_OBJECT_KINDS,
} from "@/core/entities/ordo-object";
import {
  getShellRouteById,
  getShellRouteVisibilitySnapshot,
  resolveAccountMenuRoutes,
  resolveAuthenticatedAdminRailRoutes,
  resolveAuthenticatedWorkRailRoutes,
  resolvePrimaryNavRoutes,
} from "@/lib/shell/shell-navigation";

const OWNER_RAIL_SURFACE_IDS = ["ordo-chat", "workspace-overview", "studio", "business", "offers", "business-about", "knowledge-base"];
const OWNER_RAIL_SURFACE_LABELS = ["Conversations", "Today", "Studio", "People", "Offers", "About", "Knowledge Base"];
const ACCOUNT_MENU_SURFACE_IDS = [
  "profile",
  "referrals",
];
const HIDDEN_DONOR_ROUTE_IDS = ["jobs", "activity", "operations-media"];
const PHASE_PACKAGE = [
  "01c3n-authenticated-route-and-left-rail-consolidation.md",
  "01c3o-conversational-and-ui-offer-creation.md",
  "01c3p-people-customer-stage-and-funnel-cards.md",
  "01c3q-tracked-links-qr-and-attribution.md",
  "01c3r-content-campaign-performance-loop.md",
  "01c3s-solopreneur-results-dashboard-and-next-actions.md",
  "01c3t-solopreneur-operating-loop-closeout.md",
] as const;

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("solopreneur operating loop closeout", () => {
  it("keeps the owner operating system small and object-centered", () => {
    const user = { roles: ["AUTHENTICATED" as const] };
    const accountRoutes = resolveAccountMenuRoutes(user);
    const workRailRoutes = resolveAuthenticatedWorkRailRoutes(user);

    expect(accountRoutes.map((route) => route.id)).toEqual(ACCOUNT_MENU_SURFACE_IDS);
    expect(workRailRoutes.map((route) => route.id)).toEqual(OWNER_RAIL_SURFACE_IDS);
    expect(workRailRoutes.map((route) => route.label)).toEqual(OWNER_RAIL_SURFACE_LABELS);
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

  it("keeps public discovery simple and keeps Feed conditional", () => {
    expect(resolvePrimaryNavRoutes({ roles: ["ANONYMOUS"] }).map((route) => route.id)).toEqual([
      "home",
      "offers",
      "about",
    ]);
    expect(
      resolvePrimaryNavRoutes(
        { roles: ["ANONYMOUS"] },
        { hasPublicFeedItems: true },
      ).map((route) => route.id),
    ).toEqual(["home", "feed", "offers", "about"]);
  });

  it("keeps diagnostics out of owner-primary navigation and keeps referrals account-only", () => {
    for (const routeId of HIDDEN_DONOR_ROUTE_IDS) {
      const route = getShellRouteById(routeId);
      const ownerVisibility = getShellRouteVisibilitySnapshot(route, { roles: ["AUTHENTICATED"] });

      expect(ownerVisibility).toMatchObject({
        command: false,
        footer: false,
        account: false,
        any: false,
      });
      expect(["donor", "diagnostic"]).toContain(route.routeDisposition);
    }

    expect(getShellRouteVisibilitySnapshot(getShellRouteById("referrals"), { roles: ["AUTHENTICATED"] })).toMatchObject({
      command: false,
      footer: false,
      account: true,
      any: true,
    });
    expect(resolveAuthenticatedWorkRailRoutes({ roles: ["AUTHENTICATED"] }).map((route) => route.id)).not.toContain("my-media");
    expect(resolveAccountMenuRoutes({ roles: ["AUTHENTICATED"] }).map((route) => route.id)).not.toContain("my-media");

    expect(resolveAuthenticatedAdminRailRoutes({ roles: ["AUTHENTICATED"] })).toEqual([]);
    expect(resolveAuthenticatedAdminRailRoutes({ roles: ["STAFF"] }).map((route) => route.id)).toEqual([]);
    expect(resolveAuthenticatedAdminRailRoutes({ roles: ["ADMIN"] }).map((route) => route.id)).toEqual([
      "admin-dashboard",
      "admin-jobs",
      "admin-system",
    ]);
  });

  it("maps every kernel object to the product surface that governs it", () => {
    expect(Object.keys(ORDO_OBJECT_KIND_CONTRACTS).sort()).toEqual([...ORDO_OBJECT_KINDS].sort());
    expect(ORDO_OBJECT_KIND_CONTRACTS.media_asset).toMatchObject({
      targetSurface: "studio",
      defaultLens: "provenance",
    });
    expect(ORDO_OBJECT_KIND_CONTRACTS.content_item).toMatchObject({
      targetSurface: "studio",
      defaultLens: "provenance",
    });
    expect(ORDO_OBJECT_KIND_CONTRACTS.workflow_run).toMatchObject({
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
    expect(ORDO_OBJECT_KIND_CONTRACTS.tracked_link).toMatchObject({
      targetSurface: "business",
      defaultLens: "performance",
    });
    expect(ORDO_OBJECT_KIND_CONTRACTS.campaign).toMatchObject({
      targetSurface: "business",
      defaultLens: "performance",
    });
    expect(ORDO_OBJECT_KIND_CONTRACTS.conversation).toMatchObject({
      targetSurface: "business",
      defaultLens: "history",
    });
    expect(ORDO_OBJECT_KIND_CONTRACTS.operation).toMatchObject({
      targetSurface: "diagnostic",
      defaultLens: "actions",
    });
  });

  it("requires offer, people, tracked-link, content, and dashboard claims to be durably backed", () => {
    const tables = readRepoFile("src/lib/db/tables.ts");
    const offerService = readRepoFile("src/lib/offers/offer-service.ts");
    const trackedLinkService = readRepoFile("src/lib/tracked-links/tracked-link-service.ts");
    const peopleReadModel = readRepoFile("src/lib/business/people-read-model.ts");
    const contentCampaign = readRepoFile("src/lib/content/content-campaign-read-model.ts");
    const dashboard = readRepoFile("src/lib/dashboard/load-user-dashboard.ts");

    expect(tables).toContain("CREATE TABLE IF NOT EXISTS offers");
    expect(tables).toContain("CREATE TABLE IF NOT EXISTS offer_events");
    expect(tables).toContain("CREATE TABLE IF NOT EXISTS tracked_links");
    expect(tables).toContain("CREATE TABLE IF NOT EXISTS tracked_link_events");
    expect(offerService).toContain("createDraft");
    expect(offerService).toContain("recordSimulatedPurchase");
    expect(offerService).toContain("purchase_simulated");
    expect(trackedLinkService).toContain("appendEvent");
    expect(trackedLinkService).toContain("appendLinkEvent");
    expect(peopleReadModel).toContain("purchased_simulated");
    expect(peopleReadModel).toContain("purchase_simulated");
    expect(contentCampaign).toContain("combineContentPerformance");
    expect(contentCampaign).toContain("trackedLinks");
    expect(dashboard).toContain("loadPeopleReadModel");
    expect(dashboard).toContain("loadOwnerContentCampaign");
    expect(dashboard).toContain("listOfferEvents");
  });

  it("keeps cards and detail lenses as governance surfaces with evidence references", () => {
    const cardProjectors = readRepoFile("src/lib/ordo-cards/ordo-card-projectors.ts");
    const cardTypes = readRepoFile("src/lib/ordo-cards/ordo-card-types.ts");
    const businessDetails = readRepoFile("src/lib/ordo-details/load-business-object-detail.ts");
    const detailProjectors = readRepoFile("src/lib/ordo-details/ordo-detail-projectors.ts");
    const studioDetails = readRepoFile("src/lib/ordo-details/load-studio-object-detail.ts");

    expect(cardProjectors).toContain('kind: "offer"');
    expect(cardProjectors).toContain('kind: "person"');
    expect(cardProjectors).toContain('kind: "tracked_link"');
    expect(cardProjectors).toContain("sourceRefs");
    expect(cardProjectors).toContain("provenanceRefs");
    expect(cardTypes).toContain("defaultLens");
    expect(businessDetails).toContain("projectPersonToOrdoDetail");
    expect(detailProjectors).toContain("sourceRefs");
    expect(detailProjectors).toContain("provenanceRefs");
    expect(studioDetails).toContain("projectMediaAssetToOrdoDetail");
    expect(studioDetails).toContain("projectWorkflowRunToOrdoDetail");
  });

  it("keeps stale drawer and notification donors out of the production shell", () => {
    const appShell = readRepoFile("src/components/AppShell.tsx");
    const siteNav = readRepoFile("src/components/SiteNav.tsx");

    for (const source of [appShell, siteNav]) {
      expect(source).not.toContain("ShellWorkspaceMenu");
      expect(source).not.toContain("JobsRail");
      expect(source).not.toContain("AttentionInbox");
      expect(source).not.toContain("NotificationFeed");
    }
  });

  it("keeps the phase package grounded in the Product Kernel Contract", () => {
    for (const phase of PHASE_PACKAGE) {
      const content = readRepoFile(`docs/_refactor/ordo/phases/${phase}`);

      expect(content).toMatch(/Status: Implemented/);
      expect(content).toMatch(/Product Kernel Contract|Kernel Alignment/);
      expect(content).toMatch(/Kernel objects? (affected|covered):/);
      expect(content).toMatch(/scenario\s+tests?/i);
      expect(content).toMatch(/donor|Current Code Grounding|Code Grounding/i);
      expect(content).toMatch(/visibility|public|private|role/i);
    }
  });
});
