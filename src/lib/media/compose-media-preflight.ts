import type {
  MediaCompositionClip,
  MediaCompositionPlan,
} from "@/core/entities/media-composition";
import type { MediaAssetKind } from "@/core/entities/media-asset";

export type ComposeMediaAssetReadinessStatus = "ready" | "pending" | "not_found" | "forbidden";

export type ComposeMediaPreflightFailureCode =
  | "asset_not_found"
  | "asset_pending"
  | "asset_forbidden"
  | "asset_kind_mismatch"
  | "asset_conversation_mismatch"
  | "asset_metadata_missing"
  | "asset_lineage_mismatch";

export interface ComposeMediaAssetReadinessEntry {
  assetId: string;
  status: ComposeMediaAssetReadinessStatus;
  assetKind?: MediaAssetKind | null;
  conversationId?: string | null;
  derivativeOfAssetId?: string | null;
}

export interface ComposeMediaPreflightFailure {
  code: ComposeMediaPreflightFailureCode;
  message: string;
  assetId: string;
  clipKind: MediaCompositionClip["kind"];
}

function allPlanClips(plan: MediaCompositionPlan): MediaCompositionClip[] {
  return [...plan.visualClips, ...plan.audioClips];
}

function describeClipKind(kind: MediaCompositionClip["kind"]): string {
  return kind;
}

export function evaluateComposeMediaAssetReadiness(options: {
  plan: MediaCompositionPlan;
  assetsById: Map<string, ComposeMediaAssetReadinessEntry>;
}): ComposeMediaPreflightFailure | null {
  for (const clip of allPlanClips(options.plan)) {
    const asset = options.assetsById.get(clip.assetId);

    if (!asset || asset.status === "not_found") {
      return {
        code: "asset_not_found",
        message: `Composition source asset ${clip.assetId} was not found.`,
        assetId: clip.assetId,
        clipKind: clip.kind,
      };
    }

    if (asset.status === "pending") {
      return {
        code: "asset_pending",
        message: `Composition source asset ${clip.assetId} is still pending generation.`,
        assetId: clip.assetId,
        clipKind: clip.kind,
      };
    }

    if (asset.status === "forbidden") {
      return {
        code: "asset_forbidden",
        message: `Composition source asset ${clip.assetId} is not accessible to the current user.`,
        assetId: clip.assetId,
        clipKind: clip.kind,
      };
    }

    if (!asset.assetKind) {
      return {
        code: "asset_metadata_missing",
        message: `Composition source asset ${clip.assetId} did not expose enough metadata for readiness validation.`,
        assetId: clip.assetId,
        clipKind: clip.kind,
      };
    }

    if (asset.assetKind !== clip.kind) {
      return {
        code: "asset_kind_mismatch",
        message: `Composition source asset ${clip.assetId} is ${asset.assetKind} but the clip requires ${describeClipKind(clip.kind)}.`,
        assetId: clip.assetId,
        clipKind: clip.kind,
      };
    }

    if (
      asset.conversationId
      && asset.conversationId !== options.plan.conversationId
    ) {
      return {
        code: "asset_conversation_mismatch",
        message: `Composition source asset ${clip.assetId} does not belong to the active conversation.`,
        assetId: clip.assetId,
        clipKind: clip.kind,
      };
    }

    if (
      clip.sourceAssetId
      && asset.assetId !== clip.sourceAssetId
      && asset.derivativeOfAssetId !== clip.sourceAssetId
    ) {
      return {
        code: "asset_lineage_mismatch",
        message: `Composition source asset ${clip.assetId} does not match the required source lineage ${clip.sourceAssetId}.`,
        assetId: clip.assetId,
        clipKind: clip.kind,
      };
    }
  }

  return null;
}