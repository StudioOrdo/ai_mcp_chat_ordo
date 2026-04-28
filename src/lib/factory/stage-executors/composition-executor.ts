import { randomUUID } from "node:crypto";

import type { Composition, CompositionSection } from "@/core/entities/composition";

import { listAssets, requireDraft, type StageExecutionContext, type StageExecutionResult, type StageExecutor } from "./types";

export interface CompositionExecutorServiceResult {
  title?: string;
  sections?: readonly CompositionSection[];
  htmlContent?: string;
  metadata?: Composition["metadata"];
}

export interface CompositionExecutorService {
  compose(input: {
    briefTitle: string;
    targetChannel?: string;
    draft: ReturnType<typeof requireDraft>;
    assets: ReturnType<typeof listAssets>;
    abortSignal?: AbortSignal;
  }): Promise<CompositionExecutorServiceResult>;
}

export class CompositionExecutor implements StageExecutor {
  readonly kind = "composition" as const;

  constructor(private readonly service: CompositionExecutorService) {}

  async execute(context: StageExecutionContext): Promise<StageExecutionResult> {
    const draft = requireDraft(context);
    const assets = listAssets(context);

    const result = await this.service.compose({
      briefTitle: context.brief.title,
      targetChannel: context.brief.targetChannels[0],
      draft,
      assets,
      abortSignal: context.abortSignal,
    });

    const defaultSections: CompositionSection[] = [
      { id: "comp_heading", kind: "heading", order: 0, text: draft.title, level: 1 },
      ...draft.sections.map((section, index) => ({
        id: `draft_${section.id}`,
        kind: "text" as const,
        order: index + 1,
        text: section.text,
      })),
      ...assets.map((asset, index) => ({
        id: `asset_${asset.id}`,
        kind: asset.kind,
        order: draft.sections.length + index + 1,
        assetId: asset.id,
        caption: asset.label,
      })),
    ];

    const composition: Composition = {
      id: `composition_${randomUUID()}`,
      schemaVersion: 1,
      workOrderId: context.workOrder.id,
      title: result.title ?? context.brief.title,
      sections: result.sections ?? defaultSections,
      embeddedAssetIds: assets.map((asset) => asset.id),
      htmlContent: result.htmlContent,
      metadata: result.metadata ?? {
        targetChannel: context.brief.targetChannels[0],
      },
      provenance: {
        draftId: draft.id,
        assetIds: assets.map((asset) => asset.id),
      },
      createdAt: new Date().toISOString(),
      revision: 1,
    };

    return {
      entityKind: "composition",
      entity: composition,
    };
  }
}
