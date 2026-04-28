import { randomUUID } from "node:crypto";

import type { PublishedDestination, Release } from "@/core/entities/release";

import { requireCurrentComposition, requireQAReport, type StageExecutionContext, type StageExecutionResult, type StageExecutor } from "./types";

export interface ReleaseExecutorServiceResult {
  publishedDestinations?: readonly PublishedDestination[];
  archiveUri?: string;
  releasedBy?: string;
  releaseNotes?: string;
  socialPosts?: Release["socialPosts"];
  metrics?: Release["metrics"];
}

export interface ReleaseExecutorService {
  publish(input: {
    briefTitle: string;
    compositionId: string;
    targetChannels: readonly string[];
    abortSignal?: AbortSignal;
  }): Promise<ReleaseExecutorServiceResult>;
}

export class ReleaseExecutor implements StageExecutor {
  readonly kind = "release" as const;

  constructor(private readonly service: ReleaseExecutorService) {}

  async execute(context: StageExecutionContext): Promise<StageExecutionResult> {
    const qaReport = requireQAReport(context, "qa_resolution");
    if (qaReport.status !== "passed") {
      throw new Error("Release cannot proceed until qa_resolution has passed.");
    }

    const composition = requireCurrentComposition(context);
    const published = await this.service.publish({
      briefTitle: context.brief.title,
      compositionId: composition.id,
      targetChannels: context.brief.targetChannels,
      abortSignal: context.abortSignal,
    });

    const release: Release = {
      id: `release_${randomUUID()}`,
      schemaVersion: 1,
      workOrderId: context.workOrder.id,
      version: "1.0.0",
      releaseNumber: 1,
      compositionId: composition.id,
      publishedDestinations: published.publishedDestinations ?? context.brief.targetChannels.map((channel) => ({
        channel,
        url: `https://example.com/${channel}/${composition.id}`,
      })),
      releasedAt: new Date().toISOString(),
      releasedBy: published.releasedBy ?? context.brief.createdBy,
      releaseNotes: published.releaseNotes,
      archiveUri: published.archiveUri,
      socialPosts: published.socialPosts,
      metrics: published.metrics,
    };

    return {
      entityKind: "release",
      entity: release,
    };
  }
}
