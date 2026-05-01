import fs from "node:fs";
import path from "node:path";

import { getAssetCatalogReader, getUserFileDataMapper } from "@/adapters/RepositoryFactory";
import type {
  CapabilityArtifactRef,
  CapabilityResultEnvelope,
} from "@/core/entities/capability-result";
import type { WorkspaceAssetStatus } from "@/core/entities/conversation-workspace";
import type { MediaCompositionPlan } from "@/core/entities/media-composition";
import type { ToolProgressUpdate } from "@/core/tool-registry/ToolExecutionContext";
import { FfmpegServerExecutor } from "@/lib/media/ffmpeg/server/ffmpeg-server-executor";
import {
  COMPOSE_MEDIA_ARTIFACT_LABEL,
  getComposeMediaProgressLabel,
} from "@/lib/media/compose-media-progress";
import {
  type ComposeMediaAssetReadinessEntry,
  evaluateComposeMediaAssetReadiness,
} from "@/lib/media/compose-media-preflight";
import { validateExecutablePlanConstraints } from "@/lib/media/ffmpeg/media-composition-plan";
import { projectUserFileToMediaAssetDescriptor } from "@/lib/media/media-asset-projection";
import { materializeServerComposePlan } from "@/lib/media/server/compose-media-plan-materialization";
import { UserFileSystem } from "@/lib/user-files";
import { getBlogAssetRepository } from "@/adapters/RepositoryFactory";
import { resolveBlogAssetDiskPath } from "@/lib/blog/blog-asset-storage";
import { appendRuntimeAuditLog } from "@/lib/observability/runtime-audit-log";

export interface ExecuteComposeMediaRemotelyParams {
  plan: MediaCompositionPlan;
  userId: string;
  conversationId: string | null;
  toolInvocationId?: string;
  jobId?: string;
  materializationKey?: string;
  onProgress?: (update: ToolProgressUpdate) => void;
}

export class InvalidComposeMediaAssetReadinessError extends Error {
  constructor(
    message: string,
    public readonly failureCode: string,
  ) {
    super(message);
    this.name = "InvalidComposeMediaAssetReadinessError";
  }
}

function getOutputExtension(outputFormat: string): string {
  return outputFormat === "webm" ? "webm" : "mp4";
}

function getMimeType(outputFormat: string): string {
  return outputFormat === "webm" ? "video/webm" : "video/mp4";
}

function buildPersistedArtifacts(
  primaryAssetId: string,
  outputFormat: string,
  conversationId: string | null,
  resolution?: { width: number; height: number } | null,
  toolInvocationId?: string,
): CapabilityArtifactRef[] {
  return [
    {
      kind: "video",
      label: COMPOSE_MEDIA_ARTIFACT_LABEL,
      mimeType: getMimeType(outputFormat),
      assetId: primaryAssetId,
      uri: `/api/user-files/${primaryAssetId}`,
      width: resolution?.width,
      height: resolution?.height,
      retentionClass: conversationId ? "conversation" : "ephemeral",
      source: "generated",
      ...(toolInvocationId ? { toolInvocationId } : {}),
    },
  ];
}

function getPayloadOutputPath(envelope: CapabilityResultEnvelope): string {
  const outputPath = (envelope.payload as { outputPath?: unknown } | null)?.outputPath;
  if (typeof outputPath !== "string" || outputPath.trim().length === 0) {
    throw new Error("Compose media worker completed without an outputPath payload.");
  }

  return outputPath;
}

function summarizePlan(plan: MediaCompositionPlan): Record<string, unknown> {
  return {
    id: plan.id,
    conversationId: plan.conversationId,
    profile: plan.profile,
    outputFormat: plan.outputFormat,
    visualClips: plan.visualClips.map((clip) => ({
      assetId: clip.assetId,
      kind: clip.kind,
      sourceAssetId: clip.sourceAssetId ?? null,
    })),
    audioClips: plan.audioClips.map((clip) => ({
      assetId: clip.assetId,
      kind: clip.kind,
      sourceAssetId: clip.sourceAssetId ?? null,
    })),
  };
}

function summarizeStoredAssetRecord(
  stored: Awaited<ReturnType<UserFileSystem["getById"]>>,
): Record<string, unknown> | null {
  if (!stored) {
    return null;
  }

  return {
    assetId: stored.file.id,
    fileType: stored.file.fileType,
    status: stored.file.status,
    conversationId: stored.file.conversationId,
    source: stored.file.metadata.source ?? null,
    derivativeOfAssetId: stored.file.metadata.derivativeOfAssetId ?? null,
    toolName: stored.file.metadata.toolName ?? null,
    toolInvocationId: stored.file.metadata.toolInvocationId ?? null,
  };
}

function resolveCatalogReadinessStatus(
  status: WorkspaceAssetStatus,
): ComposeMediaAssetReadinessEntry["status"] {
  switch (status) {
    case "ready":
      return "ready";
    case "pending":
      return "pending";
    case "failed":
    case "superseded":
    case "deleted":
      return "not_found";
  }
}

function summarizeAssetReadinessMap(
  assetsById: Map<string, ComposeMediaAssetReadinessEntry>,
): Array<Record<string, unknown>> {
  return [...assetsById.values()].map((asset) => ({
    assetId: asset.assetId,
    status: asset.status,
    assetKind: asset.assetKind ?? null,
    conversationId: asset.conversationId ?? null,
    derivativeOfAssetId: asset.derivativeOfAssetId ?? null,
  }));
}

export async function executeComposeMediaRemotely(
  params: ExecuteComposeMediaRemotelyParams,
): Promise<CapabilityResultEnvelope> {
  const assetCatalogReader = getAssetCatalogReader();
  const repo = getUserFileDataMapper();
  const userFiles = new UserFileSystem(repo);
  const executor = new FfmpegServerExecutor();
  const initialAssetIds = [...new Set([
    ...params.plan.visualClips.map((clip) => clip.assetId),
    ...params.plan.audioClips.map((clip) => clip.assetId),
  ])];
  const storedAssets = new Map<string, Awaited<ReturnType<UserFileSystem["getById"]>>>();

  for (const assetId of initialAssetIds) {
    if (assetId.startsWith("blogasset_")) {
      continue;
    }

    storedAssets.set(assetId, await userFiles.getById(assetId));
  }

  await appendRuntimeAuditLog("deferred_job", "compose_media_worker_asset_resolution_started", {
    conversationId: params.conversationId,
    userId: params.userId,
    toolInvocationId: params.toolInvocationId ?? null,
    plan: summarizePlan(params.plan),
    storedAssets: initialAssetIds.map((assetId) => ({
      assetId,
      stored: summarizeStoredAssetRecord(storedAssets.get(assetId) ?? null),
    })),
  });

  const materialized = await materializeServerComposePlan({
    plan: params.plan,
    userId: params.userId,
    conversationId: params.conversationId,
    toolInvocationId: params.toolInvocationId,
    userFiles,
    storedAssets,
  });

  const constraintError = validateExecutablePlanConstraints(materialized.plan);
  if (constraintError) {
    await appendRuntimeAuditLog("deferred_job", "compose_media_worker_constraint_failed", {
      conversationId: params.conversationId,
      userId: params.userId,
      toolInvocationId: params.toolInvocationId ?? null,
      inputPlan: summarizePlan(params.plan),
      materializedPlan: summarizePlan(materialized.plan),
      error: constraintError,
    });
    throw new InvalidComposeMediaAssetReadinessError(constraintError, "asset_kind_mismatch");
  }

  await appendRuntimeAuditLog("deferred_job", "compose_media_worker_materialized_plan", {
    conversationId: params.conversationId,
    userId: params.userId,
    toolInvocationId: params.toolInvocationId ?? null,
    inputPlan: summarizePlan(params.plan),
    materializedPlan: summarizePlan(materialized.plan),
  });

  const assetIds = [...new Set([
    ...materialized.plan.visualClips.map((clip) => clip.assetId),
    ...materialized.plan.audioClips.map((clip) => clip.assetId),
  ])];
  const assetPaths = new Map<string, string | null>();
  const assetsById = new Map<string, ComposeMediaAssetReadinessEntry>();

  for (const assetId of assetIds) {
    const catalogEntry = await assetCatalogReader.findByAssetId({
      assetId,
      userId: params.userId,
    });

    if (assetId.startsWith("blogasset_")) {
      const blogAssetRepo = getBlogAssetRepository();
      const blogAsset = await blogAssetRepo.findById(assetId);

      if (!blogAsset) {
        assetPaths.set(assetId, null);
        assetsById.set(assetId, {
          assetId,
          status: "not_found",
        });
        continue;
      }

      if (!catalogEntry) {
        assetPaths.set(assetId, null);
        assetsById.set(assetId, {
          assetId,
          status: "forbidden",
        });
        continue;
      }

      assetPaths.set(assetId, resolveBlogAssetDiskPath(blogAsset.storagePath));
      assetsById.set(assetId, {
        assetId,
        status: resolveCatalogReadinessStatus(catalogEntry.status),
        assetKind: catalogEntry.kind === "document" ? null : catalogEntry.kind,
        conversationId: catalogEntry.conversationId,
        derivativeOfAssetId: catalogEntry.derivativeOfAssetId ?? null,
      });
      continue;
    }

    const stored = materialized.storedAssets.get(assetId);
    if (!stored) {
      assetPaths.set(assetId, null);
      assetsById.set(assetId, {
        assetId,
        status: "not_found",
      });
      continue;
    }

    if (!catalogEntry) {
      assetPaths.set(assetId, null);
      assetsById.set(assetId, {
        assetId,
        status: "forbidden",
      });
      continue;
    }

    const projected = projectUserFileToMediaAssetDescriptor(stored.file);

    let readinessStatus: ComposeMediaAssetReadinessEntry["status"] = resolveCatalogReadinessStatus(catalogEntry.status);
    if (catalogEntry.status === "ready" && stored.file.status === "pending") {
      readinessStatus = "pending";
    }

    assetPaths.set(assetId, readinessStatus === "ready" ? stored.diskPath : null);
    assetsById.set(assetId, {
      assetId,
      status: readinessStatus,
      assetKind: catalogEntry.kind === "document" ? projected?.kind ?? null : catalogEntry.kind,
      conversationId: catalogEntry.conversationId,
      derivativeOfAssetId: catalogEntry.derivativeOfAssetId ?? null,
    });
  }

  const readinessFailure = evaluateComposeMediaAssetReadiness({
    plan: materialized.plan,
    assetsById,
  });

  if (readinessFailure) {
    await appendRuntimeAuditLog("deferred_job", "compose_media_worker_readiness_failed", {
      conversationId: params.conversationId,
      userId: params.userId,
      toolInvocationId: params.toolInvocationId ?? null,
      plan: summarizePlan(materialized.plan),
      assetsById: summarizeAssetReadinessMap(assetsById),
      failure: readinessFailure,
    });
    throw new InvalidComposeMediaAssetReadinessError(
      readinessFailure.message,
      readinessFailure.code,
    );
  }

  const envelope = await executor.executeDeferredPlan(
    materialized.plan,
    (progress, phase) => params.onProgress?.({
      activePhaseKey: phase,
      progressPercent: progress,
      progressLabel: getComposeMediaProgressLabel(phase, {
        plan: materialized.plan,
        progressPercent: progress,
      }),
    }),
    {
      resolveAssetPath: (assetId) => assetPaths.get(assetId) ?? null,
    },
  );

  const outputPath = getPayloadOutputPath(envelope);
  const outputBytes = fs.readFileSync(outputPath);
  const stored = await userFiles.storeBinary({
    userId: params.userId,
    conversationId: params.conversationId,
    fileType: "video",
    mimeType: getMimeType(materialized.plan.outputFormat),
    extension: getOutputExtension(materialized.plan.outputFormat),
    data: outputBytes,
    metadata: {
      assetKind: "video",
      source: "generated",
      retentionClass: params.conversationId ? "conversation" : "ephemeral",
      toolName: "compose_media",
      ...(params.toolInvocationId ? { toolInvocationId: params.toolInvocationId } : {}),
      ...(params.jobId ? { jobId: params.jobId, producedByJobId: params.jobId } : {}),
      ...(params.materializationKey ? { materializationKey: params.materializationKey } : {}),
    },
  });

  try {
    fs.unlinkSync(outputPath);
    const workDir = path.dirname(outputPath);
    if (workDir.includes("ordo-ffmpeg-")) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  } catch {
    // Best-effort cleanup only.
  }

  return {
    ...envelope,
    summary: {
      ...envelope.summary,
      subtitle: `${materialized.plan.outputFormat.toUpperCase()} · Media Worker · ${materialized.plan.resolution?.width ?? 0}x${materialized.plan.resolution?.height ?? 0}`,
      statusLine: "succeeded",
    },
    replaySnapshot: {
      route: "deferred_remote",
      planId: materialized.plan.id,
      ...(params.jobId ? { jobId: params.jobId } : {}),
      ...(params.materializationKey ? { materializationKey: params.materializationKey } : {}),
      outputFormat: materialized.plan.outputFormat,
      outputBytes: stored.fileSize,
      resolution: materialized.plan.resolution ?? null,
    },
    artifacts: buildPersistedArtifacts(
      stored.id,
      materialized.plan.outputFormat,
      params.conversationId,
      materialized.plan.resolution,
      params.toolInvocationId,
    ),
    payload: {
      route: "deferred_remote",
      planId: materialized.plan.id,
      primaryAssetId: stored.id,
      outputFormat: materialized.plan.outputFormat,
      outputBytes: stored.fileSize,
      mimeType: getMimeType(materialized.plan.outputFormat),
      resolution: materialized.plan.resolution ?? null,
      ...(params.toolInvocationId ? { toolInvocationId: params.toolInvocationId } : {}),
      ...(params.jobId ? { jobId: params.jobId } : {}),
      ...(params.materializationKey ? { materializationKey: params.materializationKey } : {}),
    },
  };
}
