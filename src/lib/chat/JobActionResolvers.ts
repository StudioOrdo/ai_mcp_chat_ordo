import type { InlineNode } from "@/core/entities/rich-content";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import { getCapabilityPresentationDescriptor } from "@/frameworks/ui/chat/registry/capability-presentation-registry";
import { getAdminJournalPreviewPath } from "@/lib/journal/admin-journal-routes";
import {
  isDraftContentResultPayload,
  isGenerateBlogImageResultPayload,
  isProduceBlogArticleResultPayload,
  isPublishContentResultPayload,
} from "@/lib/blog/blog-tool-payloads";
import { isSyntheticBrowserJobId } from "./ChatActionResolvers";
import { TOOL_NAMES } from "./ToolCommandResolvers";
import { projectJobRevisionActions } from "@/core/platform/revision/RevisionProjector";

export type PrepareJournalPostForPublishPayload = {
  action: "prepare_journal_post_for_publish";
  ready: boolean;
  summary: string;
  blockers: string[];
  revision_count: number;
  post: {
    id: string;
    title: string;
    detail_route: string;
    preview_route: string;
  };
};

export function isPrepareJournalPostForPublishPayload(value: unknown): value is PrepareJournalPostForPublishPayload {
  return typeof value === "object"
    && value !== null
    && (value as { action?: unknown }).action === TOOL_NAMES.PREPARE_JOURNAL_POST_FOR_PUBLISH
    && typeof (value as { ready?: unknown }).ready === "boolean"
    && typeof (value as { summary?: unknown }).summary === "string"
    && typeof (value as { post?: unknown }).post === "object"
    && (value as { post?: unknown }).post !== null;
}

export function actionLinkNode(label: string, value: string) {
  return { type: "action-link" as const, label, actionType: "route" as const, value };
}

export function jobActionLinkNode(label: string, jobId: string, operation: "cancel" | "retry") {
  return {
    type: "action-link" as const,
    label,
    actionType: "job" as const,
    value: jobId,
    params: { operation },
  };
}

export function getJobStatusResultPayload(part: JobStatusMessagePart): unknown {
  return part.resultEnvelope?.payload ?? part.resultPayload;
}

export function buildDraftContentJobActions(resultPayload: unknown): InlineNode[] | undefined {
  if (!isDraftContentResultPayload(resultPayload)) {
    return undefined;
  }

  return [
    {
      type: "action-link" as const,
      label: "Revise",
      actionType: "send" as const,
      value: `Revise the draft post with id ${resultPayload.id} titled "${resultPayload.title}".`,
    },
    {
      type: "action-link" as const,
      label: "Publish",
      actionType: "send" as const,
      value: `Publish the draft post with id ${resultPayload.id}.`,
    },
  ];
}

export function buildPublishContentJobActions(resultPayload: unknown): InlineNode[] | undefined {
  if (!isPublishContentResultPayload(resultPayload)) {
    return undefined;
  }

  return [actionLinkNode("Open published post", `/journal/${resultPayload.slug}`)];
}

export function buildGenerateBlogImageJobActions(resultPayload: unknown): InlineNode[] | undefined {
  if (!isGenerateBlogImageResultPayload(resultPayload)) {
    return undefined;
  }

  const actions: InlineNode[] = [actionLinkNode("Open image", resultPayload.imageUrl)];
  if (resultPayload.postSlug) {
    actions.unshift(actionLinkNode("Open article", `/journal/${resultPayload.postSlug}`));
  }

  return actions;
}

export function buildProduceBlogArticleJobActions(resultPayload: unknown): InlineNode[] | undefined {
  if (!isProduceBlogArticleResultPayload(resultPayload)) {
    return undefined;
  }

  return [
    actionLinkNode("Open draft", getAdminJournalPreviewPath(resultPayload.slug)),
    {
      type: "action-link" as const,
      label: "Publish",
      actionType: "send" as const,
      value: `Publish the draft journal article with id ${resultPayload.id}.`,
    },
    actionLinkNode("Open hero image", `/api/blog/assets/${resultPayload.imageAssetId}`),
  ];
}

export function buildPrepareJournalPublishJobActions(resultPayload: unknown): InlineNode[] | undefined {
  if (!isPrepareJournalPostForPublishPayload(resultPayload)) {
    return undefined;
  }

  const actions: InlineNode[] = [
    actionLinkNode("Open journal workspace", resultPayload.post.detail_route),
    actionLinkNode("Open journal draft", resultPayload.post.preview_route),
  ];

  if (resultPayload.ready) {
    actions.push({
      type: "action-link" as const,
      label: "Publish",
      actionType: "send" as const,
      value: `Publish the approved journal article with id ${resultPayload.post.id}.`,
    });
  }

  return actions;
}

export const JOB_STATUS_ACTION_RESOLVERS: ReadonlyArray<{
  toolName: string;
  resolveActions: (resultPayload: unknown) => InlineNode[] | undefined;
}> = [
  { toolName: "draft_content", resolveActions: buildDraftContentJobActions },
  { toolName: "publish_content", resolveActions: buildPublishContentJobActions },
  { toolName: "generate_blog_image", resolveActions: buildGenerateBlogImageJobActions },
  { toolName: "produce_blog_article", resolveActions: buildProduceBlogArticleJobActions },
  {
    toolName: TOOL_NAMES.PREPARE_JOURNAL_POST_FOR_PUBLISH,
    resolveActions: buildPrepareJournalPublishJobActions,
  },
];

export function buildJobStatusActions(part: JobStatusMessagePart) {
  const resultPayload = getJobStatusResultPayload(part);
  const descriptor = getCapabilityPresentationDescriptor(part.toolName);
  const canControlServerJob = !isSyntheticBrowserJobId(part.jobId)
    && (descriptor?.executionMode === "deferred" || descriptor?.executionMode === "hybrid");

  if (part.actions && part.actions.length > 0) {
    return part.actions.map((action) => ({
      type: "action-link" as const,
      label: action.label,
      actionType: action.actionType,
      value: action.value,
      params: action.params,
    }));
  }

  const revisionActions = canControlServerJob
    ? projectJobRevisionActions({
        id: part.jobId,
        status: part.status,
        toolName: part.toolName,
      })
    : [];

  if (revisionActions.length > 0) {
    return revisionActions.flatMap((action) => (
      action.operation === "cancel" || action.operation === "retry"
        ? [jobActionLinkNode(action.label, part.jobId, action.operation)]
        : []
    ));
  }

  if (part.status !== "succeeded") {
    return undefined;
  }

  for (const resolver of JOB_STATUS_ACTION_RESOLVERS) {
    if (resolver.toolName !== part.toolName) {
      continue;
    }

    const actions = resolver.resolveActions(resultPayload);
    if (actions) {
      return actions;
    }
  }

  return undefined;
}
