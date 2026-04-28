import { randomUUID } from "node:crypto";

import type { ResearchPacket, SourceReference, Claim } from "@/core/entities/research-packet";

import type { StageExecutionContext, StageExecutionResult, StageExecutor } from "./types";

export interface ResearchExecutorServiceResult {
  summary: string;
  confidenceScore: number;
  sources: readonly SourceReference[];
  claims: readonly Claim[];
  searchEngine?: ResearchPacket["searchEngine"];
}

export interface ResearchExecutorService {
  research(input: { topic: string; briefTitle: string; abortSignal?: AbortSignal }): Promise<ResearchExecutorServiceResult>;
}

export class ResearchExecutor implements StageExecutor {
  readonly kind = "research" as const;

  constructor(private readonly service: ResearchExecutorService) {}

  async execute(context: StageExecutionContext): Promise<StageExecutionResult> {
    const result = await this.service.research({
      topic: context.brief.topic,
      briefTitle: context.brief.title,
      abortSignal: context.abortSignal,
    });

    const packet: ResearchPacket = {
      id: `research_${randomUUID()}`,
      schemaVersion: 1,
      workOrderId: context.workOrder.id,
      queryUsed: context.stage.config?.kind === "research"
        ? (context.stage.config.queryHint ?? context.brief.topic)
        : context.brief.topic,
      searchTimestamp: new Date().toISOString(),
      summary: result.summary,
      confidenceScore: result.confidenceScore,
      sources: result.sources,
      claims: result.claims,
      searchEngine: result.searchEngine,
    };

    return {
      entityKind: "research_packet",
      entity: packet,
    };
  }
}
