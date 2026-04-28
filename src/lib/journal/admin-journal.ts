import { notFound, redirect } from "next/navigation";

import {
  getBlogAssetRepository,
  getBlogPostArtifactRepository,
  getBlogPostRepository,
  getBlogPostRevisionRepository,
} from "@/adapters/RepositoryFactory";
import type { BlogPost, BlogPostSection, BlogPostStatus } from "@/core/entities/blog";
import type { BlogPostArtifact } from "@/core/entities/blog-artifact";
import type { BlogPostRevision } from "@/core/entities/blog-revision";
import { getBlogAssetUrl } from "@/lib/blog/hero-images";
import { getSessionUser, type RoleName, type SessionUser } from "@/lib/auth";
import {
  getAdminBlogArtifactsApiPath,
  getAdminBlogHeroImagesApiPath,
  getAdminJournalDetailPath,
  getAdminJournalPreviewPath,
} from "@/lib/journal/admin-journal-routes";

const VALID_STATUSES: readonly BlogPostStatus[] = ["draft", "review", "approved", "published"];
const VALID_SECTIONS: readonly BlogPostSection[] = ["essay", "briefing"];
const JOURNAL_WORKSPACE_ROLES: readonly RoleName[] = ["STAFF", "ADMIN"];

type RawSearchParams = Record<string, string | string[] | undefined>;

export interface AdminJournalListFilters {
  search: string;
  status: BlogPostStatus | "all";
  section: BlogPostSection | "all";
  invalid: string[];
}

export interface AdminJournalListEntry {
  id: string;
  title: string;
  slug: string;
  status: BlogPostStatus;
  statusLabel: string;
  sectionLabel: string;
  updatedLabel: string;
  previewHref: string;
  detailHref: string;
}

export interface AdminJournalListViewModel {
  filters: AdminJournalListFilters;
  counts: Record<BlogPostStatus | "all", number>;
  posts: AdminJournalListEntry[];
}

export interface AdminJournalDetailViewModel {
  post: BlogPost & {
    statusLabel: string;
    sectionLabel: string;
    updatedLabel: string;
    publishedLabel: string;
    previewHref: string;
  };
  revisions: Array<BlogPostRevision & { statusLabel: string; sectionLabel: string; createdAtLabel: string; changeNoteLabel: string }>;
  heroCandidates: Array<{
    id: string;
    altText: string;
    selectionState: string;
    visibility: string;
    imageHref: string;
    createdAtLabel: string;
  }>;
  artifacts: Array<BlogPostArtifact & { createdAtLabel: string; summary: string }>;
  heroImagesApiHref: string;
  artifactsApiHref: string;
}

export function canAccessJournalWorkspace(userRoles: readonly RoleName[]): boolean {
  return userRoles.some((role) => JOURNAL_WORKSPACE_ROLES.includes(role));
}

export function canAccessAdminPage(userRoles: readonly RoleName[]): boolean {
  return userRoles.includes("ADMIN");
}

export function canAccessStaffOrAdmin(userRoles: readonly RoleName[]): boolean {
  return userRoles.includes("STAFF") || userRoles.includes("ADMIN");
}

function readSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }

  return typeof value === "string" ? value : "";
}

function isValidStatus(value: string): value is BlogPostStatus {
  return VALID_STATUSES.includes(value as BlogPostStatus);
}

function isValidSection(value: string): value is BlogPostSection {
  return VALID_SECTIONS.includes(value as BlogPostSection);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not published";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
}

function getStatusLabel(status: BlogPostStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "review":
      return "In review";
    case "approved":
      return "Approved";
    case "published":
      return "Published";
  }
}

function getSectionLabel(section: BlogPostSection | null | undefined): string {
  switch (section) {
    case "essay":
      return "Essay";
    case "briefing":
      return "Briefing";
    default:
      return "Legacy / unset";
  }
}

function summarizeArtifactPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "No structured payload.";
  }

  const record = payload as Record<string, unknown>;
  for (const key of ["summary", "prompt", "resolutionSummary", "issue"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  const json = JSON.stringify(payload);
  return json.length > 120 ? `${json.slice(0, 117)}...` : json;
}

export async function requireJournalWorkspaceAccess(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  if (!canAccessJournalWorkspace(user.roles)) {
    notFound();
  }

  return user;
}

export async function requireAdminPageAccess(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  if (!canAccessAdminPage(user.roles)) {
    notFound();
  }

  return user;
}

export async function requireStaffOrAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  if (!canAccessStaffOrAdmin(user.roles)) {
    notFound();
  }

  return user;
}

export function parseAdminJournalFilters(rawSearchParams: RawSearchParams): AdminJournalListFilters {
  const invalid: string[] = [];
  const search = readSingleValue(rawSearchParams.q).trim();
  const rawStatus = readSingleValue(rawSearchParams.status).trim();
  const rawSection = readSingleValue(rawSearchParams.section).trim();

  let status: BlogPostStatus | "all" = "all";
  if (rawStatus.length > 0 && rawStatus !== "all") {
    if (isValidStatus(rawStatus)) {
      status = rawStatus;
    } else {
      invalid.push("status");
    }
  }

  let section: BlogPostSection | "all" = "all";
  if (rawSection.length > 0 && rawSection !== "all") {
    if (isValidSection(rawSection)) {
      section = rawSection;
    } else {
      invalid.push("section");
    }
  }

  return {
    search,
    status,
    section,
    invalid,
  };
}

export async function loadAdminJournalList(rawSearchParams: RawSearchParams): Promise<AdminJournalListViewModel> {
  const filters = parseAdminJournalFilters(rawSearchParams);

  if (filters.invalid.length > 0) {
    return {
      filters,
      counts: {
        all: 0,
        draft: 0,
        review: 0,
        approved: 0,
        published: 0,
      },
      posts: [],
    };
  }

  const blogRepo = getBlogPostRepository();
  const baseFilters = {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.section !== "all" ? { section: filters.section } : {}),
  };

  const [total, draft, review, approved, published, posts] = await Promise.all([
    blogRepo.countForAdmin(baseFilters),
    blogRepo.countForAdmin({ ...baseFilters, status: "draft" }),
    blogRepo.countForAdmin({ ...baseFilters, status: "review" }),
    blogRepo.countForAdmin({ ...baseFilters, status: "approved" }),
    blogRepo.countForAdmin({ ...baseFilters, status: "published" }),
    blogRepo.listForAdmin({
      ...baseFilters,
      ...(filters.status !== "all" ? { status: filters.status } : {}),
      limit: 50,
    }),
  ]);

  return {
    filters,
    counts: {
      all: total,
      draft,
      review,
      approved,
      published,
    },
    posts: posts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      status: post.status,
      statusLabel: getStatusLabel(post.status),
      sectionLabel: getSectionLabel(post.section),
      updatedLabel: formatDateTime(post.updatedAt),
      previewHref: getAdminJournalPreviewPath(post.slug),
      detailHref: getAdminJournalDetailPath(post.id),
    })),
  };
}

export async function loadAdminJournalDetail(postId: string): Promise<AdminJournalDetailViewModel> {
  const blogRepo = getBlogPostRepository();
  const revisionsRepo = getBlogPostRevisionRepository();
  const assetRepo = getBlogAssetRepository();
  const artifactRepo = getBlogPostArtifactRepository();

  const post = await blogRepo.findById(postId);

  if (!post) {
    notFound();
  }

  const [revisions, heroCandidates, artifacts] = await Promise.all([
    revisionsRepo.listByPostId(postId),
    assetRepo.listHeroCandidates(postId),
    artifactRepo.listByPost(postId),
  ]);

  return {
    post: {
      ...post,
      statusLabel: getStatusLabel(post.status),
      sectionLabel: getSectionLabel(post.section),
      updatedLabel: formatDateTime(post.updatedAt),
      publishedLabel: formatDateTime(post.publishedAt),
      previewHref: getAdminJournalPreviewPath(post.slug),
    },
    revisions: revisions.map((revision) => ({
      ...revision,
      statusLabel: getStatusLabel(revision.snapshot.status),
      sectionLabel: getSectionLabel(revision.snapshot.section),
      createdAtLabel: formatDateTime(revision.createdAt),
      changeNoteLabel: revision.changeNote?.trim() || "No change note recorded.",
    })),
    heroCandidates: heroCandidates.map((asset) => ({
      id: asset.id,
      altText: asset.altText,
      selectionState: asset.selectionState,
      visibility: asset.visibility,
      imageHref: getBlogAssetUrl(asset.id),
      createdAtLabel: formatDateTime(asset.createdAt),
    })),
    artifacts: artifacts.map((artifact) => ({
      ...artifact,
      createdAtLabel: formatDateTime(artifact.createdAt),
      summary: summarizeArtifactPayload(artifact.payload),
    })),
    heroImagesApiHref: getAdminBlogHeroImagesApiPath(postId),
    artifactsApiHref: getAdminBlogArtifactsApiPath(postId),
  };
}