import type {
  CapabilityProgressPhase,
  CapabilityProgressPhaseStatus,
} from "@/core/entities/capability-result";
import { projectCapabilityRuntimeByName } from "@/core/platform/capability-runtime/CapabilityRuntime";
import type { JobProgressPhaseDefinition } from "@/lib/jobs/job-capability-types";

export interface JobProgressPhaseInput {
  key: string;
  label?: string;
  status?: CapabilityProgressPhaseStatus | null;
  percent?: number | null;
}

export interface NormalizeJobProgressStateInput {
  toolName?: string;
  phaseOrder?: readonly JobProgressPhaseDefinition[];
  phases?: readonly JobProgressPhaseInput[] | null;
  activePhaseKey?: string | null;
  progressPercent?: number | null;
  progressLabel?: string | null;
}

export interface NormalizedJobProgressState {
  phases?: CapabilityProgressPhase[];
  activePhaseKey?: string | null;
  progressPercent?: number | null;
  progressLabel?: string | null;
}

function requireJobPhaseDefinitions(toolName: string): readonly JobProgressPhaseDefinition[] {
  const definitions = getJobPhaseDefinitions(toolName);
  if (!definitions) {
    throw new Error(`No job progress phases registered for tool: ${toolName}`);
  }

  return definitions;
}

export const PRODUCE_BLOG_ARTICLE_PHASES = requireJobPhaseDefinitions("produce_blog_article");

export const COMPOSE_MEDIA_PHASES = requireJobPhaseDefinitions("compose_media");

function clampPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}

function normalizePhaseStatus(value: unknown): CapabilityProgressPhaseStatus | null {
  switch (value) {
    case "pending":
    case "active":
    case "succeeded":
    case "failed":
    case "canceled":
      return value;
    default:
      return null;
  }
}

function findPhaseDefinitions(
  input: NormalizeJobProgressStateInput,
): readonly JobProgressPhaseDefinition[] | undefined {
  return input.phaseOrder ?? (input.toolName ? getJobPhaseDefinitions(input.toolName) : undefined);
}

function buildOrderedPhases(
  definitions: readonly JobProgressPhaseDefinition[] | undefined,
  phases: readonly JobProgressPhaseInput[] | null | undefined,
  activePhaseKey: string | null | undefined,
): CapabilityProgressPhase[] | undefined {
  const sourcePhases = Array.isArray(phases)
    ? phases.filter((phase): phase is JobProgressPhaseInput => typeof phase?.key === "string")
    : [];

  if (!definitions && sourcePhases.length === 0) {
    return undefined;
  }

  const definitionKeys = new Set(definitions?.map((definition) => definition.key) ?? []);
  const sourceByKey = new Map(sourcePhases.map((phase) => [phase.key, phase] as const));

  const normalized = (definitions ?? []).map((definition) => {
    const source = sourceByKey.get(definition.key);
    const normalizedStatus = normalizePhaseStatus(source?.status);
    const status = normalizedStatus
      ?? (activePhaseKey === definition.key ? "active" : "pending");
    const percent = clampPercent(source?.percent);

    return {
      key: definition.key,
      label: typeof source?.label === "string" && source.label.trim().length > 0
        ? source.label.trim()
        : definition.label,
      status,
      ...(percent != null ? { percent } : {}),
    } satisfies CapabilityProgressPhase;
  });

  for (const source of sourcePhases) {
    if (definitionKeys.has(source.key)) {
      continue;
    }

    const status = normalizePhaseStatus(source.status)
      ?? (activePhaseKey === source.key ? "active" : "pending");
    const percent = clampPercent(source.percent);
    normalized.push({
      key: source.key,
      label: typeof source.label === "string" && source.label.trim().length > 0
        ? source.label.trim()
        : source.key,
      status,
      ...(percent != null ? { percent } : {}),
    });
  }

  return normalized;
}

function findCurrentPhase(
  phases: readonly CapabilityProgressPhase[] | undefined,
  activePhaseKey: string | null | undefined,
): CapabilityProgressPhase | undefined {
  if (!phases || phases.length === 0) {
    return undefined;
  }

  if (activePhaseKey) {
    const explicit = phases.find((phase) => phase.key === activePhaseKey);
    if (explicit) {
      return explicit;
    }
  }

  return phases.find((phase) => phase.status === "active")
    ?? phases.find((phase) => phase.status === "failed" || phase.status === "canceled")
    ?? (phases.every((phase) => phase.status === "succeeded") ? phases.at(-1) : undefined);
}

function findResolvedActivePhaseKey(
  phases: readonly CapabilityProgressPhase[] | undefined,
  activePhaseKey: string | null | undefined,
): string | null {
  if (!phases || phases.length === 0) {
    return activePhaseKey ?? null;
  }

  if (activePhaseKey === null) {
    return null;
  }

  if (activePhaseKey) {
    const explicit = phases.find(
      (phase) => phase.key === activePhaseKey && (phase.status === "active" || phase.status === "failed" || phase.status === "canceled"),
    );
    if (explicit) {
      return explicit.key;
    }
  }

  return phases.find((phase) => phase.status === "active")?.key
    ?? phases.find((phase) => phase.status === "failed" || phase.status === "canceled")?.key
    ?? null;
}

function deriveCompatibilityPercent(
  phases: readonly CapabilityProgressPhase[] | undefined,
  definitions: readonly JobProgressPhaseDefinition[] | undefined,
  fallbackPercent: number | null | undefined,
  activePhaseKey: string | null | undefined,
): number | null | undefined {
  if (!phases || phases.length === 0) {
    return fallbackPercent;
  }

  if (phases.every((phase) => phase.status === "succeeded")) {
    return 100;
  }

  const currentPhase = findCurrentPhase(phases, activePhaseKey);
  if (!currentPhase) {
    return fallbackPercent;
  }

  const currentIndex = phases.findIndex((phase) => phase.key === currentPhase.key);
  if (currentIndex < 0) {
    return fallbackPercent;
  }

  const definitionIndex = definitions?.findIndex((definition) => definition.key === currentPhase.key) ?? -1;
  const start = definitionIndex >= 0
    ? definitions?.[definitionIndex]?.baselinePercent ?? 0
    : Math.round((currentIndex / Math.max(phases.length, 1)) * 100);
  const end = definitionIndex >= 0
    ? definitions?.[definitionIndex + 1]?.baselinePercent ?? 100
    : Math.round(((currentIndex + 1) / Math.max(phases.length, 1)) * 100);
  const inPhasePercent = clampPercent(currentPhase.percent);
  const fraction = currentPhase.status === "succeeded"
    ? 1
    : (inPhasePercent ?? 0) / 100;

  return Math.round(start + ((end - start) * fraction));
}

function deriveCompatibilityLabel(
  phases: readonly CapabilityProgressPhase[] | undefined,
  fallbackLabel: string | null | undefined,
  activePhaseKey: string | null | undefined,
): string | null | undefined {
  const currentPhase = findCurrentPhase(phases, activePhaseKey);
  if (currentPhase) {
    return currentPhase.label;
  }

  return fallbackLabel;
}

export function getJobPhaseDefinitions(toolName: string): readonly JobProgressPhaseDefinition[] | undefined {
  return projectCapabilityRuntimeByName(toolName)?.job?.progressPhases;
}

export function normalizeJobProgressState(
  input: NormalizeJobProgressStateInput,
): NormalizedJobProgressState {
  const definitions = findPhaseDefinitions(input);
  const normalizedPhases = buildOrderedPhases(definitions, input.phases, input.activePhaseKey);
  const normalizedActivePhaseKey = findResolvedActivePhaseKey(normalizedPhases, input.activePhaseKey);

  return {
    ...(normalizedPhases ? { phases: normalizedPhases } : {}),
    ...(normalizedPhases || input.activePhaseKey !== undefined
      ? { activePhaseKey: normalizedActivePhaseKey }
      : {}),
    ...(normalizedPhases || input.progressPercent !== undefined
      ? {
          progressPercent: deriveCompatibilityPercent(
            normalizedPhases,
            definitions,
            input.progressPercent,
            normalizedActivePhaseKey,
          ) ?? undefined,
        }
      : {}),
    ...(normalizedPhases || input.progressLabel !== undefined
      ? {
          progressLabel: deriveCompatibilityLabel(
            normalizedPhases,
            input.progressLabel,
            normalizedActivePhaseKey,
          ) ?? undefined,
        }
      : {}),
  };
}