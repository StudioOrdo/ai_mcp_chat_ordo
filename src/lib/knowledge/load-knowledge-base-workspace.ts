import { getCorpusRepository } from "@/adapters/RepositoryFactory";
import type { Document, Section } from "@/core/entities/corpus";
import type { SectionBrief } from "@/core/entities/brief";
import type { User } from "@/core/entities/user";
import type { CorpusRepository } from "@/core/use-cases/CorpusRepository";
import {
  resolveSectionBrief,
  type SectionBriefStore,
} from "@/lib/briefs/section-brief-resolver";
import {
  canUserAccessAudience,
  getPrimaryRole,
  isContentAudience,
  type ContentAudience,
} from "@/lib/access/content-access";
import { stripLeadingMarkdownTitle } from "@/lib/markdown/strip-leading-markdown-title";

const CONTENT_PREVIEW_LIMIT = 920;

export type KnowledgeBaseObjectType = "document" | "section";

export interface KnowledgeBaseQuery {
  q: string | null;
  audience: ContentAudience | null;
  document: string | null;
  section: string | null;
}

export interface KnowledgeBaseObject {
  id: string;
  type: KnowledgeBaseObjectType;
  title: string;
  summary: string;
  documentSlug: string;
  documentTitle: string;
  documentId: string;
  sectionSlug: string | null;
  sectionTitle: string | null;
  audience: ContentAudience;
  contentClass: string | null;
  rolePersona: string | null;
  href: string;
  sourceLabel: string;
  detail: {
    contentPreview: string | null;
    headings: string[];
    sectionCount: number;
    relatedSections: Array<{
      title: string;
      href: string;
    }>;
    adminLinks: Array<{
      label: string;
      href: string;
    }>;
  };
}

export interface KnowledgeBaseSummary {
  totalDocuments: number;
  totalSections: number;
  filteredObjects: number;
  visibleAudiences: ContentAudience[];
  selectedAudience: ContentAudience | null;
  query: string | null;
  canInspectVisibility: boolean;
}

export interface KnowledgeBaseWorkspace {
  sectionId: "knowledge-base";
  sectionTitle: "Knowledge Base";
  brief: SectionBrief;
  summary: KnowledgeBaseSummary;
  objects: KnowledgeBaseObject[];
  selectedObject: KnowledgeBaseObject | null;
  permissions: {
    canView: true;
    canSelect: true;
    canFilter: true;
    canViewDiagnostics: boolean;
  };
  query: KnowledgeBaseQuery;
  listHref: string;
}

export interface KnowledgeBaseLoaderDeps {
  repository?: CorpusRepository;
  briefs?: SectionBriefStore | null;
}

function firstSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return value?.trim() || null;
}

export function parseKnowledgeBaseQuery(
  rawSearchParams: Record<string, string | string[] | undefined> = {},
): KnowledgeBaseQuery {
  const rawAudience = firstSearchParam(rawSearchParams.audience);

  return {
    q: firstSearchParam(rawSearchParams.q),
    audience: rawAudience && isContentAudience(rawAudience) ? rawAudience : null,
    document: firstSearchParam(rawSearchParams.document),
    section: firstSearchParam(rawSearchParams.section),
  };
}

function buildKnowledgeHref(input: {
  q?: string | null;
  audience?: ContentAudience | null;
  document?: string | null;
  section?: string | null;
}): string {
  const params = new URLSearchParams();

  if (input.q) params.set("q", input.q);
  if (input.audience) params.set("audience", input.audience);
  if (input.document) params.set("document", input.document);
  if (input.section) params.set("section", input.section);

  const query = params.toString();
  return query ? `/knowledge?${query}` : "/knowledge";
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesQuery(object: KnowledgeBaseObject, query: string | null): boolean {
  if (!query) {
    return true;
  }

  const needle = normalizeSearchText(query);
  const haystack = normalizeSearchText([
    object.title,
    object.summary,
    object.documentSlug,
    object.documentTitle,
    object.documentId,
    object.sectionSlug ?? "",
    object.sectionTitle ?? "",
    object.audience,
    object.contentClass ?? "",
    object.rolePersona ?? "",
    object.detail.headings.join(" "),
    object.detail.contentPreview ?? "",
  ].join(" "));

  return haystack.includes(needle);
}

function canReadAudience(
  audience: ContentAudience,
  user: Pick<User, "roles" | "tier">,
): boolean {
  const role = getPrimaryRole(user.roles);
  return canUserAccessAudience({ audience, role, tier: user.tier });
}

function truncateContent(content: string): string {
  const normalized = content.trim();

  if (normalized.length <= CONTENT_PREVIEW_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, CONTENT_PREVIEW_LIMIT).trim()}...`;
}

function sortDocuments(left: Document, right: Document): number {
  return left.number.localeCompare(right.number, undefined, { numeric: true }) ||
    left.title.localeCompare(right.title);
}

function sortSections(left: Section, right: Section): number {
  return left.documentSlug.localeCompare(right.documentSlug) ||
    left.sectionSlug.localeCompare(right.sectionSlug, undefined, { numeric: true });
}

function documentObject(
  document: Document,
  accessibleSections: Section[],
  query: KnowledgeBaseQuery,
  canInspectVisibility: boolean,
): KnowledgeBaseObject {
  const sectionCount = accessibleSections.length;

  return {
    id: `document:${document.slug}`,
    type: "document",
    title: document.title,
    summary: sectionCount > 0
      ? `${sectionCount} accessible section${sectionCount === 1 ? "" : "s"}`
      : "No accessible sections yet.",
    documentSlug: document.slug,
    documentTitle: document.title,
    documentId: document.number,
    sectionSlug: null,
    sectionTitle: null,
    audience: document.audience,
    contentClass: document.class ?? null,
    rolePersona: document.rolePersona ?? null,
    href: buildKnowledgeHref({
      q: query.q,
      audience: query.audience,
      document: document.slug,
    }),
    sourceLabel: "Knowledge document",
    detail: {
      contentPreview: sectionCount > 0
        ? accessibleSections.slice(0, 3).map((section) => section.title).join(" · ")
        : null,
      headings: [],
      sectionCount,
      relatedSections: accessibleSections.slice(0, 5).map((section) => ({
        title: section.title,
        href: buildKnowledgeHref({
          q: query.q,
          audience: query.audience,
          document: section.documentSlug,
          section: section.sectionSlug,
        }),
      })),
      adminLinks: canInspectVisibility
        ? [{ label: "Open content visibility", href: "/admin/content-visibility" }]
        : [],
    },
  };
}

function sectionObject(
  document: Document,
  section: Section,
  siblingSections: Section[],
  query: KnowledgeBaseQuery,
  canInspectVisibility: boolean,
): KnowledgeBaseObject {
  const content = stripLeadingMarkdownTitle(section.title, section.content);

  return {
    id: `section:${section.documentSlug}:${section.sectionSlug}`,
    type: "section",
    title: section.title,
    summary: document.title,
    documentSlug: document.slug,
    documentTitle: document.title,
    documentId: document.number,
    sectionSlug: section.sectionSlug,
    sectionTitle: section.title,
    audience: section.audience,
    contentClass: section.contentClass ?? document.class ?? null,
    rolePersona: section.rolePersona ?? document.rolePersona ?? null,
    href: buildKnowledgeHref({
      q: query.q,
      audience: query.audience,
      document: section.documentSlug,
      section: section.sectionSlug,
    }),
    sourceLabel: "Knowledge section",
    detail: {
      contentPreview: truncateContent(content),
      headings: section.headings,
      sectionCount: 1,
      relatedSections: siblingSections
        .filter((candidate) => candidate.sectionSlug !== section.sectionSlug)
        .slice(0, 4)
        .map((candidate) => ({
          title: candidate.title,
          href: buildKnowledgeHref({
            q: query.q,
            audience: query.audience,
            document: candidate.documentSlug,
            section: candidate.sectionSlug,
          }),
        })),
      adminLinks: canInspectVisibility
        ? [
          { label: "Open content visibility", href: "/admin/content-visibility" },
          { label: "Open training donor", href: `/admin/training/${encodeURIComponent(document.slug)}` },
        ]
        : [],
    },
  };
}

function buildBrief(summary: KnowledgeBaseSummary, objects: KnowledgeBaseObject[]): SectionBrief {
  if (objects.length === 0) {
    return {
      id: "knowledge-base-brief-empty",
      sectionId: "knowledge-base",
      status: "limited",
      title: "Knowledge Brief",
      summary: "No accessible knowledge sources are available for this account context.",
      bullets: [
        "The source index is role-filtered before anything renders.",
        "Ask Ordo in chat when you need guidance; this surface only shows inspectable source evidence.",
      ],
      recommendedAction: { label: "Ask Ordo", href: "/" },
      evidenceRefs: [],
      limitations: ["This is a deterministic source inventory, not live retrieval analytics."],
      version: 1,
    };
  }

  return {
    id: "knowledge-base-brief",
    sectionId: "knowledge-base",
    status: "limited",
    title: "Knowledge Brief",
    summary: `${summary.totalDocuments} knowledge document${summary.totalDocuments === 1 ? "" : "s"} and ${summary.totalSections} accessible section${summary.totalSections === 1 ? "" : "s"} are available for this role.`,
    bullets: [
      "Search and filter the second column when you need to inspect the source behind Ordo's answers.",
      "Selected details show one document or section with visibility and source links.",
      "Admin-only visibility controls stay behind admin gates.",
    ],
    recommendedAction: { label: "Ask Ordo", href: "/" },
    evidenceRefs: objects.slice(0, 3).map((object) => ({
      kind: "knowledge",
      id: object.id,
      label: object.title,
      href: object.href,
      visibility: object.audience === "admin" || object.audience === "staff" ? "admin" : "owner",
    })),
    limitations: ["No usage, ranking, or retrieval-performance metrics are inferred in this pass."],
    version: 1,
  };
}

export async function loadKnowledgeBaseWorkspace(
  user: Pick<User, "roles" | "tier">,
  rawSearchParams: Record<string, string | string[] | undefined> = {},
  deps: KnowledgeBaseLoaderDeps = {},
): Promise<KnowledgeBaseWorkspace> {
  const query = parseKnowledgeBaseQuery(rawSearchParams);
  const repository = deps.repository ?? getCorpusRepository();
  const role = getPrimaryRole(user.roles);
  const canInspectVisibility = user.roles.includes("ADMIN");
  const [documents, allSections] = await Promise.all([
    repository.getAllDocuments(),
    repository.getAllSections(),
  ]);

  const sectionsByDocument = new Map<string, Section[]>();
  for (const section of allSections.filter((section) => canReadAudience(section.audience, user))) {
    const existing = sectionsByDocument.get(section.documentSlug) ?? [];
    existing.push(section);
    sectionsByDocument.set(section.documentSlug, existing);
  }

  for (const sections of sectionsByDocument.values()) {
    sections.sort(sortSections);
  }

  const readableDocuments = documents
    .filter((document) => canReadAudience(document.audience, user) || (sectionsByDocument.get(document.slug)?.length ?? 0) > 0)
    .sort(sortDocuments);

  const baseObjects = readableDocuments.flatMap((document) => {
    const accessibleSections = sectionsByDocument.get(document.slug) ?? [];
    const rows: KnowledgeBaseObject[] = [
      documentObject(document, accessibleSections, query, canInspectVisibility),
    ];

    for (const section of accessibleSections) {
      rows.push(sectionObject(document, section, accessibleSections, query, canInspectVisibility));
    }

    return rows;
  });

  const filteredObjects = baseObjects.filter((object) =>
    (!query.audience || object.audience === query.audience) &&
    matchesQuery(object, query.q),
  );

  const selectedObject = query.document
    ? filteredObjects.find((object) =>
      object.documentSlug === query.document &&
      (query.section ? object.sectionSlug === query.section : object.type === "document"),
    ) ?? null
    : null;

  const visibleAudienceSet = new Set<ContentAudience>(baseObjects.map((object) => object.audience));
  const summary: KnowledgeBaseSummary = {
    totalDocuments: readableDocuments.length,
    totalSections: Array.from(sectionsByDocument.values()).reduce((count, sections) => count + sections.length, 0),
    filteredObjects: filteredObjects.length,
    visibleAudiences: Array.from(visibleAudienceSet).sort(),
    selectedAudience: query.audience,
    query: query.q,
    canInspectVisibility,
  };

  const fallbackBrief = buildBrief(summary, filteredObjects);
  const { brief } = await resolveSectionBrief({
    briefs: deps.briefs,
    sectionId: "knowledge-base",
    ownerUserId: null,
    visibilityPolicy: role === "ADMIN" ? "admin" : "owner",
    fallback: fallbackBrief,
  });

  return {
    sectionId: "knowledge-base",
    sectionTitle: "Knowledge Base",
    brief,
    summary,
    objects: filteredObjects,
    selectedObject,
    permissions: {
      canView: true,
      canSelect: true,
      canFilter: true,
      canViewDiagnostics: role === "ADMIN",
    },
    query,
    listHref: buildKnowledgeHref({ q: query.q, audience: query.audience }),
  };
}
