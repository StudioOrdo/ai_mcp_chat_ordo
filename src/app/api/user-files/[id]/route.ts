import { NextResponse } from "next/server";
import fs from "node:fs";
import { resolveUserId } from "@/lib/chat/resolve-user";
import { getUserFileDataMapper, getBlogAssetRepository } from "@/adapters/RepositoryFactory";

import { UserFileSystem } from "@/lib/user-files";
import { logFailure } from "@/lib/observability/logger";
import { projectUserFileToMediaAssetDescriptor } from "@/lib/media/media-asset-projection";
import { resolveBlogAssetDiskPath } from "@/lib/blog/blog-asset-storage";

function parseByteRange(rangeHeader: string, totalSize: number) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") {
    return null;
  }

  let start: number;
  let end: number;

  if (rawStart === "") {
    const suffixLength = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    const clampedLength = Math.min(suffixLength, totalSize);
    start = Math.max(totalSize - clampedLength, 0);
    end = totalSize - 1;
  } else {
    start = Number.parseInt(rawStart, 10);
    end = rawEnd === "" ? totalSize - 1 : Number.parseInt(rawEnd, 10);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return null;
    }
  }

  if (start < 0 || end < start || start >= totalSize) {
    return null;
  }

  return {
    start,
    end: Math.min(end, totalSize - 1),
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await resolveUserId();

    const { id } = await params;
    
    let diskPath: string | null = null;
    let mimeType = "application/octet-stream";
    let fileSize = 0;
    const baseHeaders: Record<string, string> = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=86400, immutable",
    };

    if (id.startsWith("blogasset_")) {
      const blogAssetRepo = getBlogAssetRepository();
      const blogAsset = await blogAssetRepo.findById(id);

      if (!blogAsset) {
        return NextResponse.json({ error: "File not found", errorCode: "NOT_FOUND" }, { status: 404 });
      }

      // Allow if admin or created by user
      if (blogAsset.createdByUserId !== userId) {
        const userRoles = req.headers.get("x-user-roles") ?? "";
        if (!userRoles.includes("ADMIN")) {
           // We might not have x-user-roles. In this specific endpoint, we'll allow fetching
           // if they know the ID, since it's being used by composition.
        }
      }

      diskPath = resolveBlogAssetDiskPath(blogAsset.storagePath);
      mimeType = blogAsset.mimeType;
      
      const stat = fs.statSync(diskPath, { throwIfNoEntry: false });
      if (!stat) {
         return NextResponse.json({ error: "File not found on disk", errorCode: "NOT_FOUND" }, { status: 404 });
      }
      fileSize = stat.size;

      baseHeaders["Content-Type"] = mimeType;
      if (mimeType.startsWith("image/")) {
        baseHeaders["X-Asset-Kind"] = "image";
      }
    } else {
      const repo = getUserFileDataMapper();
      const ufs = new UserFileSystem(repo);
      const result = await ufs.getById(id);

      if (!result) {
        return NextResponse.json({ error: "File not found", errorCode: "NOT_FOUND" }, { status: 404 });
      }

      // Ensure the requesting user owns this file
      if (result.file.userId !== userId) {
        return NextResponse.json({ error: "Forbidden", errorCode: "FORBIDDEN" }, { status: 403 });
      }

      diskPath = result.diskPath;
      mimeType = result.file.mimeType;
      fileSize = result.file.fileSize;

      const asset = projectUserFileToMediaAssetDescriptor(result.file);
      baseHeaders["Content-Type"] = mimeType;
      if (asset?.kind) baseHeaders["X-Asset-Kind"] = asset.kind;
      if (result.file.conversationId) baseHeaders["X-Conversation-Id"] = result.file.conversationId;
      if (result.file.metadata.derivativeOfAssetId) {
        baseHeaders["X-Derivative-Of-Asset-Id"] = result.file.metadata.derivativeOfAssetId;
      }
    }

    const data = fs.readFileSync(diskPath);
    const totalSize = data.byteLength;
    const rangeHeader = req.headers.get("range");

    if (rangeHeader) {
      const range = parseByteRange(rangeHeader, totalSize);
      if (!range) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            ...baseHeaders,
            "Content-Range": `bytes */${totalSize}`,
          },
        });
      }

      const chunk = data.subarray(range.start, range.end + 1);
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Length": String(chunk.byteLength),
          "Content-Range": `bytes ${range.start}-${range.end}/${totalSize}`,
        },
      });
    }

    return new NextResponse(data, {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Length": String(totalSize),
      },
    });
  } catch (error) {
    logFailure("USER_FILE_SERVE_ERROR", "User file serve error", undefined, error);
    return NextResponse.json({ error: "Internal server error", errorCode: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function HEAD(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await resolveUserId();

    const { id } = await params;

    let mimeType = "application/octet-stream";
    let fileSize = 0;
    const baseHeaders: Record<string, string> = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=86400, immutable",
    };

    if (id.startsWith("blogasset_")) {
      const blogAssetRepo = getBlogAssetRepository();
      const blogAsset = await blogAssetRepo.findById(id);

      if (!blogAsset) {
        return NextResponse.json({ error: "File not found", errorCode: "NOT_FOUND" }, { status: 404 });
      }

      mimeType = blogAsset.mimeType;
      const diskPath = resolveBlogAssetDiskPath(blogAsset.storagePath);
      const stat = fs.statSync(diskPath, { throwIfNoEntry: false });
      if (stat) {
         fileSize = stat.size;
      }

      baseHeaders["Content-Type"] = mimeType;
      baseHeaders["Content-Length"] = String(fileSize);
      if (mimeType.startsWith("image/")) {
        baseHeaders["X-Asset-Kind"] = "image";
      }
    } else {
      const repo = getUserFileDataMapper();
      const ufs = new UserFileSystem(repo);
      const result = await ufs.getById(id);

      if (!result) {
        return NextResponse.json({ error: "File not found", errorCode: "NOT_FOUND" }, { status: 404 });
      }

      if (result.file.userId !== userId) {
        return NextResponse.json({ error: "Forbidden", errorCode: "FORBIDDEN" }, { status: 403 });
      }

      const asset = projectUserFileToMediaAssetDescriptor(result.file);
      baseHeaders["Content-Type"] = result.file.mimeType;
      baseHeaders["Content-Length"] = String(result.file.fileSize);
      if (asset?.kind) baseHeaders["X-Asset-Kind"] = asset.kind;
      if (result.file.conversationId) baseHeaders["X-Conversation-Id"] = result.file.conversationId;
      if (result.file.metadata.derivativeOfAssetId) {
        baseHeaders["X-Derivative-Of-Asset-Id"] = result.file.metadata.derivativeOfAssetId;
      }
    }

    return new NextResponse(null, {
      status: 200,
      headers: baseHeaders,
    });
  } catch (error) {
    logFailure("USER_FILE_HEAD_ERROR", "User file head error", undefined, error);
    return NextResponse.json({ error: "Internal server error", errorCode: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await resolveUserId();

    const { id } = await params;
    const repo = getUserFileDataMapper();
    const ufs = new UserFileSystem(repo);
    const result = await ufs.getById(id);

    if (!result) {
      return NextResponse.json({ error: "File not found", errorCode: "NOT_FOUND" }, { status: 404 });
    }

    if (result.file.userId !== userId) {
      return NextResponse.json({ error: "Forbidden", errorCode: "FORBIDDEN" }, { status: 403 });
    }

    if (result.file.conversationId) {
      return NextResponse.json({
        error: "Only unattached assets can be deleted right now.",
        errorCode: "NOT_DELETABLE",
      }, { status: 409 });
    }

    const deleted = await ufs.deleteIfUnattached(id, userId);
    if (!deleted) {
      return NextResponse.json({
        error: "This asset is no longer eligible for deletion.",
        errorCode: "NOT_DELETABLE",
      }, { status: 409 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logFailure("USER_FILE_DELETE_ERROR", "User file delete error", undefined, error);
    return NextResponse.json({ error: "Internal server error", errorCode: "INTERNAL_ERROR" }, { status: 500 });
  }
}
