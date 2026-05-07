import { getFactoryRepository } from "@/adapters/RepositoryFactory";
import type { DraftSection } from "@/core/entities/draft";
import type { FactoryAssetKind } from "@/core/entities/factory-constants";
import type { Claim, SourceReference } from "@/core/entities/research-packet";
import type { FactoryRepository } from "@/core/use-cases/FactoryRepository";

import { DAGPlanner } from "./dag-planner";
import { ProduceProductDeferredJobHandler } from "./produce-product-deferred-job";
import { ProductionOrchestrator } from "./production-orchestrator";
import { StageExecutorRegistry } from "./stage-executor-registry";
import {
  AssetGenerationExecutor,
  type AssetGenerationHandler,
} from "./stage-executors/asset-generation-executor";
import {
  CompositionExecutor,
  type CompositionExecutorService,
} from "./stage-executors/composition-executor";
import {
  DraftExecutor,
  type DraftExecutorService,
} from "./stage-executors/draft-executor";
import { QAExecutor } from "./stage-executors/qa-executor";
import { QAResolutionExecutor } from "./stage-executors/qa-resolution-executor";
import {
  ReleaseExecutor,
  type ReleaseExecutorService,
} from "./stage-executors/release-executor";
import {
  ResearchExecutor,
  type ResearchExecutorService,
} from "./stage-executors/research-executor";
import { createFactoryQACheckRegistry } from "./factory-qa-root";

function createSourceReferences(topic: string): SourceReference[] {
  const retrievedAt = new Date().toISOString();

  return [
    {
      id: "source_primary",
      title: `${topic} baseline source`,
      url: `https://example.com/research/${encodeURIComponent(topic.toLowerCase().replace(/\s+/g, "-"))}`,
      retrievedAt,
      relevanceScore: 0.86,
    },
  ];
}

function createClaims(topic: string): Claim[] {
  return [
    {
      id: "claim_primary",
      text: `${topic} requires coordinated research, composition, and QA before release.`,
      supportingSourceIds: ["source_primary"],
      confidence: 0.82,
    },
  ];
}

const researchService: ResearchExecutorService = {
  async research({ topic, briefTitle }) {
    return {
      summary: `Research packet prepared for ${briefTitle} with baseline evidence for ${topic}.`,
      confidenceScore: 0.82,
      sources: createSourceReferences(topic),
      claims: createClaims(topic),
      searchEngine: "hybrid",
    };
  },
};

const draftService: DraftExecutorService = {
  async compose({ briefTitle, topic, researchPacket }) {
    const sections: DraftSection[] = [
      {
        id: "draft_heading",
        kind: "heading",
        order: 0,
        text: briefTitle,
        level: 1,
      },
      {
        id: "draft_summary",
        kind: "paragraph",
        order: 1,
        text: researchPacket.summary,
      },
      {
        id: "draft_topic",
        kind: "paragraph",
        order: 2,
        text: `This release package is prepared for ${topic} across the requested channels.`,
      },
    ];

    return {
      title: briefTitle,
      summary: `Draft package prepared for ${briefTitle}.`,
      sections,
    };
  },
};

export function createDefaultAssetHandlers(): Partial<Record<FactoryAssetKind, AssetGenerationHandler>> {
  return {
    image: async ({ briefTitle, assetSlot, parameterOverrides }) => ({
      label: `${briefTitle} hero image`,
      uri: `https://example.com/factory/assets/${assetSlot}.png`,
      mimeType: "image/png",
      fileSizeBytes: 204_800,
      generationDurationMs: 750,
      generationParams: { preset: "hero", ...(parameterOverrides ?? {}) },
      qaStatus: "passed",
      qaFindings: [],
    }),
    chart: async ({ briefTitle, assetSlot, parameterOverrides }) => ({
      label: `${briefTitle} supporting chart`,
      uri: `https://example.com/factory/assets/${assetSlot}.svg`,
      mimeType: "image/svg+xml",
      fileSizeBytes: 24_000,
      generationDurationMs: 620,
      generationParams: { chartType: "flowchart", ...(parameterOverrides ?? {}) },
      qaStatus: "passed",
      qaFindings: [],
    }),
    graph: async ({ briefTitle, assetSlot, parameterOverrides }) => ({
      label: `${briefTitle} supporting graph`,
      uri: `https://example.com/factory/assets/${assetSlot}.svg`,
      mimeType: "image/svg+xml",
      fileSizeBytes: 26_500,
      generationDurationMs: 640,
      generationParams: { graphType: "line", ...(parameterOverrides ?? {}) },
      qaStatus: "passed",
      qaFindings: [],
    }),
    audio: async ({ briefTitle, assetSlot, parameterOverrides }) => ({
      label: `${briefTitle} narration`,
      uri: `https://example.com/factory/assets/${assetSlot}.mp3`,
      mimeType: "audio/mpeg",
      fileSizeBytes: 512_000,
      generationDurationMs: 1_200,
      generationParams: { voice: "neutral", ...(parameterOverrides ?? {}) },
      qaStatus: "passed",
      qaFindings: [],
    }),
    video: async ({ briefTitle, assetSlot, parameterOverrides }) => ({
      label: `${briefTitle} release video`,
      uri: `https://example.com/factory/assets/${assetSlot}.mp4`,
      mimeType: "video/mp4",
      fileSizeBytes: 2_097_152,
      generationDurationMs: 1_800,
      generationParams: { aspectRatio: "16:9", ...(parameterOverrides ?? {}) },
      qaStatus: "passed",
      qaFindings: [],
    }),
  };
}

const compositionService: CompositionExecutorService = {
  async compose({ briefTitle, targetChannel, draft, assets }) {
    const body = draft.sections
      .filter((section) => section.kind !== "heading")
      .map((section) => `<p>${section.text}</p>`)
      .join("\n");
    const assetMarkup = assets
      .map((asset) => `<figure data-kind="${asset.kind}"><figcaption>${asset.label ?? asset.kind}</figcaption></figure>`)
      .join("\n");

    return {
      title: briefTitle,
      htmlContent: `<article data-channel="${targetChannel ?? "web"}"><h1>${draft.title}</h1>${body}${assetMarkup}</article>`,
      metadata: {
        targetChannel: targetChannel ?? "web",
      },
    };
  },
};

const releaseService: ReleaseExecutorService = {
  async publish({ briefTitle, compositionId, targetChannels }) {
    return {
      releasedBy: "factory_runtime",
      releaseNotes: `Published ${briefTitle} from composition ${compositionId}.`,
      publishedDestinations: targetChannels.map((channel) => ({
        channel,
        url: `https://example.com/releases/${channel}/${compositionId}`,
      })),
      metrics: {
        viewCount: 0,
        engagementByChannel: Object.fromEntries(targetChannels.map((channel) => [channel, 0])),
      },
    };
  },
};

export interface FactoryProductionRootOptions {
  repository?: FactoryRepository;
}

export function createFactoryProductionRoot(options: FactoryProductionRootOptions = {}) {
  const repository = options.repository ?? getFactoryRepository();
  const planner = new DAGPlanner();
  const qaRegistry = createFactoryQACheckRegistry();
  const assetHandlers = createDefaultAssetHandlers();
  const executorRegistry = new StageExecutorRegistry([
    new ResearchExecutor(researchService),
    new DraftExecutor(draftService),
    new AssetGenerationExecutor(assetHandlers),
    new CompositionExecutor(compositionService),
    new QAExecutor(qaRegistry),
    new QAResolutionExecutor(qaRegistry),
    new ReleaseExecutor(releaseService),
  ]);
  const orchestrator = new ProductionOrchestrator({
    repository,
    executorRegistry,
  });

  return {
    repository,
    planner,
    assetHandlers,
    orchestrator,
  };
}

export function createProduceProductDeferredJobHandler() {
  const root = createFactoryProductionRoot();

  return new ProduceProductDeferredJobHandler({
    planner: root.planner,
    orchestrator: root.orchestrator,
    repository: root.repository,
  });
}
