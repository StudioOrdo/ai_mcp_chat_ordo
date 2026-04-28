import { randomUUID } from "node:crypto";

import type { Draft, DraftSection } from "@/core/entities/draft";

import { requireResearchPacket, type StageExecutionContext, type StageExecutionResult, type StageExecutor } from "./types";

export interface DraftExecutorServiceResult {
  title?: string;
  summary?: string;
  sections: readonly DraftSection[];
}

export interface DraftExecutorService {
  compose(input: { briefTitle: string; topic: string; researchPacket: ReturnType<typeof requireResearchPacket>; abortSignal?: AbortSignal }): Promise<DraftExecutorServiceResult>;
}

export class DraftExecutor implements StageExecutor {
  readonly kind = "draft" as const;

  constructor(private readonly service: DraftExecutorService) {}

  async execute(context: StageExecutionContext): Promise<StageExecutionResult> {
    const researchPacket = requireResearchPacket(context);
    const result = await this.service.compose({
      briefTitle: context.brief.title,
      topic: context.brief.topic,
      researchPacket,
      abortSignal: context.abortSignal,
    });

    const draft: Draft = {
      id: `draft_${randomUUID()}`,
      schemaVersion: 1,
      workOrderId: context.workOrder.id,
      title: result.title ?? context.brief.title,
      summary: result.summary,
      sections: result.sections,
      createdAt: new Date().toISOString(),
      revision: 1,
      sourceResearchPacketId: researchPacket.id,
    };

    return {
      entityKind: "draft",
      entity: draft,
    };
  }
}
