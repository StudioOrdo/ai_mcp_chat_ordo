export type BackupArchiveEntryKind = "file" | "directory" | "symlink";

export interface BackupArchiveEntry {
  name: string;
  kind: BackupArchiveEntryKind;
  sizeBytes?: number;
}

const ALLOWED_PREFIXES = [
  "data/blog-assets/",
  "data/user-files/",
] as const;

const ALLOWED_EXACT = new Set([
  "manifest.json",
  "data/local.db",
]);

export function normalizeBackupArchiveEntryName(name: string): string {
  return name.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function validateBackupArchiveEntryPath(entry: BackupArchiveEntry): void {
  const rawName = entry.name;
  if (!rawName || !rawName.trim()) {
    throw new Error("Backup archive entry name is required.");
  }
  if (entry.kind === "symlink") {
    throw new Error(`Backup archive entry is a symlink: ${rawName}`);
  }
  if (rawName.startsWith("/") || /^[A-Za-z]:[\\/]/.test(rawName)) {
    throw new Error(`Backup archive entry path must be relative: ${rawName}`);
  }
  if (rawName.includes("\0")) {
    throw new Error("Backup archive entry path contains a null byte.");
  }

  const normalized = normalizeBackupArchiveEntryName(rawName);
  const segments = normalized.split("/");
  if (normalized === "." || normalized === ".." || segments.some((segment) => segment === "." || segment === ".." || segment.length === 0)) {
    throw new Error(`Backup archive entry path is unsafe: ${rawName}`);
  }

  if (ALLOWED_EXACT.has(normalized)) {
    return;
  }

  if (entry.kind === "directory" && (
    normalized === "data/blog-assets"
    || normalized === "data/user-files"
  )) {
    return;
  }

  if (ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return;
  }

  throw new Error(`Backup archive entry path is outside the allowed layout: ${rawName}`);
}

export function validateBackupArchiveEntries(entries: BackupArchiveEntry[]): void {
  for (const entry of entries) {
    validateBackupArchiveEntryPath(entry);
  }
}
