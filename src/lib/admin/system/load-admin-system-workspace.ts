import type { SectionBrief } from "@/components/governance/GovernanceSectionFrame";
import type { RoleName, User } from "@/core/entities/user";
import { getBackupSelfService } from "@/adapters/RepositoryFactory";
import {
  resolveSectionBrief,
  type SectionBriefStore,
} from "@/lib/briefs/section-brief-resolver";
import type { BackupSelfServiceDashboard } from "@/lib/appliance/backup/backup-self-service";
import { getProviderDiagnosticsReport, summarizeProviderDiagnostics, type ProviderDiagnosticsReport } from "@/lib/ai/providers/provider-diagnostics";
import { loadAdminJobList, type AdminJobListViewModel } from "@/lib/admin/jobs/admin-jobs";
import { loadSystemHealthBlock } from "@/lib/operator/loaders/admin-loaders";
import type { OperatorBlockPayload, SystemHealthBlockData } from "@/lib/operator/operator-shared";

export type AdminSystemSectionId =
  | "overview"
  | "health"
  | "providers"
  | "tools"
  | "capabilities"
  | "visibility"
  | "prompts"
  | "backups"
  | "restore-plans"
  | "jobs"
  | "operations"
  | "logs"
  | "keys";

export interface AdminSystemWorkspaceQuery {
  sectionId: AdminSystemSectionId | null;
  q: string | null;
}

export interface AdminSystemSummary {
  warningCount: number;
  healthStatus: "ok" | "degraded" | "unknown";
  providerReady: boolean;
  unavailableCapabilities: number;
  toolCount: number;
  protectedToolCount: number;
  toolWarningCount: number;
  backupWarningCount: number;
  backupCount: number;
  restorePlanCount: number;
  queuedJobs: number;
  runningJobs: number;
  failedJobs: number;
  retryableJobs: number;
}

export interface AdminSystemSection {
  id: AdminSystemSectionId;
  title: string;
  summary: string;
  href: string;
  targetHref: string | null;
  targetLabel: string | null;
  statusLabel: string | null;
  countLabel: string | null;
  iconLabel: string;
}

export interface AdminSystemWorkspaceData {
  query: AdminSystemWorkspaceQuery;
  brief: SectionBrief;
  summary: AdminSystemSummary;
  sections: AdminSystemSection[];
  selectedSection: AdminSystemSection | null;
  diagnostics: {
    health: OperatorBlockPayload<SystemHealthBlockData> | null;
    providers: ProviderDiagnosticsReport | null;
    backups: BackupSelfServiceDashboard | null;
    jobs: AdminJobListViewModel | null;
  };
  loadErrors: Array<{
    source: string;
    message: string;
  }>;
}

export interface AdminSystemWorkspaceDependencies {
  loadHealth: (user: Pick<User, "id" | "roles">) => Promise<OperatorBlockPayload<SystemHealthBlockData>>;
  loadProviders: () => Promise<ProviderDiagnosticsReport>;
  loadBackups: () => Promise<BackupSelfServiceDashboard>;
  loadJobs: (roles: readonly RoleName[]) => Promise<AdminJobListViewModel>;
  briefs?: SectionBriefStore | null;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

const SYSTEM_SECTION_ORDER: AdminSystemSectionId[] = [
  "overview",
  "health",
  "providers",
  "tools",
  "capabilities",
  "visibility",
  "prompts",
  "backups",
  "restore-plans",
  "jobs",
  "operations",
  "logs",
  "keys",
];

const SECTION_LABELS: Record<AdminSystemSectionId, { title: string; icon: string }> = {
  overview: { title: "Overview", icon: "O" },
  health: { title: "Health", icon: "H" },
  providers: { title: "Providers", icon: "P" },
  tools: { title: "Tools", icon: "T" },
  capabilities: { title: "Capabilities", icon: "C" },
  visibility: { title: "Visibility", icon: "V" },
  prompts: { title: "Prompts", icon: "P" },
  backups: { title: "Backups", icon: "B" },
  "restore-plans": { title: "Restore Plans", icon: "R" },
  jobs: { title: "Jobs", icon: "J" },
  operations: { title: "Operations", icon: "O" },
  logs: { title: "Logs", icon: "L" },
  keys: { title: "Keys", icon: "K" },
};

function firstSearchValue(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSection(value: string | string[] | undefined): AdminSystemSectionId | null {
  const candidate = firstSearchValue(value);
  return candidate && SYSTEM_SECTION_ORDER.includes(candidate as AdminSystemSectionId)
    ? candidate as AdminSystemSectionId
    : null;
}

function normalizeSearch(value: string | string[] | undefined): string | null {
  const candidate = firstSearchValue(value);
  return candidate ? candidate.slice(0, 120) : null;
}

export function parseAdminSystemWorkspaceQuery(rawSearchParams: RawSearchParams = {}): AdminSystemWorkspaceQuery {
  return {
    sectionId: normalizeSection(rawSearchParams.section),
    q: normalizeSearch(rawSearchParams.q),
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown system loader failure.";
}

function formatCount(value: number | null | undefined): string | null {
  return typeof value === "number" ? value.toLocaleString("en-US") : null;
}

function getRetryableJobCount(jobs: AdminJobListViewModel | null): number {
  return jobs?.jobs.filter((job) => job.canRetry || job.canRequeue).length ?? 0;
}

function buildSummary(input: {
  health: OperatorBlockPayload<SystemHealthBlockData> | null;
  providers: ProviderDiagnosticsReport | null;
  backups: BackupSelfServiceDashboard | null;
  jobs: AdminJobListViewModel | null;
  loadErrors: readonly unknown[];
}): AdminSystemSummary {
  const providerSummary = input.providers ? summarizeProviderDiagnostics(input.providers) : null;
  const failedJobs = input.jobs?.statusCounts.failed ?? 0;

  return {
    warningCount:
      (input.health?.data.warnings.length ?? 0)
      + (input.providers?.intelligence.warningCodes.length ?? 0)
      + (input.providers?.toolSummary.warnings ?? 0)
      + (input.backups?.warnings.length ?? 0)
      + input.loadErrors.length,
    healthStatus: input.health?.data.summary.overallStatus ?? "unknown",
    providerReady: providerSummary?.requiredIntelligenceReady ?? false,
    unavailableCapabilities:
      (providerSummary?.optionalCapabilitiesDisabled ?? 0)
      + (providerSummary?.optionalCapabilitiesMissingKey ?? 0)
      + (providerSummary?.optionalCapabilitiesUnsupported ?? 0),
    toolCount: input.providers?.toolSummary.total ?? 0,
    protectedToolCount: input.providers?.toolSummary.protectedCount ?? 0,
    toolWarningCount: input.providers?.toolSummary.warnings ?? 0,
    backupWarningCount: input.backups?.warnings.length ?? 0,
    backupCount: input.backups?.recentBackups.length ?? 0,
    restorePlanCount: input.backups?.recentRestorePlans.length ?? 0,
    queuedJobs: input.jobs?.statusCounts.queued ?? 0,
    runningJobs: input.jobs?.statusCounts.running ?? 0,
    failedJobs,
    retryableJobs: getRetryableJobCount(input.jobs),
  };
}

function buildBrief(summary: AdminSystemSummary, generatedAt: string | null): SectionBrief {
  const status: SectionBrief["status"] = summary.warningCount > 0 || summary.failedJobs > 0
    ? "limited"
    : "fresh";

  const bullets = [
    `System health is ${summary.healthStatus}.`,
    summary.providerReady
      ? "The primary intelligence provider is configured."
      : "The primary intelligence provider needs review.",
    `${summary.backupCount} recent backups and ${summary.restorePlanCount} restore plans are visible to admins.`,
    `${summary.queuedJobs + summary.runningJobs} jobs are queued or running; ${summary.failedJobs} failed jobs need review.`,
  ];

  return {
    id: "admin-system-brief",
    sectionId: "admin-system",
    asOf: generatedAt ?? undefined,
    status,
    title: "System Brief",
    summary: "Admin-only governance view for health, providers, tools, backups, restore plans, jobs, operations, logs, and keys.",
    bullets,
    recommendedAction: summary.warningCount > 0 || summary.failedJobs > 0
      ? {
        label: "Review System Health",
        href: "/admin/system?section=health",
      }
      : {
        label: "Review Backups",
        href: "/admin/system?section=backups",
      },
    evidenceRefs: [
      { kind: "system_health", id: "system_health", label: "System health" },
      { kind: "system_tools", id: "system-tools", label: "Tool availability", href: "/admin/system?section=tools" },
      { kind: "backup_restore", id: "backup-dashboard", label: "Backup dashboard", href: "/admin/system?section=backups" },
      { kind: "jobs", id: "admin-jobs", label: "Admin jobs", href: "/admin/system?section=jobs" },
    ],
    limitations: [
      "This surface is admin-only. Owner governance surfaces receive translated status, not raw diagnostics.",
      "Brief background updates must follow the backup/restore pattern: durable request, executor result, evidence manifest, and reconcile step.",
    ],
  };
}

function sectionStatus(id: AdminSystemSectionId, summary: AdminSystemSummary): string | null {
  switch (id) {
    case "overview":
      return summary.warningCount > 0 ? "Review" : "Stable";
    case "health":
      return summary.healthStatus === "ok" ? "Stable" : "Review";
    case "providers":
      return summary.providerReady ? "Ready" : "Review";
    case "tools":
      return summary.toolWarningCount > 0 ? "Review" : "Ready";
    case "capabilities":
      return summary.unavailableCapabilities > 0 ? "Review" : "Ready";
    case "backups":
      return summary.backupWarningCount > 0 ? "Review" : "Ready";
    case "restore-plans":
      return summary.restorePlanCount > 0 ? "Plans" : null;
    case "jobs":
      return summary.failedJobs > 0 ? "Review" : "Stable";
    case "operations":
    case "logs":
    case "keys":
    case "visibility":
    case "prompts":
      return null;
  }
}

function sectionCount(id: AdminSystemSectionId, summary: AdminSystemSummary): string | null {
  switch (id) {
    case "overview":
      return formatCount(summary.warningCount);
    case "health":
      return formatCount(summary.warningCount);
    case "capabilities":
      return formatCount(summary.unavailableCapabilities);
    case "tools":
      return formatCount(summary.toolCount);
    case "backups":
      return formatCount(summary.backupCount);
    case "restore-plans":
      return formatCount(summary.restorePlanCount);
    case "jobs":
      return formatCount(summary.queuedJobs + summary.runningJobs + summary.failedJobs);
    case "operations":
      return null;
    case "logs":
      return null;
    case "providers":
    case "visibility":
    case "prompts":
    case "keys":
      return null;
  }
}

function sectionSummary(id: AdminSystemSectionId, summary: AdminSystemSummary): string {
  switch (id) {
    case "overview":
      return "Admin system brief, warnings, and next action.";
    case "health":
      return `Runtime health is ${summary.healthStatus}.`;
    case "providers":
      return summary.providerReady ? "Primary provider is configured." : "Provider configuration needs review.";
    case "tools":
      return `${summary.toolCount} runtime tools; ${summary.protectedToolCount} protected recovery tools.`;
    case "capabilities":
      return `${summary.unavailableCapabilities} provider-backed capabilities unavailable.`;
    case "visibility":
      return "Content and route visibility governance.";
    case "prompts":
      return "Admin prompt governance and policy.";
    case "backups":
      return `${summary.backupCount} backups; ${summary.backupWarningCount} warnings.`;
    case "restore-plans":
      return `${summary.restorePlanCount} restore plans with confirmation controls.`;
    case "jobs":
      return `${summary.queuedJobs} queued, ${summary.runningJobs} running, ${summary.failedJobs} failed.`;
    case "operations":
      return "Durable system operations and action evidence.";
    case "logs":
      return "Admin log review lives behind System.";
    case "keys":
      return "Provider keys and model configuration.";
  }
}

function sectionTarget(id: AdminSystemSectionId): Pick<AdminSystemSection, "targetHref" | "targetLabel"> {
  switch (id) {
    case "visibility":
      return { targetHref: "/admin/content-visibility", targetLabel: "Open visibility page" };
    case "prompts":
      return { targetHref: "/admin/prompts", targetLabel: "Open prompts page" };
    case "tools":
      return { targetHref: "/admin/system/tools", targetLabel: "Open tools page" };
    case "backups":
      return { targetHref: "/admin/system/backups", targetLabel: "Open full backup page" };
    case "jobs":
      return { targetHref: "/admin/jobs", targetLabel: "Open jobs page" };
    case "operations":
      return { targetHref: "/admin/system/operations", targetLabel: "Open operations page" };
    case "keys":
      return { targetHref: "/admin/system/keys", targetLabel: "Open keys page" };
    case "logs":
      return { targetHref: "/admin/system?section=logs", targetLabel: null };
    default:
      return { targetHref: null, targetLabel: null };
  }
}

function buildSections(summary: AdminSystemSummary, query: AdminSystemWorkspaceQuery): AdminSystemSection[] {
  const lowerQuery = query.q?.toLowerCase() ?? null;

  return SYSTEM_SECTION_ORDER.map((id) => {
    const label = SECTION_LABELS[id];
    const target = sectionTarget(id);
    const section = {
      id,
      title: label.title,
      summary: sectionSummary(id, summary),
      href: `/admin/system?section=${id}`,
      targetHref: target.targetHref,
      targetLabel: target.targetLabel,
      statusLabel: sectionStatus(id, summary),
      countLabel: sectionCount(id, summary),
      iconLabel: label.icon,
    } satisfies AdminSystemSection;

    return section;
  }).filter((section) => {
    if (!lowerQuery) {
      return true;
    }

    return [section.title, section.summary, section.statusLabel]
      .some((value) => value?.toLowerCase().includes(lowerQuery));
  });
}

async function settle<T>(
  source: string,
  promise: Promise<T>,
): Promise<{ value: T | null; error: { source: string; message: string } | null }> {
  try {
    return { value: await promise, error: null };
  } catch (error) {
    return { value: null, error: { source, message: getErrorMessage(error) } };
  }
}

function createDefaultDependencies(): AdminSystemWorkspaceDependencies {
  return {
    loadHealth: loadSystemHealthBlock,
    loadProviders: getProviderDiagnosticsReport,
    loadBackups: () => getBackupSelfService().getDashboard(),
    loadJobs: (roles) => loadAdminJobList({}, roles, { limit: 25, offset: 0 }),
  };
}

export async function loadAdminSystemWorkspace(
  user: Pick<User, "id" | "roles">,
  rawSearchParams: RawSearchParams = {},
  deps: AdminSystemWorkspaceDependencies = createDefaultDependencies(),
): Promise<AdminSystemWorkspaceData> {
  const query = parseAdminSystemWorkspaceQuery(rawSearchParams);
  const [healthResult, providersResult, backupsResult, jobsResult] = await Promise.all([
    settle("health", deps.loadHealth(user)),
    settle("providers", deps.loadProviders()),
    settle("backups", deps.loadBackups()),
    settle("jobs", deps.loadJobs(user.roles)),
  ]);
  const loadErrors = [
    healthResult.error,
    providersResult.error,
    backupsResult.error,
    jobsResult.error,
  ].filter((error): error is { source: string; message: string } => error !== null);
  const summary = buildSummary({
    health: healthResult.value,
    providers: providersResult.value,
    backups: backupsResult.value,
    jobs: jobsResult.value,
    loadErrors,
  });
  const sections = buildSections(summary, query);
  const selectedSection = query.sectionId
    ? sections.find((section) => section.id === query.sectionId) ?? null
    : null;

  const fallbackBrief = buildBrief(summary, healthResult.value?.data.generatedAt ?? null);
  const { brief } = await resolveSectionBrief({
    briefs: deps.briefs,
    sectionId: "admin-system",
    ownerUserId: user.id,
    visibilityPolicy: "admin",
    fallback: fallbackBrief,
  });

  return {
    query,
    brief,
    summary,
    sections,
    selectedSection,
    diagnostics: {
      health: healthResult.value,
      providers: providersResult.value,
      backups: backupsResult.value,
      jobs: jobsResult.value,
    },
    loadErrors,
  };
}
