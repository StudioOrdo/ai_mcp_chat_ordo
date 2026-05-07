import path from "node:path";
import { resolveApplianceBlogAssetRoot } from "@/lib/appliance/data-boundary";

export function getBlogAssetRoot(): string {
  return resolveApplianceBlogAssetRoot();
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
