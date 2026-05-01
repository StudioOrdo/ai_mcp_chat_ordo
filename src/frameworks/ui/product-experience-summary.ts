import type { BusinessObjectRef, ContinuitySourceRef } from "@/core/entities/conversation-continuity";
import type { BusinessWorkflowContext } from "@/core/entities/business-workflow-context";
import type { WorkspaceAssetRef } from "@/core/entities/conversation-workspace";
import type { OperatorTransitionProfile } from "@/core/entities/operator-transition";
import type { RelationshipMemoryRecord } from "@/core/entities/relationship-memory";
import type { ActionLinkType } from "@/core/entities/rich-content";
import type { TrustDistributionContext } from "@/core/entities/trust-distribution";
import type { WorkspaceRestorePayload } from "@/core/platform/conversation-restore/WorkspaceRestore";
import type { JobStateEntry } from "@/hooks/chat/useJobStateStore";
import type { RoleName } from "@/core/entities/user";

export interface ProductExperienceAction {
  label: string;
  actionType: ActionLinkType;
  value: string;
  params?: Record<string, string>;
}

export interface ProductExperienceJobItem {
  id: string;
  title: string;
  summary: string | null;
  statusLabel: string;
  action: ProductExperienceAction | null;
}

export interface ProductExperienceAssetItem {
  id: string;
  title: string;
  subtitle: string;
}

export interface ProductExperienceWorkflowSummary {
  modeLabel: string;
  originLabel: string | null;
  relatedLabels: string[];
  blockerLabel: string | null;
  actionLabel: string | null;
  action: ProductExperienceAction | null;
}

export interface ProductExperienceTransitionSummary {
  modeLabel: string | null;
  statusLabel: string | null;
  shareLabel: string | null;
  referralCode: string | null;
  actionLabel: string | null;
  action: ProductExperienceAction | null;
}

export interface ProductExperienceJobsSummary {
  activeCount: number;
  attentionCount: number;
  items: ProductExperienceJobItem[];
  action: ProductExperienceAction;
}

export interface ProductExperienceAssetsSummary {
  count: number;
  items: ProductExperienceAssetItem[];
  action: ProductExperienceAction;
}

export interface ProductExperienceMemorySummary {
  summary: string;
  typeLabel: string;
  confidenceLabel: string;
}

export interface ProductExperienceSummaryModel {
  headline: string;
  objective: string | null;
  nextStep: string | null;
  statPills: string[];
  workflow: ProductExperienceWorkflowSummary | null;
  transition: ProductExperienceTransitionSummary | null;
  jobs: ProductExperienceJobsSummary | null;
  assets: ProductExperienceAssetsSummary | null;
  memory: ProductExperienceMemorySummary | null;
}

interface BuildProductExperienceSummaryOptions {
  workspaceRestore: WorkspaceRestorePayload | null;
  jobStateEntries: readonly JobStateEntry[];
  currentConversationTitle: string | null;
  viewerRole: RoleName;
}

const JOB_STATUS_PRIORITY: Record<string, number> = {
  failed: 0,
  dead_letter: 0,
  canceled: 1,
  running: 2,
  queued: 3,
  succeeded: 4,
};

const UNCERTAIN_ROUTING_OBJECTIVE = "Current signals are insufficient to determine whether the need is a workflow question, implementation task, or training need.";
const UNCERTAIN_ROUTING_NEXT_STEP = "Ask one clarifying question to determine whether the need is a customer workflow, technical implementation, or training outcome.";

function toTitleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function createRouteAction(label: string, href: string): ProductExperienceAction {
  return {
    label,
    actionType: "route",
    value: href,
  };
}

function formatJobStatus(status: string): string {
  switch (status) {
    case "failed":
      return "Needs attention";
    case "dead_letter":
      return "Failed permanently";
    case "canceled":
      return "Canceled";
    case "running":
      return "Running";
    case "queued":
      return "Queued";
    case "succeeded":
      return "Completed";
    default:
      return toTitleCase(status);
  }
}

function resolveTargetAction(
  label: string,
  targetRef: ContinuitySourceRef | null | undefined,
): ProductExperienceAction | null {
  if (!targetRef) {
    return null;
  }

  switch (targetRef.sourceKind) {
    case "conversation":
      return {
        label,
        actionType: "conversation",
        value: targetRef.sourceId,
      };
    case "job":
    case "job_event":
      return createRouteAction(label, "/jobs");
    case "user_file":
    case "blog_asset":
    case "materialization_record":
      return createRouteAction(label, "/my/media");
    case "referral":
    case "referral_event":
    case "trust_distribution_context":
      return createRouteAction(label, "/referrals");
    case "journal_item":
      return createRouteAction(label, "/journal");
    default:
      return null;
  }
}

function resolveBusinessObjectLabels(refs: readonly BusinessObjectRef[]): string[] {
  return refs
    .map((ref) => ref.label?.trim() || `${toTitleCase(ref.kind)} ${ref.id}`)
    .slice(0, 3);
}

function buildWorkflowSummary(workflow: BusinessWorkflowContext | null): ProductExperienceWorkflowSummary | null {
  if (!workflow) {
    return null;
  }

  const blocker = workflow.healthRefs.find((item) => item.severity === "blocking")
    ?? workflow.healthRefs.find((item) => item.severity === "warning")
    ?? null;
  const actionLabel = workflow.recommendedAction?.label ?? null;

  return {
    modeLabel: toTitleCase(workflow.primaryMode),
    originLabel: workflow.origin?.label ?? null,
    relatedLabels: resolveBusinessObjectLabels(workflow.relatedRefs),
    blockerLabel: blocker?.label ?? null,
    actionLabel,
    action: resolveTargetAction(actionLabel ?? "Continue workflow", workflow.recommendedAction?.targetRef),
  };
}

function buildTransitionSummary(
  operatorTransition: OperatorTransitionProfile | null,
  trustDistribution: TrustDistributionContext | null,
): ProductExperienceTransitionSummary | null {
  if (!operatorTransition && !trustDistribution) {
    return null;
  }

  const recommendedAction = trustDistribution?.recommendedAction ?? operatorTransition?.recommendedAction ?? null;
  const actionLabel = recommendedAction?.label ?? null;
  const directAction = resolveTargetAction(actionLabel ?? "Open referrals", recommendedAction?.targetRef);

  return {
    modeLabel: operatorTransition ? toTitleCase(operatorTransition.operatorMode) : null,
    statusLabel: operatorTransition ? toTitleCase(operatorTransition.status) : null,
    shareLabel: trustDistribution
      ? trustDistribution.referralUrl || trustDistribution.qrCodeUrl
        ? "Referral sharing ready"
        : "Referral setup pending"
      : null,
    referralCode: trustDistribution?.referralCode ?? null,
    actionLabel,
    action: directAction ?? (trustDistribution ? createRouteAction(actionLabel ?? "Open referrals", "/referrals") : null),
  };
}

function buildMemorySummary(memory: RelationshipMemoryRecord | null): ProductExperienceMemorySummary | null {
  if (!memory) {
    return null;
  }

  return {
    summary: memory.summary,
    typeLabel: toTitleCase(memory.memoryType),
    confidenceLabel: `${Math.round(memory.confidence * 100)}% confidence`,
  };
}

function compareJobs(left: JobStateEntry, right: JobStateEntry): number {
  const leftPriority = JOB_STATUS_PRIORITY[left.status] ?? 9;
  const rightPriority = JOB_STATUS_PRIORITY[right.status] ?? 9;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const leftUpdatedAt = Date.parse(left.updatedAt ?? "") || 0;
  const rightUpdatedAt = Date.parse(right.updatedAt ?? "") || 0;
  return rightUpdatedAt - leftUpdatedAt;
}

function buildJobItemAction(entry: JobStateEntry): ProductExperienceAction | null {
  if (entry.status === "queued" || entry.status === "running") {
    return {
      label: "Cancel",
      actionType: "job",
      value: entry.jobId,
      params: { operation: "cancel" },
    };
  }

  if (entry.status === "failed" || entry.status === "canceled" || entry.status === "dead_letter") {
    return {
      label: "Retry",
      actionType: "job",
      value: entry.jobId,
      params: { operation: "retry" },
    };
  }

  return null;
}

function isLowSignalWorkflowSummary(workflow: ProductExperienceWorkflowSummary | null): boolean {
  return Boolean(
    workflow
    && workflow.modeLabel === "General"
    && !workflow.actionLabel
    && !workflow.blockerLabel
    && workflow.relatedLabels.length === 0,
  );
}

function isLowSignalTransitionSummary(transition: ProductExperienceTransitionSummary | null): boolean {
  return Boolean(
    transition
    && transition.modeLabel === "New Solo Offer"
    && transition.statusLabel === "Not Started"
    && transition.shareLabel === "Referral setup pending"
    && transition.actionLabel === "Enable referral sharing"
    && !transition.referralCode,
  );
}

function buildJobsSummary(jobStateEntries: readonly JobStateEntry[]): ProductExperienceJobsSummary | null {
  const eligibleEntries = jobStateEntries
    .filter((entry) => ["queued", "running", "failed", "canceled", "dead_letter"].includes(entry.status))
    .filter((entry) => !entry.failure.supersededByJobId)
    .sort(compareJobs);

  if (eligibleEntries.length === 0) {
    return null;
  }

  const activeCount = eligibleEntries.filter((entry) => entry.status === "queued" || entry.status === "running").length;
  const attentionCount = eligibleEntries.filter((entry) => entry.status === "failed" || entry.status === "canceled" || entry.status === "dead_letter").length;

  return {
    activeCount,
    attentionCount,
    items: eligibleEntries.slice(0, 3).map((entry) => ({
      id: entry.jobId,
      title: entry.title ?? entry.label,
      summary: entry.summary ?? entry.progressLabel ?? null,
      statusLabel: formatJobStatus(entry.status),
      action: buildJobItemAction(entry),
    })),
    action: createRouteAction("Open jobs", "/jobs"),
  };
}

function buildAssetsSummary(assets: readonly WorkspaceAssetRef[]): ProductExperienceAssetsSummary | null {
  if (assets.length === 0) {
    return null;
  }

  const sortedAssets = [...assets].sort((left, right) => {
    const leftUpdatedAt = Date.parse(left.updatedAt) || 0;
    const rightUpdatedAt = Date.parse(right.updatedAt) || 0;
    return rightUpdatedAt - leftUpdatedAt;
  });

  return {
    count: assets.length,
    items: sortedAssets.slice(0, 3).map((asset) => ({
      id: asset.assetId,
      title: `${toTitleCase(asset.kind)} asset`,
      subtitle: `${toTitleCase(asset.status)}${asset.producedByJobId ? ` · from ${asset.producedByJobId}` : ""}`,
    })),
    action: createRouteAction("Open media", "/my/media"),
  };
}

export function buildProductExperienceSummary({
  workspaceRestore,
  jobStateEntries,
  currentConversationTitle,
  viewerRole,
}: BuildProductExperienceSummaryOptions): ProductExperienceSummaryModel | null {
  if (!workspaceRestore) {
    if (viewerRole === "ANONYMOUS") {
      return null;
    }

    return {
      headline: currentConversationTitle?.trim() || "Returning workspace",
      objective: "No active work in progress",
      nextStep: "Pick the next operator action or continue from a dedicated workspace instead of restarting from transcript history.",
      statPills: [],
      workflow: null,
      transition: null,
      jobs: null,
      assets: null,
      memory: null,
    };
  }

  const workspace = workspaceRestore.workspace;
  const workflow = buildWorkflowSummary(workspaceRestore.workflow);
  const transition = buildTransitionSummary(workspaceRestore.operatorTransition, workspaceRestore.trustDistribution);
  const jobs = buildJobsSummary(jobStateEntries);
  const assets = buildAssetsSummary(workspaceRestore.assets);
  const memory = buildMemorySummary(workspaceRestore.memory);

  const headline = workspace?.title?.trim() || currentConversationTitle?.trim() || "Current workspace";
  const objective = workspace?.currentObjective ?? null;
  const nextStep = workspace?.recommendedNextStep
    ?? workflow?.actionLabel
    ?? transition?.actionLabel
    ?? memory?.summary
    ?? null;

  const statPills = [
    jobs?.attentionCount ? `${countLabel(jobs.attentionCount, "item", "items")} need attention` : null,
    jobs?.activeCount ? countLabel(jobs.activeCount, "active job") : null,
    assets?.count ? countLabel(assets.count, "asset") : null,
    workspace?.openLoops.length ? countLabel(workspace.openLoops.length, "open loop") : null,
  ].filter((value): value is string => Boolean(value));

  const hasMeaningfulContent = Boolean(
    objective
    || nextStep
    || workflow
    || transition
    || jobs
    || assets
    || memory,
  );

  if (!hasMeaningfulContent) {
    return null;
  }

  const hasOnlyLowSignalAnonymousContext = viewerRole === "ANONYMOUS"
    && !jobs
    && !assets
    && !memory
    && statPills.length === 0
    && objective === UNCERTAIN_ROUTING_OBJECTIVE
    && nextStep === UNCERTAIN_ROUTING_NEXT_STEP
    && isLowSignalWorkflowSummary(workflow)
    && isLowSignalTransitionSummary(transition);

  if (hasOnlyLowSignalAnonymousContext) {
    return null;
  }

  return {
    headline,
    objective,
    nextStep,
    statPills,
    workflow,
    transition,
    jobs,
    assets,
    memory,
  };
}
