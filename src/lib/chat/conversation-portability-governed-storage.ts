import fs from "node:fs/promises";

import type { UserFileRepository } from "@/core/use-cases/UserFileRepository";
import {
  parseStoredChartSource,
  parseStoredGraphSource,
} from "@/lib/media/compose-media-source-rehydration";
import { getUserFilePath } from "@/lib/user-files";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isResolvedGraphPayload(value: unknown): value is { graph: { kind: string } } {
  return isRecord(value) && isRecord(value.graph) && typeof value.graph.kind === "string";
}

function readPortableAssetFields(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }

  const assetSource = value.assetSource === "generated"
    || value.assetSource === "uploaded"
    || value.assetSource === "derived"
    ? value.assetSource
    : value.source === "generated" || value.source === "uploaded" || value.source === "derived"
      ? value.source
      : undefined;

  return {
    ...(typeof value.assetId === "string" || value.assetId === null
      ? { assetId: value.assetId as string | null }
      : {}),
    ...(typeof value.mimeType === "string" ? { mimeType: value.mimeType } : {}),
    ...(assetSource ? { assetSource } : {}),
    ...(value.retentionClass === "ephemeral"
      || value.retentionClass === "conversation"
      || value.retentionClass === "durable"
      ? { retentionClass: value.retentionClass }
      : {}),
  };
}

export async function rehydratePortableMediaPayloadFromGovernedStorage(
  toolName: string,
  payload: unknown,
  userFileRepository?: UserFileRepository,
): Promise<unknown> {
  if (!userFileRepository || !isRecord(payload)) {
    return payload;
  }

  const assetId = typeof payload.assetId === "string" && payload.assetId.trim().length > 0
    ? payload.assetId.trim()
    : null;

  if (!assetId) {
    return payload;
  }

  const needsChartSource = toolName === "generate_chart"
    && !(typeof payload.code === "string" && payload.code.trim().length > 0);
  const needsGraphSource = toolName === "generate_graph" && !isResolvedGraphPayload(payload);

  if (!needsChartSource && !needsGraphSource) {
    return payload;
  }

  const userFile = await userFileRepository.findById(assetId);
  if (!userFile) {
    return payload;
  }

  if (needsChartSource && userFile.fileType !== "chart") {
    return payload;
  }

  if (needsGraphSource && userFile.fileType !== "graph") {
    return payload;
  }

  try {
    const content = await fs.readFile(getUserFilePath(userFile.userId, userFile.fileName), "utf8");
    const storedPayload = needsChartSource
      ? parseStoredChartSource({
          assetId,
          content,
          mimeType: userFile.mimeType,
        })
      : parseStoredGraphSource({
          assetId,
          content,
          mimeType: userFile.mimeType,
        });

    if (!storedPayload) {
      return payload;
    }

    return {
      ...payload,
      ...storedPayload,
      ...readPortableAssetFields(payload),
    };
  } catch {
    return payload;
  }
}