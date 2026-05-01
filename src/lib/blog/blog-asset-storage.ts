import path from "node:path";
import { getDataRootPath } from "@/lib/user-files";

const BLOG_ASSET_ROOT_ENV = "STUDIO_ORDO_BLOG_ASSET_ROOT";

export function getBlogAssetRoot(): string {
  const configuredRoot = process.env[BLOG_ASSET_ROOT_ENV]?.trim();

  if (!configuredRoot) {
    return path.join(getDataRootPath(), "blog-assets");
  }

  return path.resolve(process.cwd(), configuredRoot);
}

export function resolveBlogAssetDiskPath(storagePath: string): string {
  const normalizedStoragePath = storagePath.trim();

  if (!normalizedStoragePath || path.isAbsolute(normalizedStoragePath)) {
    throw new Error("Invalid blog asset storage path.");
  }

  const root = getBlogAssetRoot();
  const resolved = path.resolve(root, normalizedStoragePath);
  const relative = path.relative(root, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Blog asset path escapes storage root.");
  }

  return resolved;
}
