import type { ChatMessage, ChatResponseState, FailedSendMetadata } from "../core/entities/chat-message";
import type { CapabilityPresentationDescriptor } from "../core/entities/capability-presentation";
import type { CapabilityResultEnvelope } from "../core/entities/capability-result";
import type { InlineNode, RichContent } from "../core/entities/rich-content";
import type { UICommand } from "../core/entities/ui-command";
import { UI_COMMAND_TYPE } from "../core/entities/ui-command";
import { VALID_ACTION_TYPES } from "../core/entities/rich-content";
import type { ActionLinkType } from "../core/entities/rich-content";
import { getPresentedAttachments, type PresentedAttachment } from "@/lib/chat/message-attachments";
import type { MarkdownParserService } from "./MarkdownParserService";
import type { CommandParserService } from "./CommandParserService";
import type {
  GenerationStatusMessagePart,
  JobStatusMessagePart,
  MessagePart,
} from "@/core/entities/message-parts";
import {
  isDraftContentResultPayload,
  isGenerateBlogImageResultPayload,
  isProduceBlogArticleResultPayload,
  isPublishContentResultPayload,
} from "@/lib/blog/blog-tool-payloads";
import { getCapabilityPresentationDescriptor } from "@/frameworks/ui/chat/registry/capability-presentation-registry";
import { projectCapabilityResultEnvelope } from "@/lib/capabilities/capability-result-envelope";
import {
  compareJobRenderCandidateFreshness,
  getGenerationStatusPart,
  resolveTruthBoundMediaText,
  type JobRenderCandidate,
} from "@/lib/chat/JobRenderCandidateMerger";
import {
  canonicalJobSnapshotToStatusPart,
  type CanonicalJobSnapshot,
} from "@/lib/jobs/job-read-model";
import {
  filterPrimaryJobSnapshotsForWorkflows,
  type CanonicalMediaWorkflowSnapshot,
} from "@/lib/media/workflows/media-workflow-read-model";
import { getAdminJournalPreviewPath } from "@/lib/journal/admin-journal-routes";
import { getSupportedTheme, isSupportedTheme } from "@/lib/theme/theme-manifest";
const SUGGESTIONS_MARKER = "__suggestions__:";
const ACTIONS_MARKER = "__actions__:";
const RESPONSE_STATE_MARKER = "__response_state__:";

const TOOL_NAMES = {
  SET_THEME: "set_theme",
  NAVIGATE: "navigate",
  NAVIGATE_TO_PAGE: "navigate_to_page",
  ADJUST_UI: "adjust_ui",
  PREPARE_JOURNAL_POST_FOR_PUBLISH: "prepare_journal_post_for_publish",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJobStatusPartLike(value: unknown): boolean {
  return isRecord(value)
    && value.type === "job_status"
    && typeof value.jobId === "string"
    && typeof value.status === "string";
}

function containsTranscriptJobPayload(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  if (isJobStatusPartLike(value)) {
    return true;
  }

  if (isRecord(value.deferred_job) || isRecord(value.deferredJob)) {
    return true;
  }

  const job = value.job;
  if (isRecord(job) && (isJobStatusPartLike(job.part) || typeof job.jobId === "string")) {
    return true;
  }

  const jobs = value.jobs;
  if (Array.isArray(jobs) && jobs.some((entry) => isRecord(entry) && (isJobStatusPartLike(entry.part) || typeof entry.jobId === "string"))) {
    return true;
  }

  return false;
}

type NavigateToPageResultPayload = {
  path: string;
  label: string | null;
  description: string | null;
  __actions__: Array<{ type: "navigate"; path: string }>;
};

export interface MessageAction {
  label: string;
  action: ActionLinkType;
  params: Record<string, string>;
}

export interface PresentedGenerationStatus {
  status: GenerationStatusMessagePart["status"];
  actor: GenerationStatusMessagePart["actor"];
  reason: string;
  partialContentRetained: boolean;
}

export type ToolRenderEntry =
  | {
      kind: "job-status";
      part: JobStatusMessagePart;
      computedActions?: InlineNode[];
      descriptor?: CapabilityPresentationDescriptor;
      resultEnvelope?: CapabilityResultEnvelope | null;
  source?: JobRenderCandidate["source"];
  snapshot?: CanonicalJobSnapshot;
    }
  | {
      kind: "workflow-status";
      workflow: CanonicalMediaWorkflowSnapshot;
    }
  | {
      kind: "tool-call";
      name: string;
      args: Record<string, unknown>;
      result?: unknown;
      toolInvocationId?: string;
      descriptor?: CapabilityPresentationDescriptor;
      resultEnvelope?: CapabilityResultEnvelope | null;
    };

export type MessageStatus = "confirmed" | "pending" | "failed";

export interface PresentedMessage {
  id: string;
  role: string;
  content: RichContent;
  rawContent: string;
  responseState?: ChatResponseState;
  commands: UICommand[];
  suggestions: string[];
  actions: MessageAction[];
  attachments: PresentedAttachment[];
  failedSend?: FailedSendMetadata;
  generationStatus?: PresentedGenerationStatus;
  status: MessageStatus;
  timestamp: string;
  toolRenderEntries: ToolRenderEntry[];
}

type ExtractedTag = {
  text: string;
  payload: unknown[];
};

type ExtractedStringTag = {
  text: string;
  payload: string | null;
};

type TrailingArrayTagMatch = ExtractedTag & {
  markerIndex: number;
};

type TrailingStringTagMatch = ExtractedStringTag & {
  markerIndex: number;
};

type TrailingControlTagMatch =
  | { kind: "suggestions"; match: TrailingArrayTagMatch }
  | { kind: "actions"; match: TrailingArrayTagMatch }
  | { kind: "responseState"; match: TrailingStringTagMatch };

type ExtractedControlTags = {
  text: string;
  suggestionsPayload: unknown[];
  actionsPayload: unknown[];
  responseStatePayload: string | null;
};

type ToolCallWithResult = {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  toolInvocationId?: string;
};

function findJsonArrayEnd(input: string, arrayStart: number): number {
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = arrayStart; index < input.length; index += 1) {
    const character = input[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === "[") {
      depth += 1;
      continue;
    }

    if (character === "]") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function findJsonStringEnd(input: string, stringStart: number): number {
  let escaping = false;

  for (let index = stringStart + 1; index < input.length; index += 1) {
    const character = input[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (character === '"') {
      return index;
    }
  }

  return -1;
}

function extractTrailingTaggedArray(text: string, marker: string): TrailingArrayTagMatch | null {
  const markerIndex = text.lastIndexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const arrayStart = markerIndex + marker.length;
  if (text[arrayStart] !== "[") {
    return null;
  }

  const arrayEnd = findJsonArrayEnd(text, arrayStart);
  if (arrayEnd < 0) {
    return {
      markerIndex,
      text: text.slice(0, markerIndex).trimEnd(),
      payload: [],
    };
  }

  if (text.slice(arrayEnd + 1).trim().length > 0) {
    return null;
  }

  let payload: unknown[] = [];
  try {
    const parsed = JSON.parse(text.slice(arrayStart, arrayEnd + 1));
    if (Array.isArray(parsed)) {
      payload = parsed;
    }
  } catch {
    payload = [];
  }

  return {
    markerIndex,
    text: text.slice(0, markerIndex).trimEnd(),
    payload,
  };
}

function extractTrailingTaggedString(text: string, marker: string): TrailingStringTagMatch | null {
  const markerIndex = text.lastIndexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const stringStart = markerIndex + marker.length;
  if (text[stringStart] !== '"') {
    return null;
  }

  const stringEnd = findJsonStringEnd(text, stringStart);
  if (stringEnd < 0 || text.slice(stringEnd + 1).trim().length > 0) {
    return null;
  }

  let payload: string | null = null;
  try {
    const parsed = JSON.parse(text.slice(stringStart, stringEnd + 1));
    if (typeof parsed === "string") {
      payload = parsed;
    }
  } catch {
    payload = null;
  }

  return {
    markerIndex,
    text: text.slice(0, markerIndex).trimEnd(),
    payload,
  };
}

function resolveMessageTextContent(message: ChatMessage): string {
  if ((message.content || "").trim().length > 0) {
    return message.content;
  }

  const textParts = (message.parts ?? [])
    .filter((part): part is Extract<MessagePart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");

  return textParts.trim().length > 0 ? textParts : message.content;
}

function extractControlTags(text: string): ExtractedControlTags {
  let remainingText = text.trimEnd();
  let suggestionsPayload: unknown[] = [];
  let actionsPayload: unknown[] = [];
  let responseStatePayload: string | null = null;
  let hasSuggestionsTag = false;
  let hasActionsTag = false;
  let hasResponseStateTag = false;

  while (true) {
    const candidates: TrailingControlTagMatch[] = [];

    if (!hasSuggestionsTag) {
      const match = extractTrailingTaggedArray(remainingText, SUGGESTIONS_MARKER);
      if (match) {
        candidates.push({ kind: "suggestions", match });
      }
    }

    if (!hasActionsTag) {
      const match = extractTrailingTaggedArray(remainingText, ACTIONS_MARKER);
      if (match) {
        candidates.push({ kind: "actions", match });
      }
    }

    if (!hasResponseStateTag) {
      const match = extractTrailingTaggedString(remainingText, RESPONSE_STATE_MARKER);
      if (match) {
        candidates.push({ kind: "responseState", match });
      }
    }

    if (candidates.length === 0) {
      break;
    }

    candidates.sort((left, right) => right.match.markerIndex - left.match.markerIndex);
    const [candidate] = candidates;
    remainingText = candidate.match.text;

    switch (candidate.kind) {
      case "suggestions":
        hasSuggestionsTag = true;
        suggestionsPayload = candidate.match.payload;
        break;
      case "actions":
        hasActionsTag = true;
        actionsPayload = candidate.match.payload;
        break;
      case "responseState":
        hasResponseStateTag = true;
        responseStatePayload = candidate.match.payload;
        break;
    }
  }

  return {
    text: remainingText.trim(),
    suggestionsPayload,
    actionsPayload,
    responseStatePayload,
  };
}

const LOW_VALUE_SUGGESTION_PATTERNS = [
  /^anything else\??$/i,
  /^what else\??$/i,
  /^need (?:anything else|more help)\??$/i,
  /^want (?:more|another)\??$/i,
  /^tell me more\??$/i,
  /^continue\??$/i,
  /^keep going\??$/i,
];

function normalizeSuggestionKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isLowValueSuggestion(value: string): boolean {
  return LOW_VALUE_SUGGESTION_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizeSuggestions(payload: unknown[]): string[] {
  const normalizedSuggestions: string[] = [];
  const seen = new Set<string>();

  for (const entry of payload) {
    if (typeof entry !== "string") {
      continue;
    }

    const candidate = entry.trim();
    if (candidate.length === 0 || candidate.length > 60 || isLowValueSuggestion(candidate)) {
      continue;
    }

    const key = normalizeSuggestionKey(candidate);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedSuggestions.push(candidate);

    if (normalizedSuggestions.length === 4) {
      break;
    }
  }

  return normalizedSuggestions;
}

function normalizeResponseState(payload: string | null): ChatResponseState | null {
  if (payload === "open" || payload === "closed" || payload === "needs_input") {
    return payload;
  }

  return null;
}

function looksLikeBlockingQuestion(textContent: string): boolean {
  const trimmed = textContent.trim();
  if (!trimmed.endsWith("?")) {
    return false;
  }

  return trimmed.split("?").length - 1 === 1;
}

function deriveResponseState(
  message: ChatMessage,
  explicitState: ChatResponseState | null,
  suggestions: string[],
  textContent: string,
): ChatResponseState | undefined {
  if (explicitState) {
    return explicitState;
  }

  if (message.metadata?.responseState) {
    return message.metadata.responseState;
  }

  if (message.role !== "assistant") {
    return undefined;
  }

  if (suggestions.length > 0) {
    return "open";
  }

  return looksLikeBlockingQuestion(textContent) ? "needs_input" : "closed";
}

function getNormalizedString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function sanitizeStringParams(params: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
      .map(([key, value]) => [key, (value as string).trim()]),
  );
}

function omitKeys(params: Record<string, string>, keys: string[]): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).filter(([key]) => !keys.includes(key)),
  );
}

function normalizeActionParams(action: ActionLinkType, entry: Record<string, unknown>): Record<string, string> | null {
  const rawParams = typeof entry.params === "object" && entry.params !== null
    ? entry.params as Record<string, unknown>
    : {};
  const sanitizedParams = sanitizeStringParams(rawParams);

  switch (action) {
    case "route": {
      const path = getNormalizedString(rawParams, ["path", "href", "pathname"]) ?? getNormalizedString(entry, ["value"]);
      const baseParams = omitKeys(sanitizedParams, ["path", "href", "pathname"]);
      return path ? { ...baseParams, path } : baseParams;
    }
    case "send": {
      const text = getNormalizedString(rawParams, ["text", "prompt", "message"]) ?? getNormalizedString(entry, ["value"]);
      const baseParams = omitKeys(sanitizedParams, ["text", "prompt", "message"]);
      return text ? { ...baseParams, text } : baseParams;
    }
    case "corpus": {
      const slug = getNormalizedString(rawParams, ["slug", "id"]) ?? getNormalizedString(entry, ["value"]);
      const baseParams = omitKeys(sanitizedParams, ["slug", "id"]);
      return slug ? { ...baseParams, slug } : baseParams;
    }
    case "conversation": {
      const id = getNormalizedString(rawParams, ["id", "conversationId"]) ?? getNormalizedString(entry, ["value"]);
      const baseParams = omitKeys(sanitizedParams, ["id", "conversationId"]);
      return id ? { ...baseParams, id } : baseParams;
    }
    case "external": {
      const url = getNormalizedString(rawParams, ["url", "href", "path"]) ?? getNormalizedString(entry, ["value"]);
      const baseParams = omitKeys(sanitizedParams, ["url", "href", "path"]);
      return url ? { ...baseParams, url } : baseParams;
    }
    case "job": {
      const jobId = getNormalizedString(rawParams, ["jobId", "id"]) ?? getNormalizedString(entry, ["value"]);
      const operation = getNormalizedString(rawParams, ["operation"]);
      const baseParams = omitKeys(sanitizedParams, ["jobId", "id", "operation"]);
      return jobId || operation
        ? {
          ...baseParams,
          ...(jobId ? { jobId } : {}),
          ...(operation ? { operation } : {}),
        }
        : baseParams;
    }
    default:
      return null;
  }
}

function normalizeMessageActions(payload: unknown[]): MessageAction[] {
  return payload
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const label = getNormalizedString(record, ["label"]);
      const action = getNormalizedString(record, ["action", "type"]);

      if (!label || !action || !VALID_ACTION_TYPES.has(action)) {
        return null;
      }

      const params = normalizeActionParams(action as ActionLinkType, record);
      if (!params) {
        return null;
      }

      return {
        label,
        action: action as ActionLinkType,
        params,
      } satisfies MessageAction;
    })
    .filter((entry): entry is MessageAction => Boolean(entry))
    .slice(0, 3);
}

function pairToolCallsWithResults(parts?: MessagePart[]): ToolCallWithResult[] {
  if (!parts) return [];

  const calls: Array<ToolCallWithResult & { consumed?: boolean }> = [];
  for (const part of parts) {
    if (part.type === "tool_call") {
      calls.push({ name: part.name, args: part.args, toolInvocationId: part.toolInvocationId });
      continue;
    }

    if (part.type === "tool_result") {
      const match = calls.find((call) =>
        !call.consumed
        && call.name === part.name
        && (part.toolInvocationId && call.toolInvocationId
          ? call.toolInvocationId === part.toolInvocationId
          : true),
      );
      if (match) {
        match.result = part.result;
        match.toolInvocationId = match.toolInvocationId ?? part.toolInvocationId;
        match.consumed = true;
      }
    }
  }

  return calls;
}

function sanitizeUiAdjustmentSettings(args: Record<string, unknown>): Record<string, unknown> {
  if (!("theme" in args)) {
    return args;
  }

  const theme = getSupportedTheme(args.theme);
  if (theme) {
    return {
      ...args,
      theme,
    };
  }

  const { theme: _theme, ...rest } = args;
  return rest;
}

type ToolCommandResolver = (call: ToolCallWithResult) => UICommand | null;

const TOOL_COMMAND_RESOLVERS: Partial<Record<string, ToolCommandResolver>> = {
  [TOOL_NAMES.SET_THEME]: (call) => {
    if (!isSupportedTheme(call.args.theme)) {
      return null;
    }

    return {
      type: UI_COMMAND_TYPE.SET_THEME,
      theme: call.args.theme,
    };
  },
  [TOOL_NAMES.NAVIGATE]: (call) => ({
    type: UI_COMMAND_TYPE.NAVIGATE,
    path: call.args.path as string,
  }),
  [TOOL_NAMES.NAVIGATE_TO_PAGE]: (call) => {
    if (!isNavigateToPageResultPayload(call.result)) {
      return null;
    }

    return {
      type: UI_COMMAND_TYPE.NAVIGATE,
      path: call.result.path,
    };
  },
  [TOOL_NAMES.ADJUST_UI]: (call) => ({
    type: UI_COMMAND_TYPE.ADJUST_UI,
    settings: sanitizeUiAdjustmentSettings(call.args as Record<string, unknown>),
  }),
};

function resolveToolCommand(call: ToolCallWithResult): UICommand | null {
  return TOOL_COMMAND_RESOLVERS[call.name]?.(call) ?? null;
}

function shouldPreserveToolRenderEntry(call: ToolCallWithResult): boolean {
  return (
    call.result !== undefined
    && (call.name === TOOL_NAMES.SET_THEME || call.name === TOOL_NAMES.ADJUST_UI)
  );
}

function shouldSuppressDefaultProductToolRenderEntry(call: ToolCallWithResult): boolean {
  return call.name === "generate_audio";
}

type PrepareJournalPostForPublishPayload = {
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

function isPrepareJournalPostForPublishPayload(value: unknown): value is PrepareJournalPostForPublishPayload {
  return typeof value === "object"
    && value !== null
    && (value as { action?: unknown }).action === TOOL_NAMES.PREPARE_JOURNAL_POST_FOR_PUBLISH
    && typeof (value as { ready?: unknown }).ready === "boolean"
    && typeof (value as { summary?: unknown }).summary === "string"
    && typeof (value as { post?: unknown }).post === "object"
    && (value as { post?: unknown }).post !== null;
}

function isNavigateToPageResultPayload(value: unknown): value is NavigateToPageResultPayload {
  return typeof value === "object"
    && value !== null
    && typeof (value as { path?: unknown }).path === "string"
    && Array.isArray((value as { __actions__?: unknown }).__actions__);
}

function actionLinkNode(label: string, value: string) {
  return { type: "action-link" as const, label, actionType: "route" as const, value };
}

function jobActionLinkNode(label: string, jobId: string, operation: "cancel" | "retry") {
  return {
    type: "action-link" as const,
    label,
    actionType: "job" as const,
    value: jobId,
    params: { operation },
  };
}

function isSyntheticBrowserJobId(jobId: string): boolean {
  return jobId.startsWith("browser:");
}

function getJobStatusResultPayload(part: JobStatusMessagePart): unknown {
  return part.resultEnvelope?.payload ?? part.resultPayload;
}

function projectJobStatusResultEnvelope(part: JobStatusMessagePart): CapabilityResultEnvelope | null {
  const descriptor = getCapabilityPresentationDescriptor(part.toolName);

  return (
    part.resultEnvelope
    ?? projectCapabilityResultEnvelope({
      toolName: part.toolName,
      payload: getJobStatusResultPayload(part),
      descriptor,
      executionMode: descriptor?.executionMode ?? "deferred",
      summary: {
        title: part.title,
        subtitle: part.subtitle,
        statusLine: part.error,
        message: part.summary,
      },
      progress:
        part.progressPercent != null || part.progressLabel
          ? {
              percent: part.progressPercent,
              label: part.progressLabel,
            }
          : undefined,
    })
  );
}

function buildDraftContentJobActions(resultPayload: unknown): InlineNode[] | undefined {
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

function buildPublishContentJobActions(resultPayload: unknown): InlineNode[] | undefined {
  if (!isPublishContentResultPayload(resultPayload)) {
    return undefined;
  }

  return [actionLinkNode("Open published post", `/journal/${resultPayload.slug}`)];
}

function buildGenerateBlogImageJobActions(resultPayload: unknown): InlineNode[] | undefined {
  if (!isGenerateBlogImageResultPayload(resultPayload)) {
    return undefined;
  }

  const actions: InlineNode[] = [actionLinkNode("Open image", resultPayload.imageUrl)];
  if (resultPayload.postSlug) {
    actions.unshift(actionLinkNode("Open article", `/journal/${resultPayload.postSlug}`));
  }

  return actions;
}

function buildProduceBlogArticleJobActions(resultPayload: unknown): InlineNode[] | undefined {
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

function buildPrepareJournalPublishJobActions(resultPayload: unknown): InlineNode[] | undefined {
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

const JOB_STATUS_ACTION_RESOLVERS: ReadonlyArray<{
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

function buildJobStatusActions(part: JobStatusMessagePart) {
  const resultPayload = getJobStatusResultPayload(part);
  const descriptor = getCapabilityPresentationDescriptor(part.toolName);
  const supportsWholeJobRetry = descriptor?.supportsRetry === "whole_job";
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

  if ((part.status === "queued" || part.status === "running") && canControlServerJob) {
    return [jobActionLinkNode("Cancel", part.jobId, "cancel")];
  }

  if ((part.status === "failed" || part.status === "canceled") && supportsWholeJobRetry && canControlServerJob) {
    return [jobActionLinkNode("Retry", part.jobId, "retry")];
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

type JobStatusToolRenderEntry = Extract<ToolRenderEntry, { kind: "job-status" }>;

function createJobRenderCandidate(
  part: JobStatusMessagePart,
  encounterOrder: number,
  source: JobRenderCandidate["source"],
): JobRenderCandidate {
  const descriptor = getCapabilityPresentationDescriptor(part.toolName);
  const resultEnvelope = projectJobStatusResultEnvelope(part);
  const renderedPart = resultEnvelope && part.resultEnvelope !== resultEnvelope
    ? { ...part, resultEnvelope }
    : part;

  return {
    part: renderedPart,
    computedActions: buildJobStatusActions(renderedPart),
    descriptor,
    resultEnvelope,
    source,
    encounterOrder,
  };
}

function jobRenderCandidateToEntry(candidate: JobRenderCandidate): JobStatusToolRenderEntry {
  return {
    kind: "job-status",
    part: candidate.part,
    computedActions: candidate.computedActions,
    descriptor: candidate.descriptor,
    resultEnvelope: candidate.resultEnvelope,
    source: candidate.source,
  };
}

function getMessageTimestampMs(message: ChatMessage): number {
  const parsed = message.timestamp instanceof Date
    ? message.timestamp.getTime()
    : Date.parse(String(message.timestamp));
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function getSnapshotTimestampMs(snapshot: CanonicalJobSnapshot): number {
  const parsed = Date.parse(snapshot.createdAt || snapshot.updatedAt);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function getWorkflowSnapshotTimestampMs(snapshot: CanonicalMediaWorkflowSnapshot): number {
  const parsed = Date.parse(snapshot.createdAt || snapshot.updatedAt);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function resolveSnapshotMessageIndex(
  messages: readonly ChatMessage[],
  snapshot: CanonicalJobSnapshot,
): number {
  if (snapshot.origin.originMessageId) {
    const explicitIndex = messages.findIndex((message) => message.id === snapshot.origin.originMessageId);
    if (explicitIndex >= 0) {
      return explicitIndex;
    }
  }

  if (snapshot.origin.originTurnId) {
    const turnIndex = messages.findIndex((message) => message.id === snapshot.origin.originTurnId);
    if (turnIndex >= 0) {
      return turnIndex;
    }
  }

  const snapshotTime = getSnapshotTimestampMs(snapshot);
  let fallbackIndex = -1;
  let fallbackTime = Number.NEGATIVE_INFINITY;

  messages.forEach((message, index) => {
    if (message.role !== "assistant") {
      return;
    }

    const messageTime = getMessageTimestampMs(message);
    if (messageTime <= snapshotTime && messageTime >= fallbackTime) {
      fallbackIndex = index;
      fallbackTime = messageTime;
    }
  });

  if (fallbackIndex >= 0) {
    return fallbackIndex;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") {
      return index;
    }
  }

  return Math.max(messages.length - 1, 0);
}

function resolveWorkflowMessageIndex(
  messages: readonly ChatMessage[],
  snapshot: CanonicalMediaWorkflowSnapshot,
): number {
  if (snapshot.originMessageId) {
    const explicitIndex = messages.findIndex((message) => message.id === snapshot.originMessageId);
    if (explicitIndex >= 0) {
      return explicitIndex;
    }
  }

  if (snapshot.originTurnId) {
    const turnIndex = messages.findIndex((message) => message.id === snapshot.originTurnId);
    if (turnIndex >= 0) {
      return turnIndex;
    }
  }

  const snapshotTime = getWorkflowSnapshotTimestampMs(snapshot);
  let fallbackIndex = -1;
  let fallbackTime = Number.NEGATIVE_INFINITY;

  messages.forEach((message, index) => {
    if (message.role !== "assistant") {
      return;
    }

    const messageTime = getMessageTimestampMs(message);
    if (messageTime <= snapshotTime && messageTime >= fallbackTime) {
      fallbackIndex = index;
      fallbackTime = messageTime;
    }
  });

  if (fallbackIndex >= 0) {
    return fallbackIndex;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") {
      return index;
    }
  }

  return Math.max(messages.length - 1, 0);
}

function createCanonicalJobRenderEntry(snapshot: CanonicalJobSnapshot, encounterOrder: number): JobStatusToolRenderEntry {
  return jobRenderCandidateToEntry(
    createJobRenderCandidate(canonicalJobSnapshotToStatusPart(snapshot), encounterOrder, "canonical"),
  );
}

export class ChatPresenter {
  constructor(
    private markdownParser: MarkdownParserService,
    private commandParser: CommandParserService,
  ) {}

  present(
    message: ChatMessage,
    jobSnapshots: readonly CanonicalJobSnapshot[] = [],
    workflowSnapshots: readonly CanonicalMediaWorkflowSnapshot[] = [],
  ): PresentedMessage {
    let textContent = resolveMessageTextContent(message);
    const extractedControls = extractControlTags(textContent);
    const suggestions = normalizeSuggestions(extractedControls.suggestionsPayload);
    const actions = normalizeMessageActions(extractedControls.actionsPayload);
    textContent = extractedControls.text;

    const responseState = deriveResponseState(
      message,
      normalizeResponseState(extractedControls.responseStatePayload),
      suggestions,
      textContent,
    );

    const visibleSuggestions = responseState === "open" ? suggestions : [];
    const commands = [...this.commandParser.parse(textContent)];
    const attachments = getPresentedAttachments(message.parts);
    const generationStatus = getGenerationStatusPart(message.parts);
    const toolRenderEntries: ToolRenderEntry[] = [];

    // Map AI tool calls to UI commands
    const toolCalls = pairToolCallsWithResults(message.parts);
    for (const call of toolCalls) {
      const command = resolveToolCommand(call);
      if (command) {
        commands.push(command);
        if (!shouldPreserveToolRenderEntry(call)) {
          continue;
        }
      }

      if (containsTranscriptJobPayload(call.result)) {
        continue;
      }

      if (shouldSuppressDefaultProductToolRenderEntry(call)) {
        continue;
      }

      const descriptor = getCapabilityPresentationDescriptor(call.name);
      const resultEnvelope = projectCapabilityResultEnvelope({
        toolName: call.name,
        payload: call.result ?? null,
        inputSnapshot: call.args,
        descriptor,
      });

      toolRenderEntries.push({
        kind: "tool-call",
        name: call.name,
        args: call.args,
        result: call.result,
        toolInvocationId: call.toolInvocationId,
        descriptor,
        resultEnvelope,
      });
    }

    const selectedJobRenderEntries = jobSnapshots.map((snapshot, index) =>
      createCanonicalJobRenderEntry(snapshot, index),
    );
    const selectedJobParts = selectedJobRenderEntries.map((entry) => entry.part);
    const selectedWorkflowRenderEntries: ToolRenderEntry[] = workflowSnapshots.map((workflow) => ({
      kind: "workflow-status",
      workflow,
    }));

    textContent = message.role === "assistant"
      ? resolveTruthBoundMediaText(textContent, selectedJobParts)
      : textContent;

    const richContent = this.markdownParser.parse(textContent);

    return {
      id: message.id,
      role: message.role,
      content: richContent,
      rawContent: textContent,
      responseState,
      commands: commands,
      suggestions: visibleSuggestions,
      actions,
      attachments,
      failedSend: message.metadata?.failedSend,
      generationStatus: generationStatus
        ? {
          status: generationStatus.status,
          actor: generationStatus.actor,
          reason: generationStatus.reason,
          partialContentRetained: generationStatus.partialContentRetained,
        }
        : undefined,
      status: "confirmed",
      timestamp: (message.timestamp || new Date()).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      toolRenderEntries: [...selectedWorkflowRenderEntries, ...selectedJobRenderEntries, ...toolRenderEntries],
    };
  }

  presentMany(
    messages: ChatMessage[],
    jobSnapshots: readonly CanonicalJobSnapshot[] = [],
    workflowSnapshots: readonly CanonicalMediaWorkflowSnapshot[] = [],
  ): PresentedMessage[] {
    const snapshotsByMessageIndex = new Map<number, CanonicalJobSnapshot[]>();
    const primaryJobSnapshots = filterPrimaryJobSnapshotsForWorkflows(jobSnapshots, workflowSnapshots);
    primaryJobSnapshots.forEach((snapshot) => {
      const index = resolveSnapshotMessageIndex(messages, snapshot);
      const existing = snapshotsByMessageIndex.get(index) ?? [];
      existing.push(snapshot);
      snapshotsByMessageIndex.set(index, existing);
    });
    const workflowsByMessageIndex = new Map<number, CanonicalMediaWorkflowSnapshot[]>();
    workflowSnapshots.forEach((snapshot) => {
      const index = resolveWorkflowMessageIndex(messages, snapshot);
      const existing = workflowsByMessageIndex.get(index) ?? [];
      existing.push(snapshot);
      workflowsByMessageIndex.set(index, existing);
    });

    const presentedMessages = messages.map((message, index) =>
      this.present(message, snapshotsByMessageIndex.get(index) ?? [], workflowsByMessageIndex.get(index) ?? []),
    );
    const selectedJobsByJobId = new Map<
      string,
      { messageIndex: number; entryIndex: number; candidate: JobRenderCandidate }
    >();
    let encounterOrder = 0;

    presentedMessages.forEach((message, messageIndex) => {
      message.toolRenderEntries.forEach((entry, entryIndex) => {
        if (entry.kind !== "job-status") {
          return;
        }

        const candidate: JobRenderCandidate = {
          part: entry.part,
          computedActions: entry.computedActions,
          descriptor: entry.descriptor,
          resultEnvelope: entry.resultEnvelope,
          source: entry.source,
          encounterOrder,
        };
        encounterOrder += 1;

        const current = selectedJobsByJobId.get(entry.part.jobId);
        if (!current || compareJobRenderCandidateFreshness(current.candidate, candidate) < 0) {
          selectedJobsByJobId.set(entry.part.jobId, { messageIndex, entryIndex, candidate });
        }
      });
    });

    if (selectedJobsByJobId.size === 0) {
      return presentedMessages;
    }

    const selectedEntryKeys = new Set(
      [...selectedJobsByJobId.values()].map(({ messageIndex, entryIndex }) => `${messageIndex}:${entryIndex}`),
    );

    return presentedMessages.map((message, messageIndex) => {
      const toolRenderEntries = message.toolRenderEntries.filter((entry, entryIndex) => (
        entry.kind !== "job-status" || selectedEntryKeys.has(`${messageIndex}:${entryIndex}`)
      ));

      return toolRenderEntries.length === message.toolRenderEntries.length
        ? message
        : { ...message, toolRenderEntries };
    });
  }
}
