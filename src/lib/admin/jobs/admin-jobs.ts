import { notFound } from "next/navigation";

import type { RoleName } from "@/core/entities/user";
import type {
  JobArtifactPolicyMode,
  JobExecutionPrincipal,
  JobResultRetentionMode,
  JobStatus,
} from "@/core/entities/job";
import { getJobQueueDataMapper, getPlatformInteractionFacade } from "@/adapters/RepositoryFactory";
import type { JobPlatformInteraction } from "@/core/platform/facade/PlatformInteractionFacade";
import type { AdminPaginationParams } from "@/lib/admin/admin-pagination";
import { getAdminJobsDetailPath } from "@/lib/admin/jobs/admin-jobs-routes";
import {
  CURRENT_GLOBAL_JOB_OPERATOR_ROLES,
  canRolesManageGlobalJob,
  canRolesViewGlobalJob,
  getJobCapability,
  getJobCapabilityPresentation,
  listGlobalJobCapabilitiesForRoles,
  type JobFamily,
  type JobSurface,
} from "@/lib/jobs/job-capability-registry";

// ── Filters ────────────────────────────────────────────────────────────

const VALID_STATUSES: readonly string[] = ["queued", "running", "succeeded", "failed", "canceled"];
const VALID_FAMILIES = ["editorial", "content", "workflow", "training", "system", "media", "other"] as const satisfies readonly JobFamily[];
const CANCELABLE_STATUSES = new Set<JobStatus>(["queued", "running"]);
const REQUEUEABLE_STATUSES = new Set<JobStatus>(["queued", "running"]);
const RETRIABLE_STATUSES = new Set<JobStatus>(["failed", "canceled"]);

const JOB_FAMILY_LABELS: Record<JobFamily, string> = {
  editorial: "Editorial",
  content: "Content",
  workflow: "Workflow",
  training: "Training",
  system: "System",
  media: "Media",
  other: "Other",
};

function readSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

function isValidFamily(value: string): value is JobFamily {
  return VALID_FAMILIES.includes(value as JobFamily);
}

function getJobFamilyLabel(family: JobFamily): string {
  return JOB_FAMILY_LABELS[family];
}

function formatRoleList(roles: readonly RoleName[]): RoleName[] {
  return [...roles];
}

function getVisibleGlobalCapabilities(roles: readonly RoleName[]) {
  return listGlobalJobCapabilitiesForRoles(roles)
    .sort((left, right) => left.label.localeCompare(right.label));
}

export interface AdminJobListFilters {
  status: JobStatus | "all";
  family: JobFamily | "all";
  toolName: string;
}

export function parseAdminJobFilters(
  rawSearchParams: Record<string, string | string[] | undefined>,
): AdminJobListFilters {
  const rawStatus = readSingleValue(rawSearchParams.status).trim().toLowerCase();
  const rawFamily = readSingleValue(rawSearchParams.family).trim().toLowerCase();
  const toolName = readSingleValue(rawSearchParams.toolName).trim();

  let status: JobStatus | "all" = "all";
  if (rawStatus.length > 0 && rawStatus !== "all") {
    if (VALID_STATUSES.includes(rawStatus)) {
      status = rawStatus as JobStatus;
    }
  }

  let family: JobFamily | "all" = "all";
  if (rawFamily.length > 0 && rawFamily !== "all") {
    if (isValidFamily(rawFamily)) {
      family = rawFamily;
    }
  }

  return { status, family, toolName };
}

// ── List view model ────────────────────────────────────────────────────

export interface AdminJobFamilyFilterOption {
  value: JobFamily;
  label: string;
  count: number;
}

export interface AdminJobToolFilterOption {
  value: string;
  label: string;
  family: JobFamily;
  familyLabel: string;
  count: number;
}

export interface AdminJobListEntry {
  id: string;
  toolName: string;
  toolLabel: string;
  toolFamily: JobFamily;
  toolFamilyLabel: string;
  defaultSurface: JobSurface;
  executionPrincipal: JobExecutionPrincipal;
  status: string;
  priority: number;
  userName: string | null;
  conversationTitle: string | null;
  progressPercent: number | null;
  progressLabel: string | null;
  attemptCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  detailHref: string;
  duration: string | null;
  canManage: boolean;
  canCancel: boolean;
  canRequeue: boolean;
  canRetry: boolean;
  interactionExecutionState: string;
  interactionTimelineSupportLevel: string;
  interactionTimelineSummary: string | null;
  interactionTimelineEventCount: number;
  interactionRevisionSupportLevel: string;
  interactionRevisionState: string;
  interactionRevisionSummary: string | null;
  interactionRevisionActionCount: number;
}

export interface AdminJobCapabilityPolicyViewModel {
  description: string;
  executionPrincipal: JobExecutionPrincipal;
  executionAllowedRoles: RoleName[];
  globalViewerRoles: RoleName[];
  globalActionRoles: RoleName[];
  resultRetention: JobResultRetentionMode;
  artifactPolicy: JobArtifactPolicyMode;
}

export interface AdminJobListViewModel {
  filters: AdminJobListFilters;
  statusCounts: Record<string, number>;
  familyCounts: Record<string, number>;
  toolNameCounts: Record<string, number>;
  familyOptions: AdminJobFamilyFilterOption[];
  toolOptions: AdminJobToolFilterOption[];
  total: number;
  jobs: AdminJobListEntry[];
}

export interface AdminJobInteractionViewModel {
  timeline: JobPlatformInteraction["timeline"];
  revision: JobPlatformInteraction["revision"];
}

function toInteractionFields(interaction: JobPlatformInteraction | null, jobStatus: string) {
  return {
    interactionExecutionState: interaction?.timeline.state ?? jobStatus,
    interactionTimelineSupportLevel: interaction?.timeline.supportLevel ?? "unsupported",
    interactionTimelineSummary: interaction?.timeline.summary ?? null,
    interactionTimelineEventCount: interaction?.timeline.events.length ?? 0,
    interactionRevisionSupportLevel: interaction?.revision.supportLevel ?? "unsupported",
    interactionRevisionState: interaction?.revision.state ?? "unsupported",
    interactionRevisionSummary: interaction?.revision.summary ?? null,
    interactionRevisionActionCount: interaction?.revision.actions.length ?? 0,
  };
}

function formatDuration(startedAt: string | null, completedAt: string | null, status: string): string | null {
  if (!startedAt) return null;
  if (status === "running") return "running";
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function buildCapabilityMetadata(toolName: string, roles: readonly RoleName[]) {
  const presentation = getJobCapabilityPresentation(toolName);
  const capability = getJobCapability(toolName);

  if (!presentation || !capability || !canRolesViewGlobalJob(toolName, roles)) {
    return null;
  }

  return {
    toolLabel: presentation.label,
    toolFamily: presentation.family,
    toolFamilyLabel: getJobFamilyLabel(presentation.family),
    defaultSurface: presentation.defaultSurface,
    executionPrincipal: capability.executionPrincipal,
    capabilityPolicy: {
      description: capability.description,
      executionPrincipal: capability.executionPrincipal,
      executionAllowedRoles: formatRoleList(capability.executionAllowedRoles),
      globalViewerRoles: formatRoleList(capability.globalViewerRoles),
      globalActionRoles: formatRoleList(capability.globalActionRoles),
      resultRetention: capability.resultRetention,
      artifactPolicy: capability.artifactPolicy.mode,
    } satisfies AdminJobCapabilityPolicyViewModel,
    canManage: canRolesManageGlobalJob(toolName, roles),
  };
}

function buildFamilyCounts(
  toolNameCounts: Record<string, number>,
  roles: readonly RoleName[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const capability of getVisibleGlobalCapabilities(roles)) {
    counts[capability.family] = (counts[capability.family] ?? 0) + (toolNameCounts[capability.toolName] ?? 0);
  }

  return counts;
}

function buildFamilyOptions(
  familyCounts: Record<string, number>,
  roles: readonly RoleName[],
): AdminJobFamilyFilterOption[] {
  const seen = new Set<JobFamily>();

  return getVisibleGlobalCapabilities(roles)
    .filter((capability) => {
      if (seen.has(capability.family)) {
        return false;
      }

      seen.add(capability.family);
      return true;
    })
    .map((capability) => ({
      value: capability.family,
      label: getJobFamilyLabel(capability.family),
      count: familyCounts[capability.family] ?? 0,
    }));
}

function buildToolOptions(
  toolNameCounts: Record<string, number>,
  filters: AdminJobListFilters,
  roles: readonly RoleName[],
): AdminJobToolFilterOption[] {
  return getVisibleGlobalCapabilities(roles)
    .filter((capability) => filters.family === "all" || capability.family === filters.family)
    .map((capability) => ({
      value: capability.toolName,
      label: capability.label,
      family: capability.family,
      familyLabel: getJobFamilyLabel(capability.family),
      count: toolNameCounts[capability.toolName] ?? 0,
    }));
}

function toListEntry(job: {
  id: string;
  toolName: string;
  status: string;
  priority: number;
  userId: string | null;
  progressPercent: number | null;
  progressLabel: string | null;
  attemptCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  conversationId: string;
}, roles: readonly RoleName[], interaction: JobPlatformInteraction | null): AdminJobListEntry | null {
  const capability = buildCapabilityMetadata(job.toolName, roles);
  if (!capability) {
    return null;
  }

  return {
    id: job.id,
    toolName: job.toolName,
    toolLabel: capability.toolLabel,
    toolFamily: capability.toolFamily,
    toolFamilyLabel: capability.toolFamilyLabel,
    defaultSurface: capability.defaultSurface,
    executionPrincipal: capability.executionPrincipal,
    status: job.status,
    priority: job.priority,
    userName: job.userId,
    conversationTitle: null,
    progressPercent: job.progressPercent,
    progressLabel: job.progressLabel,
    attemptCount: job.attemptCount,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    detailHref: getAdminJobsDetailPath(job.id),
    duration: formatDuration(job.startedAt, job.completedAt, job.status),
    canManage: capability.canManage,
    canCancel: capability.canManage && CANCELABLE_STATUSES.has(job.status as JobStatus),
    canRequeue: capability.canManage && REQUEUEABLE_STATUSES.has(job.status as JobStatus),
    canRetry: capability.canManage && RETRIABLE_STATUSES.has(job.status as JobStatus),
    ...toInteractionFields(interaction, job.status),
  };
}

export async function loadAdminJobList(
  rawSearchParams: Record<string, string | string[] | undefined>,
  roles: readonly RoleName[] = CURRENT_GLOBAL_JOB_OPERATOR_ROLES,
  pagination?: Pick<AdminPaginationParams, "limit" | "offset">,
): Promise<AdminJobListViewModel> {
  const filters = parseAdminJobFilters(rawSearchParams);
  const mapper = getJobQueueDataMapper();
  const visibleCapabilities = getVisibleGlobalCapabilities(roles);
  const visibleToolNames = visibleCapabilities.map((capability) => capability.toolName);
  const familyScopedToolNames = visibleCapabilities
    .filter((capability) => filters.family === "all" || capability.family === filters.family)
    .map((capability) => capability.toolName);

  if (visibleToolNames.length === 0 || familyScopedToolNames.length === 0) {
    return {
      filters,
      statusCounts: {},
      familyCounts: {},
      toolNameCounts: {},
      familyOptions: buildFamilyOptions({}, roles),
      toolOptions: buildToolOptions({}, filters, roles),
      total: 0,
      jobs: [],
    };
  }

  const listFilters = {
    ...(filters.status !== "all" ? { status: filters.status } : {}),
    ...(filters.toolName ? { toolName: filters.toolName } : {}),
    toolNames: familyScopedToolNames,
    ...(pagination ? { limit: pagination.limit, offset: pagination.offset } : {}),
  };

  const countFilters = {
    ...(filters.status !== "all" ? { status: filters.status } : {}),
    ...(filters.toolName ? { toolName: filters.toolName } : {}),
    toolNames: familyScopedToolNames,
  };

  const statusCountFilters = {
    ...(filters.toolName ? { toolName: filters.toolName } : {}),
    toolNames: familyScopedToolNames,
  };

  const toolCountFilters = {
    ...(filters.status !== "all" ? { status: filters.status } : {}),
    toolNames: visibleToolNames,
  };

  const [total, statusCounts, toolNameCounts, jobs] = await Promise.all([
    mapper.countForAdmin(countFilters),
    mapper.countByStatus(statusCountFilters),
    mapper.countByToolName(toolCountFilters),
    mapper.listForAdmin(listFilters),
  ]);

  const interactionFacade = getPlatformInteractionFacade();
  const jobsWithInteractions = await Promise.all(
    jobs.map(async (job) => ({
      job,
      interaction: await interactionFacade.getJobInteraction(job.id),
    })),
  );

  const familyCounts = buildFamilyCounts(toolNameCounts, roles);

  return {
    filters,
    statusCounts,
    familyCounts,
    toolNameCounts: Object.fromEntries(
      Object.entries(toolNameCounts).filter(([toolName]) =>
        filters.family === "all"
        || visibleCapabilities.some((capability) => capability.toolName === toolName && capability.family === filters.family),
      ),
    ),
    familyOptions: buildFamilyOptions(familyCounts, roles),
    toolOptions: buildToolOptions(toolNameCounts, filters, roles),
    total,
    jobs: jobsWithInteractions
      .map(({ job, interaction }) => toListEntry(job, roles, interaction))
      .filter((job): job is AdminJobListEntry => job !== null),
  };
}

// ── Detail view model ──────────────────────────────────────────────────

export interface AdminJobDetailViewModel {
  job: AdminJobListEntry & {
    requestPayload: unknown;
    resultPayload: unknown | null;
    errorMessage: string | null;
    dedupeKey: string | null;
    initiatorType: string;
    claimedBy: string | null;
    leaseExpiresAt: string | null;
    failureClass: string | null;
    nextRetryAt: string | null;
    recoveryMode: string | null;
  };
  policy: {
    canManage: boolean;
    canCancel: boolean;
    canRequeue: boolean;
    canRetry: boolean;
    retryMode: "manual_only" | "automatic";
    maxAttempts: number | null;
    backoffStrategy: string | null;
    baseDelayMs: number | null;
    retryExhausted: boolean;
  };
  capabilityPolicy: AdminJobCapabilityPolicyViewModel;
  interaction: AdminJobInteractionViewModel;
  events: Array<{
    id: string;
    eventType: string;
    eventPayload: unknown;
    createdAt: string;
  }>;
}

export async function loadAdminJobDetail(
  jobId: string,
  roles: readonly RoleName[] = CURRENT_GLOBAL_JOB_OPERATOR_ROLES,
): Promise<AdminJobDetailViewModel> {
  const mapper = getJobQueueDataMapper();
  const job = await mapper.findJobById(jobId);

  if (!job) {
    notFound();
  }

  const interaction = await getPlatformInteractionFacade().getJobInteraction(jobId);
  if (!interaction) {
    notFound();
  }

  const listEntry = toListEntry(job, roles, interaction);
  if (!listEntry) {
    notFound();
  }

  const capability = getJobCapability(job.toolName);
  if (!capability) {
    notFound();
  }

  const events = await mapper.listEventsForJob(jobId);
  const retryPolicy = capability.retryPolicy;
  const retryExhausted = retryPolicy.mode === "automatic"
    && typeof retryPolicy.maxAttempts === "number"
    && job.status === "failed"
    && job.failureClass === "transient"
    && !job.nextRetryAt
    && job.attemptCount >= retryPolicy.maxAttempts;

  return {
    job: {
      ...listEntry,
      requestPayload: job.requestPayload,
      resultPayload: job.resultPayload,
      errorMessage: job.errorMessage,
      dedupeKey: job.dedupeKey,
      initiatorType: job.initiatorType,
      claimedBy: job.claimedBy,
      leaseExpiresAt: job.leaseExpiresAt,
      failureClass: job.failureClass,
      nextRetryAt: job.nextRetryAt,
      recoveryMode: job.recoveryMode ?? capability?.recoveryMode ?? null,
    },
    policy: {
      canManage: listEntry.canManage,
      canCancel: listEntry.canCancel,
      canRequeue: listEntry.canRequeue,
      canRetry: listEntry.canRetry,
      retryMode: retryPolicy.mode,
      maxAttempts: retryPolicy.maxAttempts ?? null,
      backoffStrategy: retryPolicy.backoffStrategy ?? null,
      baseDelayMs: retryPolicy.baseDelayMs ?? null,
      retryExhausted,
    },
    capabilityPolicy: {
      description: capability.description,
      executionPrincipal: capability.executionPrincipal,
      executionAllowedRoles: formatRoleList(capability.executionAllowedRoles),
      globalViewerRoles: formatRoleList(capability.globalViewerRoles),
      globalActionRoles: formatRoleList(capability.globalActionRoles),
      resultRetention: capability.resultRetention,
      artifactPolicy: capability.artifactPolicy.mode,
    },
    interaction: {
      timeline: interaction.timeline,
      revision: interaction.revision,
    },
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      eventPayload: e.payload,
      createdAt: e.createdAt,
    })),
  };
}
