import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Document } from "@/core/entities/corpus";
import { Section } from "@/core/entities/corpus";

const { getCorpusRepositoryMock } = vi.hoisted(() => ({
  getCorpusRepositoryMock: vi.fn(),
}));

vi.mock("../adapters/RepositoryFactory", () => ({
  getCorpusRepository: getCorpusRepositoryMock,
}));

function createRepository(sections: Section[], documents: Document[] = [
  { slug: "archetype-atlas", title: "The Archetype Atlas", number: "3", audience: "public" },
]) {
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

      if (!section) {
        throw new Error(`Missing section: ${documentSlug}/${sectionSlug}`);
      }

      return section;
    }),
    getDocument: vi.fn(async (slug: string) => documents.find((document) => document.slug === slug) ?? null),
  };
}

describe("corpus-library", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("adapts canonical knowledge-access search results without rebuilding links", async () => {
    const sections = [
      new Section(
        "archetype-atlas",
        "ch04-the-sage",
        "The Sage: Clarity, Method, Evidence",
        "The Sage values method, clarity, rigor, and evidence in judgment.",
        [],
        ["evidence"],
        ["clarity", "method"],
      ),
    ];

    getCorpusRepositoryMock.mockReturnValue(createRepository(sections));

    const { searchCorpus } = await import("./corpus-library");
    const results = await searchCorpus("clarity method evidence", 5, { role: "AUTHENTICATED" });

    expect(results[0]).toMatchObject({
      canonicalPath: "/library/archetype-atlas/ch04-the-sage",
      resolverPath: "/library/section/ch04-the-sage",
      documentSlug: "archetype-atlas",
      sectionSlug: "ch04-the-sage",
    });
  });

  it("reuses service-normalized section content in the legacy facade", async () => {
    const sections = [
      new Section(
        "archetype-atlas",
        "ch04-the-sage",
        "The Sage: Clarity, Method, Evidence",
        "# The Sage: Clarity, Method, Evidence\n\nThe Sage values method, clarity, rigor, and evidence in judgment.",
        [],
        ["evidence"],
        ["clarity", "method"],
      ),
      new Section(
        "archetype-atlas",
        "ch05-the-magician",
        "The Magician: Method In Practice",
        "Method and clarity become transformation when they are deployed repeatedly in practice.",
        [],
        ["method"],
        ["clarity", "deployment"],
      ),
    ];

    getCorpusRepositoryMock.mockReturnValue(createRepository(sections));

    const { getSectionFull } = await import("./corpus-library");
    const section = await getSectionFull("archetype-atlas", "ch04-the-sage", { role: "AUTHENTICATED" });

    expect(section).toEqual({
      title: "The Sage: Clarity, Method, Evidence",
      content: "The Sage values method, clarity, rigor, and evidence in judgment.",
      document: "3. The Archetype Atlas",
      book: "3. The Archetype Atlas",
    });
  });

  it("filters system handbook search and full-section reads by every role through the facade", async () => {
    const documents: Document[] = [
      { slug: "system-docs", title: "Studio Ordo System Handbook", number: "00", audience: "public" },
    ];
    const sections = [
      new Section(
        "system-docs",
        "00-public-chief-of-staff",
        "Public Chief of Staff",
        "The public assistant explains Ordo without private authority.",
        [],
        [],
        [],
        "public",
      ),
      new Section(
        "system-docs",
        "02-member-workspace-basics",
        "Member Workspace Basics",
        "Members use operation cards for personal workspace tasks.",
        [],
        [],
        [],
        "member",
      ),
      new Section(
        "system-docs",
        "03-apprentice-guided-practice",
        "Apprentice Guided Practice",
        "Apprentices learn guided practice with safe operation evidence.",
        [],
        [],
        [],
        "apprentice",
      ),
      new Section(
        "system-docs",
        "05-staff-operations-workspace",
        "Staff Operations Workspace",
        "Staff use operations workspace triage and tooling evidence.",
        [],
        [],
        [],
        "staff",
      ),
      new Section(
        "system-docs",
        "06-admin-appliance-operations",
        "Admin Appliance Operations",
        "Admins manage restore safety and provider controls.",
        [],
        [],
        [],
        "admin",
      ),
    ];

    getCorpusRepositoryMock.mockReturnValue(createRepository(sections, documents));

    const { searchCorpus, getSectionFull } = await import("./corpus-library");

    const anonymousResults = await searchCorpus("assistant operations workspace apprentice restore provider", 10, {
      role: "ANONYMOUS",
    });
    const memberResults = await searchCorpus("assistant operations workspace apprentice restore provider", 10, {
      role: "AUTHENTICATED",
    });
    const apprenticeResults = await searchCorpus("assistant operations workspace apprentice restore provider", 10, {
      role: "APPRENTICE",
    });
    const staffResults = await searchCorpus("assistant operations workspace apprentice restore provider", 10, {
      role: "STAFF",
    });
    const adminResults = await searchCorpus("assistant operations workspace apprentice restore provider", 10, {
      role: "ADMIN",
    });

    expect(new Set(anonymousResults.map((result) => result.sectionSlug))).toEqual(new Set([
      "00-public-chief-of-staff",
    ]));
    expect(new Set(memberResults.map((result) => result.sectionSlug))).toEqual(new Set([
      "02-member-workspace-basics",
      "00-public-chief-of-staff",
    ]));
    expect(new Set(apprenticeResults.map((result) => result.sectionSlug))).toEqual(new Set([
      "03-apprentice-guided-practice",
      "02-member-workspace-basics",
      "00-public-chief-of-staff",
    ]));
    expect(new Set(staffResults.map((result) => result.sectionSlug))).toEqual(new Set([
      "05-staff-operations-workspace",
      "03-apprentice-guided-practice",
      "02-member-workspace-basics",
      "00-public-chief-of-staff",
    ]));
    expect(new Set(adminResults.map((result) => result.sectionSlug))).toEqual(new Set([
      "06-admin-appliance-operations",
      "05-staff-operations-workspace",
      "03-apprentice-guided-practice",
      "02-member-workspace-basics",
      "00-public-chief-of-staff",
    ]));

    await expect(getSectionFull("system-docs", "06-admin-appliance-operations", { role: "ANONYMOUS" })).resolves.toBeNull();
    await expect(getSectionFull("system-docs", "05-staff-operations-workspace", { role: "AUTHENTICATED" })).resolves.toBeNull();
    await expect(getSectionFull("system-docs", "03-apprentice-guided-practice", { role: "APPRENTICE" })).resolves.toMatchObject({
      title: "Apprentice Guided Practice",
    });
    await expect(getSectionFull("system-docs", "05-staff-operations-workspace", { role: "STAFF" })).resolves.toMatchObject({
      title: "Staff Operations Workspace",
    });
    await expect(getSectionFull("system-docs", "06-admin-appliance-operations", { role: "ADMIN" })).resolves.toMatchObject({
      title: "Admin Appliance Operations",
    });
  });
});
