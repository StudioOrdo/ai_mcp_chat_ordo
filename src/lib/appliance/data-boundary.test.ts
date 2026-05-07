import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getApplianceDataBoundary,
  resolveApplianceBlogAssetRoot,
  resolveApplianceDataDir,
  resolveApplianceSqlitePath,
  resolveApplianceUserFileRoot,
} from "./data-boundary";

const cwd = path.resolve("/tmp/ordo-test");

describe("appliance data boundary", () => {
  it("uses .data/local.db by default", () => {
    const boundary = getApplianceDataBoundary({ env: {}, cwd });

    expect(boundary.dataDir).toBe(path.join(cwd, ".data"));
    expect(boundary.sqlitePath).toBe(path.join(cwd, ".data", "local.db"));
    expect(boundary.defaultSqlitePath).toBe(path.join(cwd, ".data", "local.db"));
    expect(boundary.blogAssetRoot).toBe(path.join(cwd, ".data", "blog-assets"));
    expect(boundary.userFileRoot).toBe(path.join(cwd, ".data", "user-files"));
    expect(boundary.warnings).toEqual([]);
  });

  it("resolves DATA_DIR relative to cwd", () => {
    expect(resolveApplianceDataDir({ env: { DATA_DIR: "runtime-data" }, cwd }))
      .toBe(path.join(cwd, "runtime-data"));
  });

  it("resolves STUDIO_ORDO_DB_PATH before DATA_DIR", () => {
    const sqlitePath = resolveApplianceSqlitePath({
      env: {
        DATA_DIR: "runtime-data",
        STUDIO_ORDO_DB_PATH: "custom/local.db",
      },
      cwd,
    });

    expect(sqlitePath).toBe(path.join(cwd, "custom", "local.db"));
  });

  it("warns when sqlite path resolves outside DATA_DIR", () => {
    const boundary = getApplianceDataBoundary({
      env: {
        DATA_DIR: "runtime-data",
        STUDIO_ORDO_DB_PATH: "../outside/local.db",
      },
      cwd,
    });

    expect(boundary.sqliteInsideDataDir).toBe(false);
    expect(boundary.warnings).toContain("STUDIO_ORDO_DB_PATH resolves outside DATA_DIR.");
  });

  it("preserves the blog asset root override and warns when outside DATA_DIR", () => {
    const boundary = getApplianceDataBoundary({
      env: {
        DATA_DIR: "runtime-data",
        STUDIO_ORDO_BLOG_ASSET_ROOT: "../asset-root",
      },
      cwd,
    });

    expect(resolveApplianceBlogAssetRoot({
      env: { STUDIO_ORDO_BLOG_ASSET_ROOT: "../asset-root" },
      cwd,
    })).toBe(path.resolve(cwd, "../asset-root"));
    expect(boundary.blogAssetRootInsideDataDir).toBe(false);
    expect(boundary.warnings).toContain(
      "STUDIO_ORDO_BLOG_ASSET_ROOT resolves outside DATA_DIR.",
    );
  });

  it("keeps user files under DATA_DIR", () => {
    const userFileRoot = resolveApplianceUserFileRoot({
      env: { DATA_DIR: "runtime-data" },
      cwd,
    });

    expect(userFileRoot).toBe(path.join(cwd, "runtime-data", "user-files"));
  });

  it("includes sqlite WAL and SHM siblings in required paths", () => {
    const boundary = getApplianceDataBoundary({ env: { DATA_DIR: "runtime-data" }, cwd });

    expect(boundary.sqliteWalPath).toBe(`${boundary.sqlitePath}-wal`);
    expect(boundary.sqliteShmPath).toBe(`${boundary.sqlitePath}-shm`);
    expect(boundary.requiredIncludePaths).toEqual(
      expect.arrayContaining([
        boundary.dataDir,
        boundary.sqlitePath,
        boundary.sqliteWalPath,
        boundary.sqliteShmPath,
        boundary.blogAssetRoot,
        boundary.userFileRoot,
      ]),
    );
  });

  it("publishes stable default excludes", () => {
    const boundary = getApplianceDataBoundary({ env: { DATA_DIR: "runtime-data" }, cwd });

    expect(boundary.defaultExcludePaths).toEqual(
      expect.arrayContaining([
        path.join(boundary.dataDir, ".server.lock"),
        path.join(cwd, ".runtime-logs"),
        path.join(cwd, ".next", "cache"),
      ]),
    );
  });
});

