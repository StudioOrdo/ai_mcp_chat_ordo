import type { BlogAsset } from "@/core/entities/blog-asset";
import type { AssetCatalogEntry } from "@/core/entities/asset-catalog";
import type { MaterializationRecord } from "@/core/entities/materialization";
import type { BlogAssetRepository } from "@/core/use-cases/BlogAssetRepository";
import {
  filterAssetCatalogEntriesByKinds,
  type AssetCatalogReader,
  type FindAssetCatalogEntryInput,
  type ListConversationAssetsInput,
  type ListReusableMediaAssetsInput,
} from "@/core/use-cases/AssetCatalogReader";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import type { UserFileRepository } from "@/core/use-cases/UserFileRepository";
import {
  dedupeAssetCatalogEntries,
  projectAssetCatalogEntryToWorkspaceAssetRef,
  projectBlogAssetToAssetCatalogEntry,
  projectUserFileToAssetCatalogEntry,
  sortAssetCatalogEntries,
} from "./AssetCatalogProjector";

export interface RepositoryBackedAssetCatalogReaderDeps {
  userFileRepository: UserFileRepository;
  materializationRepository?: MaterializationRepository;
  blogAssetRepository?: BlogAssetRepository;
}

function buildConversationMaterializationMap(
  records: readonly MaterializationRecord[],
): ReadonlyMap<string, MaterializationRecord> {
  const map = new Map<string, MaterializationRecord>();

  for (const record of records) {
    for (const outputRef of record.outputRefs) {
      if (outputRef.kind === "asset" && !map.has(outputRef.id)) {
        map.set(outputRef.id, record);
      }
    }
  }

  return map;
}

async function resolveUserFileEntry(
  deps: RepositoryBackedAssetCatalogReaderDeps,
  file: Awaited<ReturnType<UserFileRepository["findById"]>> extends infer T ? Exclude<T, null> : never,
  materialization: MaterializationRecord | null | undefined,
): Promise<AssetCatalogEntry | null> {
  const resolvedMaterialization = materialization
    ?? await deps.materializationRepository?.findLatestByOutputRef("asset", file.id)
    ?? null;

  return projectUserFileToAssetCatalogEntry(file, resolvedMaterialization);
}

export class RepositoryBackedAssetCatalogReader implements AssetCatalogReader {
  constructor(private readonly deps: RepositoryBackedAssetCatalogReaderDeps) {}

  async listConversationAssets(input: ListConversationAssetsInput): Promise<AssetCatalogEntry[]> {
    const [conversationFiles, conversationMaterializations] = await Promise.all([
      this.deps.userFileRepository.listByConversation(input.conversationId),
      this.deps.materializationRepository?.listByConversation(input.conversationId) ?? Promise.resolve([]),
    ]);

    const directFiles = conversationFiles.filter((file) => file.userId === input.userId);
    const directFileIds = new Set(directFiles.map((file) => file.id));
    const conversationMaterializationMap = buildConversationMaterializationMap(conversationMaterializations);
    const materializedFiles = await Promise.all(
      [...conversationMaterializationMap.keys()]
        .filter((assetId) => !directFileIds.has(assetId))
        .map(async (assetId) => {
          const file = await this.deps.userFileRepository.findById(assetId);
          return file && file.userId === input.userId ? file : null;
        }),
    );

    const files = [...new Map(
      [...directFiles, ...materializedFiles.filter((file): file is NonNullable<typeof file> => file !== null)]
        .map((file) => [file.id, file] as const),
    ).values()];

    const entries = await Promise.all(
      files
        .map((file) => resolveUserFileEntry(this.deps, file, conversationMaterializationMap.get(file.id))),
    );

    return sortAssetCatalogEntries(entries.filter((entry): entry is AssetCatalogEntry => entry !== null));
  }

  async listReusableMediaAssets(input: ListReusableMediaAssetsInput): Promise<AssetCatalogEntry[]> {
    const limit = Math.min(Math.max(Math.trunc(input.limit ?? 25), 1), 25);
    const conversationAssets = filterAssetCatalogEntriesByKinds(
      await this.listConversationAssets({ conversationId: input.conversationId, userId: input.userId }),
      input.kinds,
    ).filter((entry) => entry.kind !== "document");

    const blogAssets = input.kinds && !input.kinds.includes("image")
      ? []
      : await this.deps.blogAssetRepository?.listByUser(input.userId, {
          limit,
          kinds: ["hero"],
        }) ?? [];

    const blogEntries = blogAssets
      .map(projectBlogAssetToAssetCatalogEntry)
      .filter((entry): entry is AssetCatalogEntry => entry !== null);

    return sortAssetCatalogEntries(dedupeAssetCatalogEntries([...conversationAssets, ...blogEntries])).slice(0, limit);
  }

  async findByAssetId(input: FindAssetCatalogEntryInput): Promise<AssetCatalogEntry | null> {
    if (input.assetId.startsWith("blogasset_")) {
      const blogAsset = await this.deps.blogAssetRepository?.findById(input.assetId);
      if (!blogAsset || blogAsset.createdByUserId !== input.userId) {
        return null;
      }

      return projectBlogAssetToAssetCatalogEntry(blogAsset);
    }

    const file = await this.deps.userFileRepository.findById(input.assetId);
    if (!file || file.userId !== input.userId) {
      return null;
    }

    return resolveUserFileEntry(this.deps, file, null);
  }
}

export function createAssetCatalogReader(
  deps: RepositoryBackedAssetCatalogReaderDeps,
): AssetCatalogReader {
  return new RepositoryBackedAssetCatalogReader(deps);
}