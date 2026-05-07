import {
  createProbeResult,
  type ApplianceHealthProbe,
} from "@/lib/appliance/health-types";

export function createDataBoundaryProbe(): ApplianceHealthProbe {
  return {
    component: "data",
    run(context) {
      const boundary = context.dataBoundary;
      const inside = boundary.sqliteInsideDataDir
        && boundary.blogAssetRootInsideDataDir
        && boundary.userFileRootInsideDataDir;
      const status = inside && boundary.warnings.length === 0 ? "healthy" : "degraded";

      return createProbeResult({
        component: "data",
        impact: "required",
        status,
        checkedAt: context.generatedAt,
        summary: status === "healthy"
          ? "Durable data paths resolve inside DATA_DIR."
          : "One or more durable paths resolve outside DATA_DIR.",
        remediation: status === "healthy"
          ? null
          : "Move SQLite, blog asset, and user-file paths under DATA_DIR or document the external mount explicitly.",
        metadata: {
          dataDir: boundary.dataDir,
          sqlitePath: boundary.sqlitePath,
          blogAssetRoot: boundary.blogAssetRoot,
          userFileRoot: boundary.userFileRoot,
          requiredIncludeCount: boundary.requiredIncludePaths.length,
          defaultExcludeCount: boundary.defaultExcludePaths.length,
          sqliteInsideDataDir: boundary.sqliteInsideDataDir,
          blogAssetRootInsideDataDir: boundary.blogAssetRootInsideDataDir,
          userFileRootInsideDataDir: boundary.userFileRootInsideDataDir,
        },
        warnings: boundary.warnings,
      });
    },
  };
}

