import type {
  CapabilityPresentationDescriptor,
} from "@/core/entities/capability-presentation";
import type { BrowserCapabilityDescriptor } from "@/core/entities/browser-capability";
import type { RoleName } from "@/core/entities/user";
import type { JobCapabilityDefinition } from "@/lib/jobs/job-capability-types";
import type { CapabilityDefinition } from "./capability-definition";
import { AFFILIATE_CAPABILITIES } from "./families/affiliate-capabilities";
import {
  ADMIN_OPERATIONS_CAPABILITIES,
  ADMIN_PILOT_CAPABILITIES,
} from "./families/admin-capabilities";
import {
  BLOG_JOURNAL_CAPABILITIES,
  BLOG_PILOT_CAPABILITIES,
  BLOG_PRODUCTION_CAPABILITIES,
} from "./families/blog-capabilities";
import { CALCULATOR_CAPABILITIES } from "./families/calculator-capabilities";
import { CONVERSATION_CAPABILITIES } from "./families/conversation-capabilities";
import { CORPUS_CAPABILITIES } from "./families/corpus-capabilities";
import { JOB_CAPABILITIES } from "./families/job-capabilities";
import { MEDIA_CAPABILITIES } from "./families/media-capabilities";
import { NAVIGATION_CAPABILITIES } from "./families/navigation-capabilities";
import { PROFILE_CAPABILITIES } from "./families/profile-capabilities";
import { THEME_CAPABILITIES } from "./families/theme-capabilities";

// These tool names are currently declared by multiple families.
// Resolve them explicitly so behavior does not silently depend on spread order.
const COLLISION_RESOLVED_CAPABILITIES = {
  generate_audio: MEDIA_CAPABILITIES.generate_audio,
  generate_chart: CALCULATOR_CAPABILITIES.generate_chart,
  generate_graph: CALCULATOR_CAPABILITIES.generate_graph,
} as const;

// ---------------------------------------------------------------------------
// Pilot catalog
// ---------------------------------------------------------------------------

export const CAPABILITY_CATALOG = {
  ...BLOG_PILOT_CAPABILITIES,
  ...MEDIA_CAPABILITIES,
  ...ADMIN_PILOT_CAPABILITIES,

  ...CALCULATOR_CAPABILITIES,

  // ───────────────────────────────────────────────────────────────────────────
  // Theme bundle
  // ───────────────────────────────────────────────────────────────────────────

  ...THEME_CAPABILITIES,

  // ───────────────────────────────────────────────────────────────────────────
  // Navigation bundle
  // ───────────────────────────────────────────────────────────────────────────

  ...NAVIGATION_CAPABILITIES,

  // ───────────────────────────────────────────────────────────────────────────
  // Corpus bundle
  // ───────────────────────────────────────────────────────────────────────────

  ...CORPUS_CAPABILITIES,

  // ───────────────────────────────────────────────────────────────────────────
  // Conversation bundle
  // ───────────────────────────────────────────────────────────────────────────

  ...CONVERSATION_CAPABILITIES,

  // ───────────────────────────────────────────────────────────────────────────
  // Profile bundle
  // ───────────────────────────────────────────────────────────────────────────

  ...PROFILE_CAPABILITIES,

  // ───────────────────────────────────────────────────────────────────────────
  // Job bundle
  // ───────────────────────────────────────────────────────────────────────────

  ...JOB_CAPABILITIES,

  // ───────────────────────────────────────────────────────────────────────────
  // Admin bundle (admin_web_search is in pilot section above)
  // ───────────────────────────────────────────────────────────────────────────

  ...ADMIN_OPERATIONS_CAPABILITIES,

  // ───────────────────────────────────────────────────────────────────────────
  // Affiliate bundle
  // ───────────────────────────────────────────────────────────────────────────

  ...AFFILIATE_CAPABILITIES,

  // ───────────────────────────────────────────────────────────────────────────
  // Blog bundle — journal workflow tools
  // ───────────────────────────────────────────────────────────────────────────

  ...BLOG_JOURNAL_CAPABILITIES,
  ...BLOG_PRODUCTION_CAPABILITIES,

  // Explicit collision resolution (must come last).
  ...COLLISION_RESOLVED_CAPABILITIES,
} as const satisfies Record<string, CapabilityDefinition>;

export type PilotCapabilityName = keyof typeof CAPABILITY_CATALOG;

// ---------------------------------------------------------------------------
// Projection helpers
// ---------------------------------------------------------------------------

/**
 * Project a CapabilityDefinition into the fields needed for a
 * CapabilityPresentationDescriptor.
 */
export function projectPresentationDescriptor(
  def: CapabilityDefinition,
): CapabilityPresentationDescriptor {
  const p = def.presentation;
  const executionMode = p.executionMode;

  return {
    toolName: def.core.name,
    family: p.family,
    label: def.core.label,
    cardKind: p.cardKind,
    executionMode,
    progressMode:
      p.progressMode
      ?? (executionMode === "deferred" || executionMode === "hybrid" ? "single" : "none"),
    historyMode: p.historyMode ?? "payload_snapshot",
    defaultSurface: p.defaultSurface ?? "conversation",
    artifactKinds: p.artifactKinds ?? [],
    supportsRetry:
      p.supportsRetry
      ?? (executionMode === "deferred" || executionMode === "hybrid" ? "whole_job" : "none"),
  };
}

/**
 * Project a CapabilityDefinition into a JobCapabilityDefinition.
 * Returns null if the capability has no job facet.
 */
export function projectJobCapability(
  def: CapabilityDefinition,
): JobCapabilityDefinition | null {
  if (!def.job) return null;

  return {
    toolName: def.core.name,
    ...def.job,
  };
}

/**
 * Project a CapabilityDefinition into a BrowserCapabilityDescriptor.
 * Returns null if the capability has no browser facet.
 */
export function projectBrowserCapability(
  def: CapabilityDefinition,
): BrowserCapabilityDescriptor | null {
  if (!def.browser) return null;

  return {
    capabilityId: def.core.name,
    ...def.browser,
  };
}

/**
 * Project prompt hint lines for a specific role.
 * Returns null if the capability has no prompt hint for this role.
 */
export function projectPromptHint(
  def: CapabilityDefinition,
  role: RoleName,
): readonly string[] | null {
  return def.promptHint?.roleDirectiveLines[role] ?? null;
}

/**
 * Project MCP export intent.
 * Returns null if the capability has no MCP export facet.
 */
export function projectMcpExportIntent(
  def: CapabilityDefinition,
): { exportable: true; sharedModule: string; mcpDescription?: string } | null {
  return def.mcpExport ?? null;
}

/**
 * Check whether a tool name is a catalog-derived pilot capability.
 */
export function isCatalogPilotCapability(toolName: string): toolName is PilotCapabilityName {
  return toolName in CAPABILITY_CATALOG;
}

/**
 * Get a pilot capability definition by tool name.
 */
export function getCatalogDefinition(toolName: string): CapabilityDefinition | undefined {
  return isCatalogPilotCapability(toolName)
    ? CAPABILITY_CATALOG[toolName]
    : undefined;
}
