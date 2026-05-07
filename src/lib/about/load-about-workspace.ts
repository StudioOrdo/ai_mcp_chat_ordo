import type { SectionBrief } from "@/components/governance/GovernanceSectionFrame";
import type { InstanceIdentity, InstanceServices } from "@/lib/config/defaults";
import {
  resolveSectionBrief,
  type SectionBriefStore,
} from "@/lib/briefs/section-brief-resolver";
import { getInstanceIdentity, getInstanceServices } from "@/lib/config/instance";

export const ABOUT_STORY_SECTION_IDS = [
  "public-story",
  "mission",
  "offers-context",
  "proof-results",
  "open-source-appliance",
] as const;

export type AboutStorySectionId = typeof ABOUT_STORY_SECTION_IDS[number];

export interface AboutStorySourceRef {
  kind: "public_copy" | "business_identity" | "offer_surface" | "ux_contract";
  id: string;
  label: string;
  href?: string;
}

export interface AboutStorySection {
  id: AboutStorySectionId | `missing:${string}`;
  title: string;
  summary: string;
  currentCopy: string[];
  visibilityLabel: "Public" | "Owner review";
  statusLabel: "Published" | "Needs evidence" | "Needs draft";
  sourceRefs: AboutStorySourceRef[];
  nextActionLabel: string;
  nextActionHref: string;
}

export interface PublicAboutPageData {
  identityName: string;
  tagline: string;
  description: string;
  publicSections: AboutStorySection[];
}

export interface AboutWorkspaceQuery {
  q: string | null;
  sectionId: string | null;
}

export interface AboutWorkspaceSummary {
  total: number;
  published: number;
  needsEvidence: number;
  needsDraft: number;
}

export interface AboutWorkspaceData {
  identityName: string;
  publicHref: string;
  sections: AboutStorySection[];
  filteredSections: AboutStorySection[];
  selectedSection: AboutStorySection | null;
  brief: SectionBrief;
  query: AboutWorkspaceQuery;
  summary: AboutWorkspaceSummary;
}

type RawAboutSearchParams = Record<string, string | string[] | undefined>;

interface AboutWorkspaceDependencies {
  identity?: InstanceIdentity;
  services?: InstanceServices;
  now?: Date;
  briefs?: SectionBriefStore | null;
}

function firstSearchValue(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseAboutWorkspaceQuery(
  rawSearchParams: RawAboutSearchParams = {},
): AboutWorkspaceQuery {
  return {
    q: firstSearchValue(rawSearchParams.q)?.slice(0, 120) ?? null,
    sectionId: firstSearchValue(rawSearchParams.section)?.slice(0, 120) ?? null,
  };
}

export function buildAboutHref(
  current: Partial<AboutWorkspaceQuery> = {},
  patch: Partial<AboutWorkspaceQuery> = {},
): string {
  const query = { ...current, ...patch };
  const searchParams = new URLSearchParams();

  if (query.q) searchParams.set("q", query.q);
  if (query.sectionId) searchParams.set("section", query.sectionId);

  const queryString = searchParams.toString();
  return queryString ? `/about?${queryString}` : "/about";
}

function chatPromptHref(prompt: string): string {
  return `/?prompt=${encodeURIComponent(prompt)}`;
}

function resolveIdentity(dependencies: AboutWorkspaceDependencies): InstanceIdentity {
  return dependencies.identity ?? getInstanceIdentity();
}

function resolveServices(dependencies: AboutWorkspaceDependencies): InstanceServices {
  return dependencies.services ?? getInstanceServices();
}

function offerContextCopy(services: InstanceServices): string[] {
  if (services.offerings.length > 0) {
    return [
      `The public offers page currently has ${services.offerings.length} configured offer${services.offerings.length === 1 ? "" : "s"} available as visitor context.`,
      "The About story should explain why those offers exist without duplicating the selling surface.",
    ];
  }

  return [
    "The public offers page is the canonical place for what the business sells.",
    "The About story should point visitors there without inventing offer details before a public offer is ready.",
  ];
}

function buildAboutSections(
  identity: InstanceIdentity,
  services: InstanceServices,
): AboutStorySection[] {
  return [
    {
      id: "public-story",
      title: "Public story",
      summary: "The simple public explanation of what this Ordo instance helps the owner do.",
      currentCopy: [
        "Run your business like you have a team.",
        `${identity.name} is an AI operating system for solo operators who need help turning intent into governed work, offers, content, and follow-up.`,
      ],
      visibilityLabel: "Public",
      statusLabel: "Published",
      sourceRefs: [
        { kind: "public_copy", id: "about-public-story", label: "Public About page", href: "/about" },
        { kind: "business_identity", id: "business-identity", label: "Business identity" },
      ],
      nextActionLabel: "Ask Ordo to tighten the public story",
      nextActionHref: chatPromptHref("Review the public About story and suggest a tighter version for visitors."),
    },
    {
      id: "mission",
      title: "Mission",
      summary: "The human reason behind the product and the business.",
      currentCopy: [
        "Ordo is built for people who have to create their own economic path and need leverage without losing ownership.",
        "The system should feel like a calm operating staff, with chat as the interface and evidence as the record.",
      ],
      visibilityLabel: "Public",
      statusLabel: "Published",
      sourceRefs: [
        { kind: "ux_contract", id: "ux-north-star", label: "UX north star" },
        { kind: "public_copy", id: "about-mission", label: "Public About page", href: "/about" },
      ],
      nextActionLabel: "Ask Ordo to revise the mission copy",
      nextActionHref: chatPromptHref("Review the About mission copy for clarity, dignity, and visitor usefulness."),
    },
    {
      id: "offers-context",
      title: "Offers context",
      summary: "How the About story points visitors toward the public offer surface.",
      currentCopy: offerContextCopy(services),
      visibilityLabel: "Public",
      statusLabel: "Published",
      sourceRefs: [
        { kind: "offer_surface", id: "public-offers", label: "Public offers", href: "/offers" },
        { kind: "public_copy", id: "about-offers-context", label: "Public About page", href: "/about" },
      ],
      nextActionLabel: "Ask Ordo to align About with current offers",
      nextActionHref: chatPromptHref("Compare the public About story with current offers and suggest any copy that should change."),
    },
    {
      id: "proof-results",
      title: "Proof/results",
      summary: "Evidence that the story is working and that public claims are supportable.",
      currentCopy: [],
      visibilityLabel: "Owner review",
      statusLabel: "Needs evidence",
      sourceRefs: [
        { kind: "ux_contract", id: "evidence-backed-claims", label: "Evidence-backed claim rule" },
      ],
      nextActionLabel: "Ask Ordo what proof is available",
      nextActionHref: chatPromptHref("Review available evidence for the public About story. Do not invent proof; identify what is missing."),
    },
    {
      id: "open-source-appliance",
      title: "Open-source/appliance note",
      summary: "The ownership and self-hosting note that belongs on the public story.",
      currentCopy: [
        "Studio Ordo is open source and designed to run on infrastructure the owner controls.",
        "The public story can say the system is self-hostable without forcing visitors through implementation details.",
      ],
      visibilityLabel: "Public",
      statusLabel: "Published",
      sourceRefs: [
        { kind: "public_copy", id: "about-open-source", label: "Public About page", href: "/about" },
        { kind: "business_identity", id: "business-identity", label: "Business identity" },
      ],
      nextActionLabel: "Ask Ordo to simplify the ownership note",
      nextActionHref: chatPromptHref("Review the About ownership and self-hosting copy for plain visitor language."),
    },
  ];
}

function summarizeAboutSections(sections: readonly AboutStorySection[]): AboutWorkspaceSummary {
  return {
    total: sections.length,
    published: sections.filter((section) => section.statusLabel === "Published").length,
    needsEvidence: sections.filter((section) => section.statusLabel === "Needs evidence").length,
    needsDraft: sections.filter((section) => section.statusLabel === "Needs draft").length,
  };
}

function buildBrief(
  identity: InstanceIdentity,
  summary: AboutWorkspaceSummary,
  sections: readonly AboutStorySection[],
  now: Date,
): SectionBrief {
  const proofSection = sections.find((section) => section.id === "proof-results");
  const hasMissingProof = proofSection?.statusLabel === "Needs evidence";

  return {
    id: "about-business-story-brief",
    sectionId: "about",
    asOf: now.toISOString(),
    status: hasMissingProof ? "limited" : "fresh",
    title: "Business Story Brief",
    summary: `${identity.name}'s public About story is live. It explains the mission and points visitors toward offers without exposing owner-only evidence.`,
    bullets: [
      `${summary.published} story sections are public and ready for visitor review.`,
      "The About page should explain the business, not become a page-builder or production archive.",
      hasMissingProof
        ? "Proof/results should stay in owner review until durable evidence supports a public claim."
        : "Proof/results have enough evidence for public copy review.",
    ],
    recommendedAction: {
      label: "Ask Ordo to review the story",
      href: chatPromptHref("Review the public About story. Keep public copy simple, visitor-safe, and evidence-backed."),
    },
    evidenceRefs: [
      { kind: "about_section", id: "public-story", label: "Public story", href: buildAboutHref({}, { sectionId: "public-story" }) },
      { kind: "about_section", id: "mission", label: "Mission", href: buildAboutHref({}, { sectionId: "mission" }) },
      { kind: "about_section", id: "proof-results", label: "Proof/results", href: buildAboutHref({}, { sectionId: "proof-results" }) },
    ],
    limitations: hasMissingProof
      ? ["Public proof/results copy is intentionally withheld until Ordo has durable evidence."]
      : [],
  };
}

function filterSections(
  sections: readonly AboutStorySection[],
  query: AboutWorkspaceQuery,
): AboutStorySection[] {
  if (!query.q) {
    return [...sections];
  }

  const needle = query.q.toLowerCase();
  return sections.filter((section) => [
    section.title,
    section.summary,
    section.visibilityLabel,
    section.statusLabel,
    ...section.currentCopy,
    ...section.sourceRefs.map((sourceRef) => sourceRef.label),
  ].some((value) => value.toLowerCase().includes(needle)));
}

function buildMissingSection(sectionId: string): AboutStorySection {
  return {
    id: `missing:${sectionId}`,
    title: "Story section needs a source",
    summary: "This story section is not defined yet. Ask Ordo to identify whether it belongs in the public About story.",
    currentCopy: [],
    visibilityLabel: "Owner review",
    statusLabel: "Needs draft",
    sourceRefs: [],
    nextActionLabel: "Ask Ordo about this section",
    nextActionHref: chatPromptHref(`Review whether "${sectionId}" belongs in the public About story and suggest the safest next step.`),
  };
}

export function loadPublicAboutPageData(
  dependencies: AboutWorkspaceDependencies = {},
): PublicAboutPageData {
  const identity = resolveIdentity(dependencies);
  const services = resolveServices(dependencies);
  const sections = buildAboutSections(identity, services);

  return {
    identityName: identity.name,
    tagline: identity.tagline,
    description: identity.description,
    publicSections: sections.filter((section) => (
      section.visibilityLabel === "Public" && section.currentCopy.length > 0
    )),
  };
}

export async function loadAboutWorkspace(
  rawSearchParams: RawAboutSearchParams = {},
  dependencies: AboutWorkspaceDependencies = {},
): Promise<AboutWorkspaceData> {
  const identity = resolveIdentity(dependencies);
  const services = resolveServices(dependencies);
  const now = dependencies.now ?? new Date();
  const query = parseAboutWorkspaceQuery(rawSearchParams);
  const sections = buildAboutSections(identity, services);
  const filteredSections = filterSections(sections, query);
  const selectedSection = query.sectionId
    ? sections.find((section) => section.id === query.sectionId) ?? buildMissingSection(query.sectionId)
    : null;
  const summary = summarizeAboutSections(sections);

  const fallbackBrief = buildBrief(identity, summary, sections, now);
  const { brief } = await resolveSectionBrief({
    briefs: dependencies.briefs,
    sectionId: "about",
    ownerUserId: null,
    visibilityPolicy: "owner",
    fallback: fallbackBrief,
  });

  return {
    identityName: identity.name,
    publicHref: "/about",
    sections,
    filteredSections,
    selectedSection,
    brief,
    query,
    summary,
  };
}
