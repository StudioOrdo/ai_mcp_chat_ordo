import type { MediaAssetKind } from "@/core/entities/media-asset";
import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import type { ToolCommand } from "@/core/tool-registry/ToolCommand";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type { AssetCatalogReader } from "@/core/use-cases/AssetCatalogReader";
import type { ConversationMediaAssetCandidate } from "@/lib/media/media-asset-projection";
import { projectAssetCatalogEntryToConversationMediaAssetCandidate } from "@/core/platform/asset-catalog/AssetCatalogProjector";

const ALLOWED_MEDIA_ASSET_KINDS = [
  "audio",
  "chart",
  "graph",
  "image",
  "video",
  "subtitle",
  "waveform",
] as const satisfies readonly MediaAssetKind[];

export interface ListConversationMediaAssetsInput {
  kinds?: MediaAssetKind[];
  limit?: number;
}

interface ListConversationMediaAssetsOutput {
  ok: true;
  action: "list_conversation_media_assets";
  conversationId: string;
  assets: ConversationMediaAssetCandidate[];
  summary: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAllowedMediaAssetKind(value: string): value is MediaAssetKind {
  return ALLOWED_MEDIA_ASSET_KINDS.includes(value as MediaAssetKind);
}

export function parseListConversationMediaAssetsInput(value: unknown): ListConversationMediaAssetsInput {
  if (!isRecord(value)) {
    return {};
  }

  const kinds = Array.isArray(value.kinds)
    ? value.kinds.map((item) => {
        if (typeof item !== "string" || !isAllowedMediaAssetKind(item)) {
          throw new Error(`Unsupported media asset kind: ${String(item)}`);
        }

        return item;
      })
    : undefined;

  const limit = value.limit;
  if (limit !== undefined && (typeof limit !== "number" || !Number.isFinite(limit))) {
    throw new Error("limit must be a finite number when provided.");
  }

  return {
    ...(kinds ? { kinds } : {}),
    ...(typeof limit === "number" ? { limit } : {}),
  };
}

class ListConversationMediaAssetsCommand implements ToolCommand<
  ListConversationMediaAssetsInput,
  ListConversationMediaAssetsOutput
> {
  constructor(
    private readonly assetCatalogReader: AssetCatalogReader,
  ) {}

  async execute(
    input: ListConversationMediaAssetsInput,
    context?: ToolExecutionContext,
  ): Promise<ListConversationMediaAssetsOutput> {
    if (!context || context.role === "ANONYMOUS") {
      throw new Error("Sign in is required to inspect reusable media assets.");
    }

    if (!context.conversationId) {
      throw new Error("Conversation context is required to list reusable media assets.");
    }

    const assets = (await this.assetCatalogReader.listReusableMediaAssets({
      conversationId: context.conversationId,
      userId: context.userId,
      kinds: input.kinds,
      limit: input.limit,
    }))
      .map(projectAssetCatalogEntryToConversationMediaAssetCandidate)
      .filter((asset): asset is ConversationMediaAssetCandidate => Boolean(asset));

    return {
      ok: true,
      action: "list_conversation_media_assets",
      conversationId: context.conversationId,
      assets,
      summary: assets.length === 0
        ? "No reusable media assets were found for this conversation."
        : `Returned ${assets.length} reusable media asset${assets.length === 1 ? "" : "s"} for this conversation. Use the assetId values exactly as shown when referencing them in compose_media clips. Charts and graphs are valid direct governed inputs; if a derived image exists, preserve the original source via sourceAssetId.`,
    };
  }
}

export function createListConversationMediaAssetsTool(
  assetCatalogReader: AssetCatalogReader,
): ToolDescriptor<ListConversationMediaAssetsInput, ListConversationMediaAssetsOutput> {
  return {
    name: "list_conversation_media_assets",
    schema: {
      description:
        "List reusable governed media assets already attached to the current conversation, including blog images (blogasset_ IDs). "
        + "ALWAYS call this before compose_media when the user wants to reuse a previously generated chart, graph, audio file, image, or video. "
        + "The assetId values returned are the exact canonical IDs to pass into compose_media clips — copy them verbatim.",
      input_schema: {
        type: "object",
        properties: {
          kinds: {
            type: "array",
            description: "Optional media kinds to include in the result.",
            items: {
              type: "string",
              enum: [...ALLOWED_MEDIA_ASSET_KINDS],
            },
          },
          limit: {
            type: "number",
            description: "Maximum number of assets to return, between 1 and 25.",
          },
        },
      },
    },
    command: new ListConversationMediaAssetsCommand(assetCatalogReader),
    roles: ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
    category: "content",
  };
}
