import { describe, expect, it, vi } from "vitest";

import type { Document } from "@/core/entities/corpus";
import { Section } from "@/core/entities/corpus";
import type { CorpusRepository } from "@/core/use-cases/CorpusRepository";

import { loadKnowledgeBaseWorkspace, parseKnowledgeBaseQuery } from "./load-knowledge-base-workspace";

function repository(documents: Document[], sections: Section[]): CorpusRepository {
  return {
    getAllDocuments: vi.fn().mockResolvedValue(documents),
    getAllSections: vi.fn().mockResolvedValue(sections),
    getSectionsByDocument: vi.fn(async (documentSlug: string) =>
      sections.filter((section) => section.documentSlug === documentSlug),
    ),
    getSection: vi.fn(async (documentSlug: string, sectionSlug: string) => {
      const section = sections.find(
        (candidate) => candidate.documentSlug === documentSlug && candidate.sectionSlug === sectionSlug,
      );
      if (!section) throw new Error("missing");
      return section;
    }),
    getDocument: vi.fn(async (slug: string) => documents.find((document) => document.slug === slug) ?? null),
  };
}

const documents: Document[] = [
  { slug: "public-guide", title: "Public Guide", number: "01", audience: "public" },
  { slug: "owner-playbook", title: "Owner Playbook", number: "02", audience: "account" },
  { slug: "admin-handbook", title: "Admin Handbook", number: "03", audience: "admin" },
  { slug: "empty-visible", title: "Empty Visible", number: "04", audience: "account" },
];

const sections = [
  new Section(
    "public-guide",
    "overview",
    "Public Overview",
    "# Public Overview\n\nUse this public source safely.",
    [],
    [],
    ["Public heading"],
    "public",
  ),
  new Section(
    "owner-playbook",
    "briefing",
    "Owner Briefing",
    "# Owner Briefing\n\nThis owner source explains the daily brief.",
    [],
    [],
    ["Brief heading"],
    "account",
  ),
  new Section(
    "admin-handbook",
    "restore",
    "Restore Controls",
    "# Restore Controls\n\nAdmin-only restore guidance.",
    [],
    [],
    ["Restore heading"],
    "admin",
  ),
];

describe("parseKnowledgeBaseQuery", () => {
  it("normalizes search and supported visibility filters", () => {
    expect(parseKnowledgeBaseQuery({ q: " brief ", audience: "admin", document: "owner-playbook" })).toEqual({
      q: "brief",
      audience: "admin",
      document: "owner-playbook",
      section: null,
    });
    expect(parseKnowledgeBaseQuery({ audience: "private" })).toMatchObject({ audience: null });
  });
});

describe("loadKnowledgeBaseWorkspace", () => {
  it("filters owner-visible knowledge before rendering rows", async () => {
    const workspace = await loadKnowledgeBaseWorkspace(
      { roles: ["AUTHENTICATED"], tier: "account" },
      {},
      { repository: repository(documents, sections) },
    );

    expect(workspace.objects.map((object) => object.title)).toContain("Owner Briefing");
    expect(workspace.objects.map((object) => object.title)).toContain("Empty Visible");
    expect(workspace.objects.map((object) => object.title)).not.toContain("Restore Controls");
    expect(workspace.summary.totalDocuments).toBe(3);
    expect(workspace.summary.totalSections).toBe(2);
    expect(workspace.brief.title).toBe("Knowledge Brief");
    expect(workspace.brief.limitations[0]).toContain("No usage");
  });

  it("allows admins to inspect admin-only knowledge and visibility links", async () => {
    const workspace = await loadKnowledgeBaseWorkspace(
      { roles: ["ADMIN"] },
      { document: "admin-handbook", section: "restore" },
      { repository: repository(documents, sections) },
    );

    expect(workspace.selectedObject).toMatchObject({
      title: "Restore Controls",
      audience: "admin",
    });
    expect(workspace.selectedObject?.detail.adminLinks.map((link) => link.href)).toContain("/admin/content-visibility");
    expect(workspace.permissions.canViewDiagnostics).toBe(true);
  });

  it("matches search against document, section, title, and source labels", async () => {
    const workspace = await loadKnowledgeBaseWorkspace(
      { roles: ["AUTHENTICATED"], tier: "account" },
      { q: "daily brief" },
      { repository: repository(documents, sections) },
    );

    expect(workspace.objects.map((object) => object.title)).toEqual(["Owner Briefing"]);
  });

  it("renders a limited brief for an empty accessible source index", async () => {
    const workspace = await loadKnowledgeBaseWorkspace(
      { roles: ["AUTHENTICATED"], tier: "account" },
      {},
      { repository: repository([], []) },
    );

    expect(workspace.objects).toEqual([]);
    expect(workspace.brief.status).toBe("limited");
    expect(workspace.brief.summary).toContain("No accessible knowledge sources");
  });

  it("returns null selected detail when a document is missing or hidden", async () => {
    const workspace = await loadKnowledgeBaseWorkspace(
      { roles: ["AUTHENTICATED"], tier: "account" },
      { document: "admin-handbook", section: "restore" },
      { repository: repository(documents, sections) },
    );

    expect(workspace.selectedObject).toBeNull();
  });
});
