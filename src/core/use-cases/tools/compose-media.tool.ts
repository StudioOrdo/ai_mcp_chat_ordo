import { CAPABILITY_CATALOG } from "@/core/capability-catalog/catalog";
import { buildCatalogBoundToolDescriptor } from "@/core/capability-catalog/runtime-tool-projection";
import {
  MediaCompositionPlanSchema,
  validateMediaCompositionAssetReferences,
  validatePlanConstraints,
} from "@/lib/media/ffmpeg/media-composition-plan";
import { z } from "zod";

const ComposeMediaInputSchema = z.object({
  plan: MediaCompositionPlanSchema,
});

export type ComposeMediaInput = z.infer<typeof ComposeMediaInputSchema>;

export async function executeComposeMedia(input: ComposeMediaInput): Promise<unknown> {
  return {
    action: "compose_media",
    planId: input.plan.id,
    ...input.plan,
    generationStatus: "client_fetch_pending",
  };
}

export const composeMediaTool = buildCatalogBoundToolDescriptor(CAPABILITY_CATALOG.compose_media, {
  parse: parseComposeMediaInput,
  execute: (input) => executeComposeMedia(input),
});

export function parseComposeMediaInput(input: unknown): ComposeMediaInput {
  const parsed = ComposeMediaInputSchema.parse(input);
  const constraintError = validatePlanConstraints(parsed.plan);
  if (constraintError) {
    throw new Error(constraintError);
  }

  const assetReferenceError = validateMediaCompositionAssetReferences(parsed.plan);
  if (assetReferenceError) {
    throw new Error(assetReferenceError);
  }

  return parsed;
}
