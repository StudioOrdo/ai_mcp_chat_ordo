import fs from "node:fs";
import path from "node:path";

import { corpusConfig } from "@/lib/corpus-vocabulary";
import {
  RUNTIME_MANIFEST_ROLE_ORDER,
  getRuntimeToolManifestForRole,
} from "@/lib/chat/runtime-manifest";
import { getToolComposition } from "@/lib/chat/tool-composition-root";
import {
  DEFAULT_SHELL_NAVIGATION_CONTEXT,
  SHELL_ROUTES,
  getShellRouteVisibilitySnapshot,
} from "@/lib/shell/shell-navigation";
import type { RoleName } from "@/core/entities/user";
import { MCP_PROCESS_METADATA } from "@/core/capability-catalog/mcp-process-metadata";
import {
  createEliteOpsEvidence,
  type EliteOpsEvidence,
} from "@/lib/evals/elite-ops-evidence";

export interface RuntimeInventoryRouteEntry {
  label: string;
  href: string;
  description: string | null;
}

export interface RuntimeInventory {
  generatedAt: string;
  corpus: {
    name: string;
    documentCount: number;
    sectionCount: number;
    routeBase: string;
  };
  tools: {
    countsByRole: Record<RoleName, number>;
    manifestsByRole: Record<RoleName, Array<{
      name: string;
      description: string;
      category: string;
    }>>;
  };
  navigation: {
    countsByRole: Record<RoleName, number>;
    routesByRole: Record<RoleName, RuntimeInventoryRouteEntry[]>;
  };
  mcp: {
    processCount: number;
    processes: Array<{
      id: string;
      serverName: string;
      entrypoint: string;
      canonicalCommand: string;
      compatibilityAliases: string[];
      capabilityGroups: string[];
    }>;
  };
}

export interface RuntimeIntegrityQaStepResult {
  label: string;
  command: string;
  status: "passed" | "failed" | "skipped";
}

export interface RuntimeIntegrityQaEvidence {
  version: 1;
  generatedAt: string;
  bundleId: "agent-runtime-truthfulness-and-retrieval-integrity";
  status: "passed" | "failed";
  inventory: RuntimeInventory;
  eliteOps: EliteOpsEvidence;
  coverage: {
    deterministicScenarioIds: string[];
    liveScenarioIds: string[];
    focusedTestSuites: string[];
    browserProofSpecs: string[];
    governedDeliveryRoutes: string[];
    issueBuckets: Array<"prompt_runtime_truth_drift" | "retrieval_citation_link_correctness" | "output_render_contract_failure">;
    notes: string[];
  };
  intake: {
    issueTemplatePath: string;
    mappingDocumentPath: string;
  };
  review: {
    blockingReasons: string[];
    warnings: string[];
  };
  steps: RuntimeIntegrityQaStepResult[];
}

export interface WriteRuntimeIntegrityQaEvidenceOptions {
  releaseDir?: string;
  steps: RuntimeIntegrityQaStepResult[];
  warnings?: string[];
  blockingReasons?: string[];
  now?: Date;
}

export const RUNTIME_INTEGRITY_DETERMINISTIC_SCENARIOS = [
  "integrity-canonical-corpus-reference-deterministic",
  "integrity-audio-recovery-deterministic",
  "integrity-malformed-ui-tags-deterministic",
] as const;

export const RUNTIME_INTEGRITY_LIVE_SCENARIOS = [
  "live-runtime-self-knowledge-honesty",
  "live-current-page-truthfulness",
  "live-duplicate-navigation-avoidance",
] as const;

export const RUNTIME_INTEGRITY_MEDIA_HARDENING_TEST_SUITES = [
  "src/hooks/chat/useBrowserCapabilityRuntime.test.tsx",
  "src/lib/jobs/compose-media-deferred-job.test.ts",
  "src/app/api/chat/uploads/route.test.ts",
  "src/app/api/user-files/[id]/route.test.ts",
  "src/frameworks/ui/chat/plugins/custom/MediaRenderCard.test.tsx",
  "src/lib/media/media-asset-projection.test.ts",
  "src/core/use-cases/ConversationInteractor.test.ts",
  "src/core/use-cases/tools/list-conversation-media-assets.tool.test.ts",
  "tests/chat/conversation-portability.test.ts",
  "src/app/my/media/page.test.tsx",
  "src/app/operations/media/page.test.tsx",
] as const;

export const RUNTIME_INTEGRITY_BROWSER_PROOF_SPECS = [
  "tests/browser-ui/ffmpeg-browser-runtime.spec.ts",
  "tests/browser-ui/media-capacity-quotas.spec.ts",
  "tests/browser-ui/operations-media.spec.ts",
] as const;

export const RUNTIME_INTEGRITY_GOVERNED_DELIVERY_ROUTES = [
  "/api/chat/uploads",
  "/api/user-files/[id]",
  "/my/media",
  "/operations/media",
] as const;

export const RUNTIME_INTEGRITY_FOCUSED_TEST_SUITES = [
  "tests/evals/elite-ops-evidence.test.ts",
  "tests/evals/runtime-integrity-checks.test.ts",
  "tests/evals/eval-scenarios.test.ts",
  "tests/evals/eval-runner.test.ts",
  "tests/evals/eval-live-runner.test.ts",
  "tests/evals/eval-release-evidence.test.ts",
  "tests/evals/runtime-integrity-evidence.test.ts",
  "src/lib/corpus-vocabulary.test.ts",
  "src/lib/readme-drift.test.ts",
  "src/core/use-cases/tools/search-corpus.tool.test.ts",
  "src/core/tool-registry/ToolResultFormatter.test.ts",
  "src/core/use-cases/tools/inspect-runtime-context.tool.test.ts",
  "src/lib/chat/tool-composition-root.test.ts",
  "src/lib/chat/current-page-context.test.ts",
  "src/adapters/ChatPresenter.test.ts",
  "src/frameworks/ui/RichContentRenderer.test.tsx",
  "src/components/AudioPlayer.test.tsx",
  ...RUNTIME_INTEGRITY_MEDIA_HARDENING_TEST_SUITES,
] as const;

export const RUNTIME_INTEGRITY_ISSUE_TEMPLATE_PATH = ".github/ISSUE_TEMPLATE/agent-runtime-integrity.yml";
export const RUNTIME_INTEGRITY_MAPPING_DOCUMENT_PATH = "docs/_refactor/agent-runtime-truthfulness-and-retrieval-integrity/spec.md";

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function uniqueNonEmpty(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function isRouteVisibleToRole(route: typeof SHELL_ROUTES[number], role: RoleName): boolean {
  return getShellRouteVisibilitySnapshot(
    route,
    { roles: [role] },
    DEFAULT_SHELL_NAVIGATION_CONTEXT,
  ).any;
}

function createRoleRecord<T>(factory: (role: RoleName) => T): Record<RoleName, T> {
  return RUNTIME_MANIFEST_ROLE_ORDER.reduce<Record<RoleName, T>>((record, role) => {
    record[role] = factory(role);
    return record;
  }, {
    ANONYMOUS: factory("ANONYMOUS"),
    AUTHENTICATED: factory("AUTHENTICATED"),
    APPRENTICE: factory("APPRENTICE"),
    STAFF: factory("STAFF"),
    ADMIN: factory("ADMIN"),
  });
}

export function createRuntimeInventory(now: Date = new Date()): RuntimeInventory {
  const { registry } = getToolComposition();

  const manifestsByRole = createRoleRecord((role) => getRuntimeToolManifestForRole(registry, role));
  const countsByRole = createRoleRecord((role) => manifestsByRole[role].length);
  const routesByRole = createRoleRecord((role) => SHELL_ROUTES
    .filter((route) => route.kind === "internal" && isRouteVisibleToRole(route, role))
    .map((route) => ({
      label: route.label,
      href: route.href,
      description: route.description ?? null,
    }))
    .sort((left, right) => left.href.localeCompare(right.href)));
  const routeCountsByRole = createRoleRecord((role) => routesByRole[role].length);

  return {
    generatedAt: now.toISOString(),
    corpus: {
      name: corpusConfig.corpusName,
      documentCount: corpusConfig.documentCount,
      sectionCount: corpusConfig.sectionCount,
      routeBase: corpusConfig.routeBase,
    },
    tools: {
      countsByRole,
      manifestsByRole,
    },
    navigation: {
      countsByRole: routeCountsByRole,
      routesByRole,
    },
    mcp: {
      processCount: MCP_PROCESS_METADATA.length,
      processes: MCP_PROCESS_METADATA.map((process) => ({
        id: process.id,
        serverName: process.serverName,
        entrypoint: process.entrypoint,
        canonicalCommand: process.canonicalCommand,
        compatibilityAliases: [...process.compatibilityAliases],
        capabilityGroups: [...process.capabilityGroups],
      })),
    },
  };
}

export function createRuntimeIntegrityQaEvidence(options: {
  steps: RuntimeIntegrityQaStepResult[];
  warnings?: string[];
  blockingReasons?: string[];
  now?: Date;
  inventory?: RuntimeInventory;
  eliteOps?: EliteOpsEvidence;
}): RuntimeIntegrityQaEvidence {
  const inventory = options.inventory ?? createRuntimeInventory(options.now);
  const eliteOps = options.eliteOps ?? createEliteOpsEvidence({
    inventoryMcpProcesses: inventory.mcp.processes.map((process) => ({
      id: process.id,
      serverName: process.serverName,
      entrypoint: process.entrypoint,
      canonicalCommand: process.canonicalCommand,
      compatibilityAliases: [...process.compatibilityAliases],
      capabilityGroups: [...process.capabilityGroups],
    })),
    now: options.now,
  });
  const warnings = uniqueNonEmpty([
    ...(options.warnings ?? []),
    ...eliteOps.warnings,
  ]);
  const blockingReasons = uniqueNonEmpty([
    ...(options.blockingReasons ?? []),
    ...eliteOps.blockingReasons,
  ]);
  const failedStep = options.steps.find((step) => step.status === "failed");

  if (failedStep) {
    blockingReasons.push(`QA step failed: ${failedStep.label}.`);
  }

  return {
    version: 1,
    generatedAt: (options.now ?? new Date()).toISOString(),
    bundleId: "agent-runtime-truthfulness-and-retrieval-integrity",
    status: blockingReasons.length > 0 ? "failed" : "passed",
    inventory,
    eliteOps,
    coverage: {
      deterministicScenarioIds: [...RUNTIME_INTEGRITY_DETERMINISTIC_SCENARIOS],
      liveScenarioIds: [...RUNTIME_INTEGRITY_LIVE_SCENARIOS],
      focusedTestSuites: [...RUNTIME_INTEGRITY_FOCUSED_TEST_SUITES],
      browserProofSpecs: [...RUNTIME_INTEGRITY_BROWSER_PROOF_SPECS],
      governedDeliveryRoutes: [...RUNTIME_INTEGRITY_GOVERNED_DELIVERY_ROUTES],
      issueBuckets: [
        "prompt_runtime_truth_drift",
        "retrieval_citation_link_correctness",
        "output_render_contract_failure",
      ],
      notes: [
        "Current-page truthfulness is exercised through live-runner fixtures with authoritative page snapshots.",
        "Duplicate navigation avoidance is gated by role-manifest tests and live runner coverage that rejects legacy navigate usage.",
        "Phase 6 media hardening is gated by focused suites for browser fallback truthfulness, governed upload and retrieval integrity, portability rebinding, and the signed-in media workspace routes.",
        "Browser proof remains a distinct release input: the ffmpeg fallback spec plus the my-media and operations-media Playwright specs validate rendered user-facing behavior against the governed delivery backbone.",
        "Manual QA intake must map back to either a deterministic integrity scenario, a live runner scenario, or a focused regression suite before closeout.",
      ],
    },
    intake: {
      issueTemplatePath: RUNTIME_INTEGRITY_ISSUE_TEMPLATE_PATH,
      mappingDocumentPath: RUNTIME_INTEGRITY_MAPPING_DOCUMENT_PATH,
    },
    review: {
      blockingReasons,
      warnings,
    },
    steps: options.steps,
  };
}

export function readRuntimeIntegrityQaEvidenceFromFile(filePath: string): RuntimeIntegrityQaEvidence | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as RuntimeIntegrityQaEvidence;
}

export function writeRuntimeIntegrityQaEvidenceArtifact(options: WriteRuntimeIntegrityQaEvidenceOptions): {
  artifactPath: string;
  evidence: RuntimeIntegrityQaEvidence;
} {
  const releaseDir = options.releaseDir ?? path.join(process.cwd(), "release");
  const artifactPath = path.join(releaseDir, "runtime-integrity-evidence.json");
  const inventory = createRuntimeInventory(options.now);
  const evidence = createRuntimeIntegrityQaEvidence({
    ...options,
    inventory,
  });

  fs.mkdirSync(releaseDir, { recursive: true });
  fs.writeFileSync(artifactPath, serializeJson(evidence), "utf8");

  return {
    artifactPath,
    evidence,
  };
}

export function writeRuntimeInventoryArtifact(options: {
  releaseDir?: string;
  now?: Date;
} = {}): {
  artifactPath: string;
  inventory: RuntimeInventory;
} {
  const releaseDir = options.releaseDir ?? path.join(process.cwd(), "release");
  const artifactPath = path.join(releaseDir, "runtime-inventory.json");
  const inventory = createRuntimeInventory(options.now);

  fs.mkdirSync(releaseDir, { recursive: true });
  fs.writeFileSync(artifactPath, serializeJson(inventory), "utf8");

  return {
    artifactPath,
    inventory,
  };
}
