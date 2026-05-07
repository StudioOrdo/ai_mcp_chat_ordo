import path from "node:path";

const DEFAULT_DATA_DIR = ".data";
const DEFAULT_SQLITE_FILE = "local.db";
const BLOG_ASSET_ROOT_ENV = "STUDIO_ORDO_BLOG_ASSET_ROOT";

export interface ApplianceDataBoundaryInput {
  env?: Record<string, string | undefined>;
  cwd?: string;
}

export interface ApplianceDataBoundary {
  dataDir: string;
  sqlitePath: string;
  sqliteWalPath: string;
  sqliteShmPath: string;
  sqliteInsideDataDir: boolean;
  defaultSqlitePath: string;
  blogAssetRoot: string;
  blogAssetRootInsideDataDir: boolean;
  userFileRoot: string;
  userFileRootInsideDataDir: boolean;
  requiredIncludePaths: string[];
  defaultExcludePaths: string[];
  warnings: string[];
}

function trimEnv(env: Record<string, string | undefined>, key: string): string | null {
  const value = env[key]?.trim();
  return value && value.length > 0 ? value : null;
}

function resolveFromCwd(cwd: string, value: string): string {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(cwd, value);
}

function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveApplianceDataDir(input: ApplianceDataBoundaryInput = {}): string {
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  return resolveFromCwd(cwd, trimEnv(env, "DATA_DIR") ?? DEFAULT_DATA_DIR);
}

export function resolveApplianceSqlitePath(input: ApplianceDataBoundaryInput = {}): string {
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  const configuredPath = trimEnv(env, "STUDIO_ORDO_DB_PATH");

  if (configuredPath) {
    return resolveFromCwd(cwd, configuredPath);
  }

  return path.join(resolveApplianceDataDir({ env, cwd }), DEFAULT_SQLITE_FILE);
}

export function resolveApplianceBlogAssetRoot(input: ApplianceDataBoundaryInput = {}): string {
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  const configuredRoot = trimEnv(env, BLOG_ASSET_ROOT_ENV);

  if (configuredRoot) {
    return resolveFromCwd(cwd, configuredRoot);
  }

  return path.join(resolveApplianceDataDir({ env, cwd }), "blog-assets");
}

export function resolveApplianceUserFileRoot(input: ApplianceDataBoundaryInput = {}): string {
  return path.join(resolveApplianceDataDir(input), "user-files");
}

export function getApplianceDataBoundary(
  input: ApplianceDataBoundaryInput = {},
): ApplianceDataBoundary {
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  const dataDir = resolveApplianceDataDir({ env, cwd });
  const sqlitePath = resolveApplianceSqlitePath({ env, cwd });
  const defaultSqlitePath = path.join(dataDir, DEFAULT_SQLITE_FILE);
  const blogAssetRoot = resolveApplianceBlogAssetRoot({ env, cwd });
  const userFileRoot = resolveApplianceUserFileRoot({ env, cwd });
  const sqliteInsideDataDir = isPathInside(dataDir, sqlitePath);
  const blogAssetRootInsideDataDir = isPathInside(dataDir, blogAssetRoot);
  const userFileRootInsideDataDir = isPathInside(dataDir, userFileRoot);
  const warnings: string[] = [];

  if (!sqliteInsideDataDir) {
    warnings.push("STUDIO_ORDO_DB_PATH resolves outside DATA_DIR.");
  }

  if (!blogAssetRootInsideDataDir) {
    warnings.push("STUDIO_ORDO_BLOG_ASSET_ROOT resolves outside DATA_DIR.");
  }

  return {
    dataDir,
    sqlitePath,
    sqliteWalPath: `${sqlitePath}-wal`,
    sqliteShmPath: `${sqlitePath}-shm`,
    sqliteInsideDataDir,
    defaultSqlitePath,
    blogAssetRoot,
    blogAssetRootInsideDataDir,
    userFileRoot,
    userFileRootInsideDataDir,
    requiredIncludePaths: [
      dataDir,
      sqlitePath,
      `${sqlitePath}-wal`,
      `${sqlitePath}-shm`,
      blogAssetRoot,
      userFileRoot,
    ],
    defaultExcludePaths: [
      path.join(dataDir, ".server.lock"),
      path.resolve(cwd, ".runtime-logs"),
      path.resolve(cwd, ".next", "cache"),
      path.resolve(cwd, ".next"),
      path.resolve(cwd, "out"),
      path.resolve(cwd, "dist"),
      path.resolve(cwd, "tmp"),
      path.resolve(cwd, "temp"),
    ],
    warnings,
  };
}
