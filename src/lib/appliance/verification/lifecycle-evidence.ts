import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LifecycleSmokeEvidence } from "./lifecycle-types";

export function redactPathLabel(filePath: string | null | undefined): string {
  if (!filePath) {
    return "unavailable";
  }
  return path.basename(filePath);
}

export function hashPrefix(hash: string | null | undefined): string | null {
  if (!hash) {
    return null;
  }
  return hash.length > 20 ? hash.slice(0, 20) : hash;
}

export async function writeLifecycleEvidence(input: {
  evidence: LifecycleSmokeEvidence;
  outputDir?: string;
}): Promise<{ jsonPath: string; markdownPath: string }> {
  const outputDir = input.outputDir
    ?? path.join(process.cwd(), "docs", "_refactor", "appliance-lifecycle-proof", "evidence");
  await mkdir(outputDir, { recursive: true });
  const stamp = input.evidence.completedAt.replace(/[:.]/g, "-");
  const base = `05-docker-and-worker-verification-${stamp}`;
  const jsonPath = path.join(outputDir, `${base}.json`);
  const markdownPath = path.join(outputDir, `${base}.md`);
  await writeFile(jsonPath, `${JSON.stringify(input.evidence, null, 2)}\n`, "utf-8");
  await writeFile(markdownPath, renderEvidenceMarkdown(input.evidence), "utf-8");
  return { jsonPath, markdownPath };
}

export function renderEvidenceMarkdown(evidence: LifecycleSmokeEvidence): string {
  const stepLines = evidence.steps
    .map((step) => `- ${step.status.toUpperCase()} ${step.name}: ${step.summary} (${step.durationMs}ms)`)
    .join("\n");
  return `# Phase 05 Evidence - Docker And Worker Verification

Captured: ${evidence.completedAt}

Mode: ${evidence.mode}
Status: ${evidence.status}

## Runtime

- Node: ${evidence.nodeVersion}
- Rust: ${evidence.rustVersion ?? "unavailable"}
- Image: ${evidence.imageTag ?? "not used"}
- Git revision: ${evidence.gitRevision ?? "unavailable"}
- Data directory label: ${evidence.dataDirLabel}
- App port: ${evidence.appPort ?? "not started"}
- Media port: ${evidence.mediaPort ?? "not started"}
- Executor path: ${evidence.executorPath ?? "unavailable"}

## Health

- Status: ${evidence.health.status}
- Warnings: ${evidence.health.warnings.length}

## Backup And Restore

- Manual backup: ${evidence.backup.manualBackupId ?? "none"}
- Scheduled backup: ${evidence.backup.scheduledBackupId ?? "none"}
- Archive size: ${evidence.backup.archiveSizeBytes ?? "unknown"}
- Archive hash prefix: ${evidence.backup.archiveHashPrefix ?? "unknown"}
- Restore plan: ${evidence.restore.restorePlanId ?? "none"}
- Restored seed file: ${evidence.restore.restoredSeedFile ? "yes" : "no"}
- Restart verified: ${evidence.restart.verified ? "yes" : "no"}

## Steps

${stepLines}

## Warnings

${evidence.warnings.length > 0 ? evidence.warnings.map((warning) => `- ${warning}`).join("\n") : "- none"}
`;
}
