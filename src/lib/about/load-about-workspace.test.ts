import { describe, expect, it } from "vitest";

import {
  buildAboutHref,
  loadAboutWorkspace,
  loadPublicAboutPageData,
  parseAboutWorkspaceQuery,
} from "./load-about-workspace";
import type { InstanceIdentity, InstanceServices } from "@/lib/config/defaults";

const identity: InstanceIdentity = {
  name: "Studio Ordo",
  shortName: "Ordo",
  tagline: "All-in-One AI Operator System",
  description: "A governed workspace for solo operators.",
  domain: "studioordo.com",
  logoPath: "/logo.png",
  markText: "O",
};

const emptyServices: InstanceServices = {
  offerings: [],
  bookingEnabled: false,
};

const servicesWithOffers: InstanceServices = {
  offerings: [
    {
      id: "workflow-audit",
      name: "Workflow audit",
      description: "Find the stuck points in the business workflow.",
      lane: "individual",
      estimatedPrice: 1200,
    },
  ],
  bookingEnabled: false,
};

describe("about workspace read model", () => {
  it("builds a public visitor story without owner-only governance copy", () => {
    const data = loadPublicAboutPageData({ identity, services: emptyServices });

    expect(data.identityName).toBe("Studio Ordo");
    expect(data.publicSections.map((section) => section.title)).toContain("Public story");
    expect(data.publicSections.map((section) => section.title)).not.toContain("Proof/results");
    expect(JSON.stringify(data)).not.toContain("Business Story Brief");
    expect(JSON.stringify(data)).not.toContain("corpus");
  });

  it("builds the authenticated Business Story Brief and story selector objects", async () => {
    const workspace = await loadAboutWorkspace({}, {
      identity,
      services: servicesWithOffers,
      now: new Date("2026-05-06T12:00:00.000Z"),
    });

    expect(workspace.brief.title).toBe("Business Story Brief");
    expect(workspace.brief.status).toBe("limited");
    expect(workspace.brief.asOf).toBe("2026-05-06T12:00:00.000Z");
    expect(workspace.summary).toMatchObject({
      total: 5,
      published: 4,
      needsEvidence: 1,
      needsDraft: 0,
    });
    expect(workspace.sections.map((section) => section.id)).toEqual([
      "public-story",
      "mission",
      "offers-context",
      "proof-results",
      "open-source-appliance",
    ]);
    expect(workspace.sections.find((section) => section.id === "offers-context")?.currentCopy.join(" ")).toContain(
      "1 configured offer",
    );
  });

  it("filters and selects story sections from query params", async () => {
    const workspace = await loadAboutWorkspace({
      q: "mission",
      section: "mission",
    }, {
      identity,
      services: emptyServices,
      now: new Date("2026-05-06T12:00:00.000Z"),
    });

    expect(workspace.query).toEqual({
      q: "mission",
      sectionId: "mission",
    });
    expect(workspace.filteredSections).toHaveLength(1);
    expect(workspace.filteredSections[0]?.id).toBe("mission");
    expect(workspace.selectedSection?.title).toBe("Mission");
  });

  it("returns an owner-safe missing section object for unknown selected sections", async () => {
    const workspace = await loadAboutWorkspace({ section: "founder-proof" }, {
      identity,
      services: emptyServices,
      now: new Date("2026-05-06T12:00:00.000Z"),
    });

    expect(workspace.selectedSection).toMatchObject({
      id: "missing:founder-proof",
      title: "Story section needs a source",
      statusLabel: "Needs draft",
      visibilityLabel: "Owner review",
      currentCopy: [],
    });
    expect(workspace.selectedSection?.nextActionHref).toContain("prompt=");
  });

  it("parses and builds stable About selector hrefs", () => {
    expect(parseAboutWorkspaceQuery({
      q: " public story ",
      section: ["mission", "ignored"],
    })).toEqual({
      q: "public story",
      sectionId: "mission",
    });

    expect(buildAboutHref({ q: "mission", sectionId: "mission" }, { sectionId: "public-story" })).toBe(
      "/about?q=mission&section=public-story",
    );
    expect(buildAboutHref({ q: "mission", sectionId: "mission" }, { q: null, sectionId: null })).toBe("/about");
  });
});
