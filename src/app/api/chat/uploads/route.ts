import path from "path";
import { NextResponse } from "next/server";

import { getUserFileDataMapper } from "@/adapters/RepositoryFactory";
import { getConversationInteractor } from "@/lib/chat/conversation-root";
import { resolveUserId } from "@/lib/chat/resolve-user";
import { reapStaleChatUploads } from "@/lib/chat/upload-reaper";
import type { UserFileMetadata } from "@/core/entities/user-file";

import { getMediaQuotaPolicy } from "@/lib/storage/media-quota-policy";
import { UserFileQuotaExceededError, UserFileSystem } from "@/lib/user-files";
import { logDegradation, logFailure } from "@/lib/observability/logger";
import { MAX_FILE_SIZE_BYTES } from "@/lib/chat/file-validation";
import { extractUploadMediaMetadata } from "@/lib/media/media-metadata";
import { classifyChatUpload } from "@/lib/media/media-upload-policy";

type UploadRouteErrorCode =
  | "INTERNAL_ERROR"
  | "QUOTA_EXCEEDED"
  | "VALIDATION_ERROR";

function jsonError(
  error: string,
  errorCode: UploadRouteErrorCode,
  status: number,
  extras: Record<string, unknown> = {},
) {
  return NextResponse.json({ error, errorCode, ...extras }, { status });
}

function getExtension(fileName: string, fallbackExtension: string): string {
  const extension = path.extname(fileName).replace(/^\./, "").trim().toLowerCase();
  if (extension) {
    return extension;
  }

  return fallbackExtension;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    const rawConversationId = formData.get("conversationId");
    const rawDerivativeOfAssetId = formData.get("derivativeOfAssetId");
    const rawToolInvocationId = formData.get("toolInvocationId");
    const rawDerivativeOfToolInvocationId = formData.get("derivativeOfToolInvocationId");

    if (files.length === 0) {
      return jsonError("At least one file is required.", "VALIDATION_ERROR", 400);
    }

    const preparedFiles = files.map((file) => {
      const classification = classifyChatUpload(file.name, file.type, {
        allowDerivedAssets: true,
      });
      if (!classification) {
        return {
          file,
          classification: null,
          error: jsonError(
            `Unsupported file type: ${file.type || file.name}. Allowed: PDF, plain text, JPEG, PNG, GIF, WebP, MP3, WAV, OGG, WebM audio, MP4, WebM video, and QuickTime.`,
            "VALIDATION_ERROR",
            400,
          ),
        };
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return {
          file,
          classification,
          error: jsonError(
            `File "${file.name}" exceeds the 32 MB size limit.`,
            "VALIDATION_ERROR",
            400,
          ),
        };
      }

      return {
        file,
        classification,
        error: null,
      };
    });

    const validationFailure = preparedFiles.find((entry) => entry.error !== null);
    if (validationFailure?.error) {
      return validationFailure.error;
    }

    const validatedFiles = preparedFiles.filter((entry): entry is {
      file: File;
      classification: NonNullable<typeof entry.classification>;
      error: null;
    } => entry.classification !== null && entry.error === null);

    const conversationId =
      typeof rawConversationId === "string" && rawConversationId
        ? rawConversationId
        : null;
    const derivativeOfAssetId =
      typeof rawDerivativeOfAssetId === "string" && rawDerivativeOfAssetId.trim().length > 0
        ? rawDerivativeOfAssetId.trim()
        : undefined;
    const toolInvocationId =
      typeof rawToolInvocationId === "string" && rawToolInvocationId.trim().length > 0
        ? rawToolInvocationId.trim()
        : undefined;
    const derivativeOfToolInvocationId =
      typeof rawDerivativeOfToolInvocationId === "string" && rawDerivativeOfToolInvocationId.trim().length > 0
        ? rawDerivativeOfToolInvocationId.trim()
        : undefined;
    const { userId } = await resolveUserId();

    await reapStaleChatUploads({ userId }).catch((error) => {
      logDegradation("UPLOAD_REAPER_WARN", "Chat upload reaper warning", undefined, error);
    });

    if (conversationId) {
      await getConversationInteractor().get(conversationId, userId);
    }

    const ufs = new UserFileSystem(getUserFileDataMapper());
    const policy = getMediaQuotaPolicy();
    const retentionClass = conversationId ? "conversation" : "ephemeral";
    const filesToStore = await Promise.all(
      validatedFiles.map(async ({ file, classification }) => {
        const data = Buffer.from(await file.arrayBuffer());
        const metadata = extractUploadMediaMetadata(classification, data);
        const storedMetadata: Partial<UserFileMetadata> = {
          ...metadata,
          retentionClass,
          ...(derivativeOfAssetId ? { derivativeOfAssetId } : {}),
          ...(toolInvocationId ? { toolInvocationId } : {}),
          ...(derivativeOfToolInvocationId ? { derivativeOfToolInvocationId } : {}),
        };

        return {
          originalFileName: file.name,
          fileType: classification.fileType,
          mimeType: file.type || classification.mimeType || "application/octet-stream",
          extension: getExtension(file.name, classification.extension),
          data,
          metadata: storedMetadata,
        };
      }),
    );

    const persisted = await ufs.storeBinaryBatchWithinQuota({
      userId,
      conversationId,
      quotaPolicy: policy,
      files: filesToStore.map(({ originalFileName: _originalFileName, ...file }) => file),
    });

    const attachments = persisted.files.map((storedFile, index) => {
      const storedMetadata = storedFile.metadata ?? {};

      return {
        assetId: storedFile.id,
        fileName: filesToStore[index]?.originalFileName ?? storedFile.fileName,
        mimeType: storedFile.mimeType,
        fileSize: storedFile.fileSize,
        ...(storedMetadata.assetKind ? { assetKind: storedMetadata.assetKind } : {}),
        ...(typeof storedMetadata.width === "number" ? { width: storedMetadata.width } : {}),
        ...(typeof storedMetadata.height === "number" ? { height: storedMetadata.height } : {}),
        ...(typeof storedMetadata.durationSeconds === "number"
          ? { durationSeconds: storedMetadata.durationSeconds }
          : {}),
        ...(storedMetadata.source ? { source: storedMetadata.source } : {}),
        ...(storedMetadata.retentionClass
          ? { retentionClass: storedMetadata.retentionClass }
          : {}),
        ...(storedMetadata.derivativeOfAssetId
          ? { derivativeOfAssetId: storedMetadata.derivativeOfAssetId }
          : {}),
        ...(storedMetadata.toolInvocationId
          ? { toolInvocationId: storedMetadata.toolInvocationId }
          : {}),
        ...(storedMetadata.derivativeOfToolInvocationId
          ? { derivativeOfToolInvocationId: storedMetadata.derivativeOfToolInvocationId }
          : {}),
      };
    });

    return NextResponse.json({ attachments, quota: persisted.quota });
  } catch (error) {
    if (error instanceof UserFileQuotaExceededError) {
      return jsonError(
        error.message,
        "QUOTA_EXCEEDED",
        409,
        {
          incomingBytes: error.incomingBytes,
          quota: error.quota,
        },
      );
    }

    logFailure("UPLOAD_ROUTE_ERROR", "Chat upload route error", undefined, error);
    return jsonError("Unable to upload chat attachments.", "INTERNAL_ERROR", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      attachmentIds?: unknown;
    };
    const attachmentIds = Array.isArray(body.attachmentIds)
      ? body.attachmentIds.filter(
          (value): value is string => typeof value === "string" && value.length > 0,
        )
      : [];

    if (attachmentIds.length === 0) {
      return jsonError(
        "attachmentIds must be a non-empty array.",
        "VALIDATION_ERROR",
        400,
      );
    }

    const { userId } = await resolveUserId();
    const ufs = new UserFileSystem(getUserFileDataMapper());

    const results = await Promise.all(
      attachmentIds.map(async (attachmentId) => ({
        attachmentId,
        deleted: await ufs.deleteIfUnattached(attachmentId, userId),
      })),
    );

    const deletedIds = results
      .filter((result) => result.deleted)
      .map((result) => result.attachmentId);
    const skippedIds = results
      .filter((result) => !result.deleted)
      .map((result) => result.attachmentId);

    return NextResponse.json({
      deletedIds,
      skippedIds,
      deletedCount: deletedIds.length,
      skippedCount: skippedIds.length,
    });
  } catch (error) {
    logFailure("UPLOAD_CLEANUP_ERROR", "Chat upload cleanup error", undefined, error);
    return jsonError("Unable to clean up chat attachments.", "INTERNAL_ERROR", 500);
  }
}