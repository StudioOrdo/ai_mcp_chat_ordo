import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  OwnerAboutWorkspace,
  PublicAboutSurface,
} from "./AboutSurfaces";
import type { AboutWorkspaceData, PublicAboutPageData } from "@/lib/about/load-about-workspace";

const publicData: PublicAboutPageData = {
  identityName: "Studio Ordo",
  tagline: "All-in-One AI Operator System",
  description: "A governed workspace for solo operators.",
  publicSections: [
    {
      id: "public-story",
      title: "Public story",
      summary: "The simple public explanation of the business.",
      currentCopy: ["Run your business like you have a team."],
      visibilityLabel: "Public",
      statusLabel: "Published",
      sourceRefs: [],
      nextActionLabel: "Ask Ordo",
      nextActionHref: "/?prompt=story",
    },
    {
      id: "mission",
      title: "Mission",
      summary: "The human reason behind the product.",
      currentCopy: ["Built for ownership."],
      visibilityLabel: "Public",
      statusLabel: "Published",
      sourceRefs: [],
      nextActionLabel: "Ask Ordo",
      nextActionHref: "/?prompt=mission",
    },
    {
      id: "offers-context",
      title: "Offers context",
      summary: "How About points to offers.",
      currentCopy: ["View offers when ready."],
      visibilityLabel: "Public",
      statusLabel: "Published",
      sourceRefs: [],
      nextActionLabel: "Ask Ordo",
      nextActionHref: "/?prompt=offers",
    },
  ],
};

function ownerWorkspace(overrides: Partial<AboutWorkspaceData> = {}): AboutWorkspaceData {
  const sections: AboutWorkspaceData["sections"] = [
    {
      id: "public-story",
      title: "Public story",
      summary: "The visitor-facing story.",
      currentCopy: [
        "Run your business like you have a team.",
        "Studio Ordo turns intent into governed work.",
      ],
      visibilityLabel: "Public",
      statusLabel: "Published",
      sourceRefs: [
        { kind: "public_copy", id: "about-public-story", label: "Public About page", href: "/about" },
      ],
      nextActionLabel: "Ask Ordo to tighten the public story",
      nextActionHref: "/?prompt=Review%20story",
    },
    {
      id: "proof-results",
      title: "Proof/results",
      summary: "Evidence that public claims are supportable.",
      currentCopy: [],
      visibilityLabel: "Owner review",
      statusLabel: "Needs evidence",
      sourceRefs: [
        { kind: "ux_contract", id: "evidence-rule", label: "Evidence-backed claim rule" },
      ],
      nextActionLabel: "Ask Ordo what proof is available",
      nextActionHref: "/?prompt=Review%20proof",
    },
  ];

  return {
    identityName: "Studio Ordo",
    publicHref: "/about",
    sections,
    filteredSections: sections,
    selectedSection: null,
    brief: {
      id: "about-brief",
      sectionId: "about",
      asOf: "2026-05-06T12:00:00.000Z",
      status: "limited",
      title: "Business Story Brief",
      summary: "Studio Ordo's public About story is live.",
      bullets: [
        "Public story is ready.",
        "Proof/results should stay in owner review.",
      ],
      recommendedAction: {
        label: "Ask Ordo to review the story",
        href: "/?prompt=review-story",
      },
      evidenceRefs: [],
      limitations: ["Proof/results is not public yet."],
    },
    query: {
      q: null,
      sectionId: null,
    },
    summary: {
      total: 2,
      published: 1,
      needsEvidence: 1,
      needsDraft: 0,
    },
    ...overrides,
  };
}

describe("About surfaces", () => {
  it("renders anonymous public About as visitor-safe story copy", () => {
    render(<PublicAboutSurface data={publicData} />);

    expect(screen.getByRole("heading", { name: "Run your business like you have a team." })).toBeInTheDocument();
    expect(screen.getByText("What this Ordo helps with")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "View offers" })).toHaveAttribute("href", "/offers");
    expect(document.body.textContent).not.toContain("Business Story Brief");
    expect(document.body.textContent).not.toContain("admin");
    expect(document.body.textContent).not.toContain("corpus");
  });

  it("renders the authenticated About brief with a second-column story selector", () => {
    render(<OwnerAboutWorkspace userName="Keith" workspace={ownerWorkspace()} />);

    expect(screen.getByLabelText("About story selection")).toHaveAttribute("data-about-selector", "true");
    expect(screen.getByRole("heading", { name: "Business Story Brief", level: 1 })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search About...")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Public story/i })).toHaveAttribute("href", "/about?section=public-story");
    expect(screen.getByRole("link", { name: /Proof\/results/i })).toHaveAttribute("href", "/about?section=proof-results");
    expect(screen.getByText("Showing 2 of 2 story sections.")).toBeInTheDocument();
  });

  it("renders one selected story section detail without global dashboard totals", () => {
    const workspace = ownerWorkspace();
    const selectedSection = workspace.sections[0] ?? null;

    render(
      <OwnerAboutWorkspace
        userName="Keith"
        workspace={{
          ...workspace,
          selectedSection,
          query: { q: null, sectionId: "public-story" },
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "Back to About" })).toHaveAttribute("href", "/about");
    const main = screen.getByLabelText("Selected About story section");
    expect(within(main).getByRole("heading", { name: "Public story", level: 1 })).toBeInTheDocument();
    expect(within(main).getByText("Public story copy")).toBeInTheDocument();
    expect(within(main).getByText("Public About page")).toHaveAttribute("href", "/about");
    expect(within(main).queryByText("Story Brief")).not.toBeInTheDocument();
  });

  it("renders a missing selected story section with a chat next action", () => {
    const workspace = ownerWorkspace({
      query: { q: null, sectionId: "founder-proof" },
      selectedSection: {
        id: "missing:founder-proof",
        title: "Story section needs a source",
        summary: "This section is not defined yet.",
        currentCopy: [],
        visibilityLabel: "Owner review",
        statusLabel: "Needs draft",
        sourceRefs: [],
        nextActionLabel: "Ask Ordo about this section",
        nextActionHref: "/?prompt=Review%20founder-proof",
      },
    });

    render(<OwnerAboutWorkspace userName="Keith" workspace={workspace} />);

    expect(screen.getByRole("heading", { name: "Story section needs a source" })).toBeInTheDocument();
    expect(screen.getByText("No public copy is published for this section yet. Keep this in owner review until Ordo can tie the claim to evidence.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask Ordo about this section" })).toHaveAttribute(
      "href",
      expect.stringContaining("prompt="),
    );
  });
});
