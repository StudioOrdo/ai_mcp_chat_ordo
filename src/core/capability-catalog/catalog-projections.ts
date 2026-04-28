import type {
  CapabilityPresentationDescriptor,
} from "@/core/entities/capability-presentation";
import type { BrowserCapabilityDescriptor } from "@/core/entities/browser-capability";
import type { RoleName } from "@/core/entities/user";
import type { JobCapabilityDefinition } from "@/lib/jobs/job-capability-types";
import type { CapabilityDefinition } from "./capability-definition";

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

export function projectJobCapability(
  def: CapabilityDefinition,
): JobCapabilityDefinition | null {
  if (!def.job) return null;

  return {
    toolName: def.core.name,
    ...def.job,
  };
}

export function projectBrowserCapability(
  def: CapabilityDefinition,
): BrowserCapabilityDescriptor | null {
  if (!def.browser) return null;

  return {
    capabilityId: def.core.name,
    ...def.browser,
  };
}

export function projectPromptHint(
  def: CapabilityDefinition,
  role: RoleName,
): readonly string[] | null {
  return def.promptHint?.roleDirectiveLines[role] ?? null;
}

export function projectMcpExportIntent(
  def: CapabilityDefinition,
): { exportable: true; sharedModule: string; mcpDescription?: string } | null {
  return def.mcpExport ?? null;
}