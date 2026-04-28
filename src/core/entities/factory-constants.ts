import type { MediaAssetKind } from "./media-asset";

export type FactoryAssetKind = Extract<
  MediaAssetKind,
  "image" | "chart" | "graph" | "audio" | "video"
>;

export const FACTORY_ASSET_KINDS = [
  "image",
  "chart",
  "graph",
  "audio",
  "video",
] as const satisfies readonly FactoryAssetKind[];

export type QACriterion =
  | "accuracy"
  | "accessibility"
  | "tone_match"
  | "performance"
  | "brand_compliance"
  | "completeness"
  | "uniqueness";

export const QA_CRITERIA = [
  "accuracy",
  "accessibility",
  "tone_match",
  "performance",
  "brand_compliance",
  "completeness",
  "uniqueness",
] as const satisfies readonly QACriterion[];

export type StageKind =
  | "research"
  | "draft"
  | "asset_generation"
  | "composition"
  | "qa"
  | "qa_resolution"
  | "release"
  | "outcome";

export const STAGE_KINDS = [
  "research",
  "draft",
  "asset_generation",
  "composition",
  "qa",
  "qa_resolution",
  "release",
  "outcome",
] as const satisfies readonly StageKind[];

export type WorkOrderStatus = "planned" | "running" | "paused" | "succeeded" | "failed" | "canceled";

export const WORK_ORDER_STATUSES = [
  "planned",
  "running",
  "paused",
  "succeeded",
  "failed",
  "canceled",
] as const satisfies readonly WorkOrderStatus[];

export type GenerationReason = "batch_automation" | "single_asset" | "revision_loop";

export const GENERATION_REASONS = [
  "batch_automation",
  "single_asset",
  "revision_loop",
] as const satisfies readonly GenerationReason[];

export type WorkOrderInitiatedBy = GenerationReason;

export function isFactoryAssetKind(value: string | null | undefined): value is FactoryAssetKind {
  return !!value && FACTORY_ASSET_KINDS.includes(value as FactoryAssetKind);
}

export function isQACriterion(value: string | null | undefined): value is QACriterion {
  return !!value && QA_CRITERIA.includes(value as QACriterion);
}

export function isStageKind(value: string | null | undefined): value is StageKind {
  return !!value && STAGE_KINDS.includes(value as StageKind);
}

export function isWorkOrderStatus(value: string | null | undefined): value is WorkOrderStatus {
  return !!value && WORK_ORDER_STATUSES.includes(value as WorkOrderStatus);
}

export function isGenerationReason(value: string | null | undefined): value is GenerationReason {
  return !!value && GENERATION_REASONS.includes(value as GenerationReason);
}