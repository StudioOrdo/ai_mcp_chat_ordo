import type { ChatMessage } from "@/core/entities/chat-message";
import type {
  CapabilityArtifactRef,
  CapabilityResultEnvelope,
} from "@/core/entities/capability-result";
import type {
  MediaAssetRetentionClass,
  MediaAssetSource,
} from "@/core/entities/media-asset";
import type { BrowserCapabilityExecutionStatus } from "@/core/entities/browser-capability";
import type { MediaRuntimeFailureStage } from "@/core/entities/media-runtime-state";
import type { JobStatusMessagePart, MessagePart } from "@/core/entities/message-parts";
import {
  resolveGenerateChartPayload,
  type ResolvedChartPayload,
} from "@/core/use-cases/tools/chart-payload";
import {
  resolveGenerateGraphPayload,
  type ResolvedGraphPayload,
} from "@/core/use-cases/tools/graph-payload";
import { getCapabilityPresentationDescriptor } from "@/frameworks/ui/chat/registry/capability-presentation-registry";
import { projectCapabilityResultEnvelope } from "@/lib/capabilities/capability-result-envelope";
import { isDeferredJobResultPayload } from "@/lib/jobs/deferred-job-result";
import { normalizeMediaRuntimeState } from "./media-runtime-normalization";
import {
  type BrowserRuntimeToolName,
  getBrowserCapabilityDescriptor,
  isBrowserCapabilityToolName,
} from "./browser-capability-registry";

type RuntimeStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

type PairedToolCall = {
  name: string;
  args: Record<string, unknown>;
  toolInvocationId?: string;
};

export interface BrowserRuntimeCandidate {
  jobId: string;
  messageId: string;
  toolInvocationId?: string;
  toolName: BrowserRuntimeToolName;
  args: Record<string, unknown>;
  payload: unknown;
  resultIndex: number;
  snapshot?: JobStatusMessagePart;
}

type BrowserRuntimeAssetFields = {
  assetId?: string | null;
  mimeType?: string;
  assetSource?: MediaAssetSource;
  retentionClass?: MediaAssetRetentionClass;
};

type ResolvedChartRuntimePayload = ResolvedChartPayload & BrowserRuntimeAssetFields;
type ResolvedGraphRuntimePayload = ResolvedGraphPayload & BrowserRuntimeAssetFields;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasDurableAsset(toolName: BrowserRuntimeToolName, payload: unknown): boolean {
  if (!isRecord(payload)) {
    return false;
  }

  if (toolName === "compose_media") {
    return typeof payload.primaryAssetId === "string" && payload.primaryAssetId.trim().length > 0;
  }

  return typeof payload.assetId === "string" && payload.assetId.trim().length > 0;
}

function readBrowserRuntimeAssetFields(value: unknown): BrowserRuntimeAssetFields {
  if (!isRecord(value)) {
    return {};
  }

  const assetSource = value.assetSource === "generated"
    || value.assetSource === "uploaded"
    || value.assetSource === "derived"
    ? value.assetSource
    : value.source === "generated" || value.source === "uploaded" || value.source === "derived"
      ? value.source
      : undefined;

  return {
    ...(typeof value.assetId === "string" || value.assetId === null
      ? { assetId: value.assetId as string | null }
      : {}),
    ...(typeof value.mimeType === "string" ? { mimeType: value.mimeType } : {}),
    ...(assetSource ? { assetSource } : {}),
    ...(value.retentionClass === "ephemeral"
      || value.retentionClass === "conversation"
      || value.retentionClass === "durable"
      ? { retentionClass: value.retentionClass }
      : {}),
  };
}

function withBrowserRuntimeAssetFields<T extends object>(
  payload: T,
  raw: unknown,
): T & BrowserRuntimeAssetFields {
  return {
    ...payload,
    ...readBrowserRuntimeAssetFields(raw),
  };
}

function isResolvedGraphPayload(value: unknown): value is ResolvedGraphPayload {
  return isRecord(value)
    && isRecord(value.graph)
    && typeof value.graph.kind === "string";
}

export function createBrowserRuntimeJobId(
  messageId: string,
  toolName: BrowserRuntimeToolName,
  resultIndex: number,
): string {
  return `browser:${messageId}:${toolName}:${resultIndex}`;
}

export function replaceToolResultWithJobSnapshot(
  parts: MessagePart[],
  messageId: string,
  resultIndex: number,
  part: JobStatusMessagePart,
): MessagePart[] {
  return parts.map((entry, index) => {
    if (index !== resultIndex || entry.type !== "tool_result") {
      return entry;
    }

    return {
      ...entry,
      result: {
        job: {
          messageId,
          part,
        },
      },
    };
  });
}

function resolveChartPayload(
  payload: unknown,
  args: Record<string, unknown>,
): ResolvedChartRuntimePayload {
  try {
    const raw = isRecord(payload) ? payload : args;
    return withBrowserRuntimeAssetFields(resolveGenerateChartPayload(raw), raw);
  } catch {
    try {
      return withBrowserRuntimeAssetFields(resolveGenerateChartPayload(args), args);
    } catch {
      const fallback = isRecord(payload) ? payload : args;
      return {
        ...(fallback as ResolvedChartRuntimePayload),
        ...readBrowserRuntimeAssetFields(fallback),
      };
    }
  }
}

function resolveGraphPayload(
  payload: unknown,
  args: Record<string, unknown>,
): unknown {
  if (isResolvedGraphPayload(payload)) {
    return withBrowserRuntimeAssetFields(payload, payload);
  }

  try {
    const raw = isRecord(payload) ? payload : args;
    return withBrowserRuntimeAssetFields(resolveGenerateGraphPayload(args), raw);
  } catch {
    return payload;
  }
}

function buildArtifacts(
  toolName: BrowserRuntimeToolName,
  payload: unknown,
  conversationId: string | null,
): CapabilityArtifactRef[] | undefined {
  if (toolName === "generate_chart") {
    const chart = resolveChartPayload(payload, {});
    const title = typeof chart.title === "string" && chart.title.trim().length > 0
      ? chart.title
      : "Chart";
    const assetId = typeof chart.assetId === "string" && chart.assetId.trim().length > 0
      ? chart.assetId
      : undefined;
    return [
      {
        kind: "chart",
        label: title,
        mimeType: chart.mimeType ?? "text/vnd.mermaid",
        ...(assetId ? { assetId, uri: `/api/user-files/${assetId}` } : {}),
        retentionClass: chart.retentionClass ?? (conversationId ? "conversation" : "ephemeral"),
        source: chart.assetSource ?? "derived",
      },
    ];
  }

  if (toolName === "generate_graph") {
    const graph: ResolvedGraphRuntimePayload | null = isResolvedGraphPayload(payload)
      ? withBrowserRuntimeAssetFields(payload, payload)
      : null;
    const assetId = typeof graph?.assetId === "string" && graph.assetId.trim().length > 0
      ? graph.assetId
      : undefined;
    return [
      {
        kind: "graph",
        label: graph?.title ?? "Graph",
        mimeType: graph?.mimeType ?? "application/vnd.studioordo.graph+json",
        ...(assetId ? { assetId, uri: `/api/user-files/${assetId}` } : {}),
        retentionClass: graph?.retentionClass ?? (conversationId ? "conversation" : "ephemeral"),
        source: graph?.assetSource ?? "derived",
      },
    ];
  }

  // compose_media: pull artifacts from the canonical CapabilityResultEnvelope payload
  if (toolName === "compose_media" && isRecord(payload)) {
    const primaryAssetId = typeof payload.primaryAssetId === "string" ? payload.primaryAssetId : undefined;
    const outputFormat = typeof payload.outputFormat === "string" ? payload.outputFormat : "mp4";
    return primaryAssetId
      ? [
          {
            kind: "video",
            label: "Composed Video",
            mimeType: `video/${outputFormat}`,
            assetId: primaryAssetId,
            uri: `/api/user-files/${primaryAssetId}`,
            retentionClass: conversationId ? "conversation" : ("ephemeral" as const),
            source: "generated" as const,
          },
        ]
      : [];
  }

  return undefined;
}

function normalizePayload(
  toolName: BrowserRuntimeToolName,
  payload: unknown,
  args: Record<string, unknown>,
  conversationId: string | null,
): unknown {
  void conversationId;

  if (toolName === "generate_chart") {
    return resolveChartPayload(payload, args);
  }

  return resolveGraphPayload(payload, args);
}

export function buildBrowserRuntimeJobStatusPart(options: {
  candidate: Pick<BrowserRuntimeCandidate, "jobId" | "messageId" | "toolName" | "args" | "toolInvocationId">;
  payload: unknown;
  status: RuntimeStatus;
  browserExecutionStatus?: BrowserCapabilityExecutionStatus | null;
  sequence: number;
  updatedAt?: string;
  progressPercent?: number | null;
  progressLabel?: string | null;
  error?: string;
  failureCode?: string | null;
  failureStage?: MediaRuntimeFailureStage | null;
  conversationId: string | null;
}): JobStatusMessagePart {
  const descriptor = getCapabilityPresentationDescriptor(options.candidate.toolName);
  if (!descriptor) {
    throw new Error(`Missing capability descriptor for ${options.candidate.toolName}`);
  }

  const normalizedPayload = normalizePayload(
    options.candidate.toolName,
    options.payload,
    options.candidate.args,
    options.conversationId,
  );
  const status = (options.status === "failed" || options.status === "canceled")
    && hasDurableAsset(options.candidate.toolName, normalizedPayload)
    ? "succeeded"
    : options.status;
  const artifacts = buildArtifacts(options.candidate.toolName, normalizedPayload, options.conversationId);
  const resultEnvelope = projectCapabilityResultEnvelope({
    toolName: options.candidate.toolName,
    payload: normalizedPayload,
    inputSnapshot: options.candidate.args,
    descriptor,
    executionMode: descriptor.executionMode,
    progress:
      status === "queued" || status === "running"
        ? {
          percent: options.progressPercent ?? undefined,
          label: options.progressLabel ?? undefined,
        }
        : undefined,
    artifacts,
  });

  const summary = resultEnvelope?.summary;
  const runtimeState = normalizeMediaRuntimeState({
    toolName: options.candidate.toolName,
    jobStatus: status,
    payload: normalizedPayload,
    executionMode: descriptor.executionMode,
    browserExecutionStatus: options.browserExecutionStatus,
    failureCode: status === "failed" || status === "canceled" ? options.failureCode : null,
    failureStage: status === "failed" || status === "canceled" ? options.failureStage : null,
  });

  return {
    type: "job_status",
    jobId: options.candidate.jobId,
    ...(options.candidate.toolInvocationId ? { toolInvocationId: options.candidate.toolInvocationId } : {}),
    toolName: options.candidate.toolName,
    label: descriptor.label,
    ...(summary?.title ? { title: summary.title } : {}),
    ...(summary?.subtitle ? { subtitle: summary.subtitle } : {}),
    status,
    sequence: options.sequence,
    ...(options.progressPercent !== undefined ? { progressPercent: options.progressPercent } : {}),
    ...(options.progressLabel !== undefined ? { progressLabel: options.progressLabel } : {}),
    ...(summary?.message ? { summary: summary.message } : {}),
    ...((status === "failed" || status === "canceled") && options.error ? { error: options.error } : {}),
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    lifecyclePhase: runtimeState.lifecyclePhase,
    failureCode: runtimeState.failureCode,
    failureStage: runtimeState.failureStage,
    resultPayload: normalizedPayload,
    resultEnvelope,
    ...(runtimeState.failureClass !== null ? { failureClass: runtimeState.failureClass } : {}),
    ...(runtimeState.recoveryMode !== null ? { recoveryMode: runtimeState.recoveryMode } : {}),
  };
}

export function getBrowserRuntimeCandidates(messages: ChatMessage[]): BrowserRuntimeCandidate[] {
  const candidates: BrowserRuntimeCandidate[] = [];

  for (const message of messages) {
    const pendingCalls: PairedToolCall[] = [];

    for (const [partIndex, part] of (message.parts ?? []).entries()) {
      if (part.type === "tool_call") {
        if (isBrowserCapabilityToolName(part.name)) {
          pendingCalls.push({
            name: part.name,
            args: part.args,
            toolInvocationId: part.toolInvocationId,
          });
        }
        continue;
      }

      if (part.type !== "tool_result") {
        continue;
      }

      const matchIndex = pendingCalls.findIndex((call) => call.name === part.name);
      const match = matchIndex >= 0 ? pendingCalls[matchIndex] : undefined;
      if (!match || !isBrowserCapabilityToolName(match.name)) {
        continue;
      }

      pendingCalls.splice(matchIndex, 1);

      const descriptor = getCapabilityPresentationDescriptor(match.name);
      const browserCapability = getBrowserCapabilityDescriptor(match.name);
      if (!descriptor || (descriptor.executionMode !== "browser" && descriptor.executionMode !== "hybrid")) {
        continue;
      }

      if (!browserCapability) {
        continue;
      }

      if (isDeferredJobResultPayload(part.result)) {
        continue;
      }

      if (
        match.name === "compose_media"
        && (
          !isRecord(part.result)
          || (
            part.result.action !== "compose_media"
            && part.result.generationStatus !== "client_fetch_pending"
            && typeof part.result.primaryAssetId !== "string"
          )
        )
      ) {
        continue;
      }

      const jobId = createBrowserRuntimeJobId(message.id, match.name, partIndex);

      candidates.push({
        jobId,
        messageId: message.id,
        ...(match.toolInvocationId ? { toolInvocationId: match.toolInvocationId } : {}),
        toolName: match.name,
        args: match.args,
        payload: part.result,
        resultIndex: partIndex,
      });
    }
  }

  return candidates;
}

export function shouldStartBrowserRuntime(candidate: BrowserRuntimeCandidate): boolean {
  if (!candidate.snapshot) {
    return true;
  }

  if (candidate.snapshot.status === "queued" || candidate.snapshot.status === "running") {
    return true;
  }

  return false;
}

export function getBrowserRuntimeEnvelopePayload(
  envelope: CapabilityResultEnvelope | null | undefined,
  fallback: unknown,
): unknown {
  return envelope?.payload ?? fallback;
}
