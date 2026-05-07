import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { KnowledgeBaseWorkspace as KnowledgeBaseWorkspaceModel } from "@/lib/knowledge/load-knowledge-base-workspace";

import { KnowledgeBaseWorkspace } from "./KnowledgeBaseWorkspace";

function workspace(overrides: Partial<KnowledgeBaseWorkspaceModel> = {}): KnowledgeBaseWorkspaceModel {
  const selectedObject = {
    id: "section:owner-playbook:briefing",
    type: "section" as const,
    title: "Owner Briefing",
    summary: "Owner Playbook",
    documentSlug: "owner-playbook",
    documentTitle: "Owner Playbook",
    documentId: "02",
    sectionSlug: "briefing",
    sectionTitle: "Owner Briefing",
    audience: "account" as const,
    contentClass: null,
    rolePersona: null,
    href: "/knowledge?document=owner-playbook&section=briefing",
    sourceLabel: "Knowledge section",
    detail: {
      contentPreview: "This owner source explains the daily brief.",
      headings: ["Brief heading"],
      sectionCount: 1,
      relatedSections: [{ title: "Follow-up", href: "/knowledge?document=owner-playbook&section=follow-up" }],
      adminLinks: [],
    },
  };

  return {
    sectionId: "knowledge-base",
    sectionTitle: "Knowledge Base",
    brief: {
      id: "knowledge-base-brief",
      sectionId: "knowledge-base",
      status: "limited",
      title: "Knowledge Brief",
      summary: "Two sections are available.",
      bullets: ["Search and filter the second column."],
      recommendedAction: { label: "Ask Ordo", href: "/" },
      evidenceRefs: [{
        kind: "knowledge",
        id: selectedObject.id,
        label: selectedObject.title,
        href: selectedObject.href,
        visibility: "owner",
      }],
      limitations: ["No usage metrics are inferred."],
      version: 1,
    },
    summary: {
      totalDocuments: 1,
      totalSections: 1,
      filteredObjects: 1,
      visibleAudiences: ["account"],
      selectedAudience: null,
      query: null,
      canInspectVisibility: false,
    },
    objects: [selectedObject],
    selectedObject: null,
    permissions: {
      canView: true,
      canSelect: true,
      canFilter: true,
      canViewDiagnostics: false,
    },
    query: {
      q: null,
      audience: null,
      document: null,
      section: null,
    },
    listHref: "/knowledge",
    ...overrides,
  };
}

describe("KnowledgeBaseWorkspace", () => {
  it("renders the Knowledge Brief and role-filtered selector", () => {
    render(<KnowledgeBaseWorkspace userName="Keith" workspace={workspace()} />);

    expect(screen.getByRole("heading", { name: "Knowledge Brief" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search knowledge...")).toBeInTheDocument();
    expect(screen.getByLabelText("Open Knowledge Base filters")).toBeInTheDocument();
    const selector = screen.getByLabelText("Knowledge Base selector");
    expect(within(selector).getByRole("link", { name: /Owner Briefing/i })).toHaveAttribute(
      "href",
      "/knowledge?document=owner-playbook&section=briefing",
    );
    expect(screen.queryByText("section:owner-playbook:briefing")).not.toBeInTheDocument();
  });

  it("renders one selected source detail without global totals first", () => {
    const selected = workspace().objects[0];
    render(
      <KnowledgeBaseWorkspace
        userName="Keith"
        workspace={workspace({
          selectedObject: selected,
          query: {
            q: null,
            audience: null,
            document: "owner-playbook",
            section: "briefing",
          },
        })}
      />,
    );

    const main = screen.getByLabelText("Knowledge Base detail");
    expect(within(main).getByRole("heading", { name: "Owner Briefing", level: 1 })).toBeInTheDocument();
    expect(within(main).getByText("This owner source explains the daily brief.")).toBeInTheDocument();
    expect(within(main).queryByText("1 documents")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Knowledge Base" })).toHaveAttribute("href", "/knowledge");
  });

  it("shows admin visibility links only when included by the read model", () => {
    const selected = {
      ...workspace().objects[0],
      detail: {
        ...workspace().objects[0].detail,
        adminLinks: [{ label: "Open content visibility", href: "/admin/content-visibility" }],
      },
    };

    render(
      <KnowledgeBaseWorkspace
        userName="Admin"
        workspace={workspace({
          selectedObject: selected,
          objects: [selected],
          query: { q: null, audience: null, document: "owner-playbook", section: "briefing" },
        })}
      />,
    );

    expect(screen.getByRole("link", { name: "Open content visibility" })).toHaveAttribute(
      "href",
      "/admin/content-visibility",
    );
  });
});
