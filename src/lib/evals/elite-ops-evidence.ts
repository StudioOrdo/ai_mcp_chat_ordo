import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";

import type { RoleName } from "@/core/entities/user";
import { MCP_PROCESS_METADATA } from "@/core/capability-catalog/mcp-process-metadata";
import { QueryProcessor } from "@/core/search/QueryProcessor";
import { STOPWORDS } from "@/core/search/data/stopwords";
import { SYNONYMS } from "@/core/search/data/synonyms";
import { LowercaseStep } from "@/core/search/query-steps/LowercaseStep";
import { StopwordStep } from "@/core/search/query-steps/StopwordStep";
import { SynonymStep } from "@/core/search/query-steps/SynonymStep";
import { getAllMcpExportableTools } from "@/core/capability-catalog/mcp-export";
import { getAnalyticsToolSchemas } from "@/lib/capabilities/shared/analytics-tool";
import { getEmbeddingToolSchemas } from "@/lib/capabilities/shared/embedding-tool";
import { getCorpusToolSchemas } from "@/lib/capabilities/shared/librarian-tool";
import { getPromptToolSchemas } from "@/lib/capabilities/shared/prompt-tool";
import { corpusConfig } from "@/lib/corpus-vocabulary";
import { getDbBusyTimeoutMs } from "@/adapters/RepositoryFactory";
import { classifyProviderError, resolveProviderPolicy } from "@/lib/chat/provider-policy";
import { getToolComposition } from "@/lib/chat/tool-composition-root";
import {
  RUNTIME_MANIFEST_ROLE_ORDER,
  getRuntimeToolManifestForRole,
} from "@/lib/chat/runtime-manifest";
import { validateRequiredRuntimeConfig } from "@/lib/config/env";
import {
  getShellRouteById,
  getShellRouteVisibilitySnapshot,
} from "@/lib/shell/shell-navigation";

const PROJECT_ROOT = process.cwd();
const PROCESS_MODEL_DOC_PATH = path.join(PROJECT_ROOT, "docs/operations/process-model.md");
const SYSTEM_ARCHITECTURE_DOC_PATH = path.join(PROJECT_ROOT, "docs/operations/system-architecture.md");
const TOOL_COMPOSITION_ROOT_PATH = path.join(PROJECT_ROOT, "src/lib/chat/tool-composition-root.ts");
const RELEASE_EVIDENCE_SOURCE_PATH = path.join(PROJECT_ROOT, "src/lib/evals/release-evidence.ts");
const DB_INDEX_PATH = path.join(PROJECT_ROOT, "src/lib/db/index.ts");
const OPERATIONS_TOOL_INVENTORY_PATH = path.join(
  PROJECT_ROOT,
  "tests/mcp/transport/operations-tool-inventory.json",
);
const TSX_BINARY = path.join(
  PROJECT_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx",
);
const STDOUT_MARKER = "__ELITE_OPS__";

const ALL_ROLES: readonly RoleName[] = [...RUNTIME_MANIFEST_ROLE_ORDER];
const SIGNED_IN_ROLES: readonly RoleName[] = [
  "AUTHENTICATED",
  "APPRENTICE",
  "STAFF",
  "ADMIN",
];

interface CriticalToolExpectation {
  toolName: string;
  allowedRoles: readonly RoleName[];
  rationale: string;
}

interface CriticalRouteExpectation {
  routeId: string;
  allowedRoles: readonly RoleName[];
  rationale: string;
}

interface CriticalMcpExportExpectation {
  processId: string;
  toolName: string;
  runtimeRoles: readonly RoleName[];
  rationale: string;
}

const CRITICAL_TOOL_EXPECTATIONS: readonly CriticalToolExpectation[] = [
  {
    toolName: "navigate_to_page",
    allowedRoles: ALL_ROLES,
    rationale: "Navigation stays available to every runtime role.",
  },
  {
    toolName: "search_corpus",
    allowedRoles: ALL_ROLES,
    rationale: "Corpus retrieval stays available to every runtime role.",
  },
  {
    toolName: "generate_chart",
    allowedRoles: ALL_ROLES,
    rationale: "Chart generation remains available across public and signed-in runtime roles.",
  },
  {
    toolName: "search_my_conversations",
    allowedRoles: SIGNED_IN_ROLES,
    rationale: "Private conversation search stays scoped to signed-in roles.",
  },
  {
    toolName: "get_my_affiliate_summary",
    allowedRoles: SIGNED_IN_ROLES,
    rationale: "Affiliate self-serve tooling stays scoped to signed-in roles.",
  },
  {
    toolName: "admin_search",
    allowedRoles: ["ADMIN"],
    rationale: "Admin search stays operator-only.",
  },
  {
    toolName: "get_admin_affiliate_summary",
    allowedRoles: ["ADMIN"],
    rationale: "Admin affiliate analytics stay operator-only.",
  },
  {
    toolName: "draft_content",
    allowedRoles: ["ADMIN"],
    rationale: "Content drafting stays operator-only.",
  },
];

const CRITICAL_ROUTE_EXPECTATIONS: readonly CriticalRouteExpectation[] = [
  {
    routeId: "home",
    allowedRoles: ALL_ROLES,
    rationale: "The conversational homepage remains visible to every role.",
  },
  {
    routeId: "offers",
    allowedRoles: ALL_ROLES,
    rationale: "The public offers surface remains visible to every role.",
  },
  {
    routeId: "studio",
    allowedRoles: SIGNED_IN_ROLES,
    rationale: "The Studio owner surface stays scoped to signed-in users.",
  },
  {
    routeId: "business",
    allowedRoles: SIGNED_IN_ROLES,
    rationale: "The Business owner surface stays scoped to signed-in users.",
  },
  {
    routeId: "profile",
    allowedRoles: SIGNED_IN_ROLES,
    rationale: "Profile access stays scoped to signed-in users.",
  },
  {
    routeId: "admin-dashboard",
    allowedRoles: ["ADMIN"],
    rationale: "The admin dashboard stays operator-only.",
  },
  {
    routeId: "admin-system",
    allowedRoles: ["ADMIN"],
    rationale: "System diagnostics stay operator-only.",
  },
  {
    routeId: "journal-admin",
    allowedRoles: ["STAFF", "ADMIN"],
    rationale: "Editorial workflow access stays staff-or-admin only.",
  },
];

const CRITICAL_MCP_EXPORT_EXPECTATIONS: readonly CriticalMcpExportExpectation[] = [
  {
    processId: "calculator",
    toolName: "calculator",
    runtimeRoles: ALL_ROLES,
    rationale: "Calculator remains dual-surface across runtime and MCP.",
  },
  {
    processId: "operations",
    toolName: "prompt_set",
    runtimeRoles: [],
    rationale: "Prompt mutation remains MCP-only.",
  },
  {
    processId: "operations",
    toolName: "prompt_get_provenance",
    runtimeRoles: [],
    rationale: "Prompt provenance replay stays on the operations export boundary.",
  },
  {
    processId: "operations",
    toolName: "conversation_analytics",
    runtimeRoles: [],
    rationale: "Conversation analytics remain export-only.",
  },
  {
    processId: "operations",
    toolName: "corpus_list",
    runtimeRoles: [],
    rationale: "Corpus management stays on the operations export boundary.",
  },
];

const LATENCY_BUDGETS = {
  promptAssemblyMs: 1500,
  retrievalPreparationMs: 250,
  firstToolExecutionMs: 1500,
  representativeMcpRoundTripMs: 8000,
} as const;

let cachedLatencyBudgetEvidence: LatencyBudgetEvidence | null = null;

export interface RuntimeInventoryMcpProcessSnapshot {
  id: string;
  serverName: string;
  entrypoint: string;
  canonicalCommand: string;
  compatibilityAliases: string[];
  capabilityGroups: string[];
}

export interface ArchitectureDriftCheck {
  id: string;
  label: string;
  status: "passed" | "failed";
  expected: string;
  observed: string;
  sources: string[];
}

export interface ArchitectureDriftEvidence {
  status: "passed" | "failed";
  checks: ArchitectureDriftCheck[];
  blockingReasons: string[];
  warnings: string[];
}

export interface RbacRegressionMatrixEntry {
  surfaceKind: "tool" | "route" | "mcp_export";
  surfaceId: string;
  role: RoleName;
  expected: "allow" | "deny";
  observed: "allow" | "deny";
  status: "passed" | "failed";
  rationale: string;
  mechanisms: string[];
}

export interface RbacRegressionMatrix {
  status: "passed" | "failed";
  entries: RbacRegressionMatrixEntry[];
  summary: {
    totalEntries: number;
    failedEntries: number;
    toolEntries: number;
    routeEntries: number;
    mcpExportEntries: number;
  };
  blockingReasons: string[];
  warnings: string[];
}

export interface LatencyBudgetMeasurement {
  id:
    | "prompt_assembly"
    | "retrieval_preparation"
    | "first_tool_execution"
    | "representative_mcp_round_trip";
  label: string;
  budgetMs: number;
  observedMs: number | null;
  status: "passed" | "failed";
  notes: string[];
}

export interface LatencyBudgetEvidence {
  status: "passed" | "failed";
  measurements: LatencyBudgetMeasurement[];
  blockingReasons: string[];
  warnings: string[];
}

export interface FailureModeProbe {
  id: string;
  label: string;
  status: "passed" | "failed";
  diagnostic: string;
  expectedSignal: string;
  evidenceSources: string[];
}

export interface FailureModeEvidence {
  status: "passed" | "failed";
  probes: FailureModeProbe[];
  blockingReasons: string[];
  warnings: string[];
}

export interface EliteOpsEvidence {
  version: 1;
  generatedAt: string;
  status: "passed" | "failed";
  architectureDrift: ArchitectureDriftEvidence;
  rbacMatrix: RbacRegressionMatrix;
  latencyBudgets: LatencyBudgetEvidence;
  failureModes: FailureModeEvidence;
  blockingReasons: string[];
  warnings: string[];
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createSpawnEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  ) as NodeJS.ProcessEnv;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function arrayEquals(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function formatJson(value: unknown): string {
  return JSON.stringify(value);
}

function roleAllows(allowedRoles: readonly RoleName[], role: RoleName): boolean {
  return allowedRoles.includes(role);
}

function getRecordedOperationsToolInventory(): string[] {
  return JSON.parse(fs.readFileSync(OPERATIONS_TOOL_INVENTORY_PATH, "utf8")) as string[];
}

function getExpectedOperationsToolInventory(): string[] {
  return [
    ...getEmbeddingToolSchemas(corpusConfig.sourceType),
    ...getCorpusToolSchemas(),
    ...getPromptToolSchemas(),
    ...getAnalyticsToolSchemas(),
    ...getAllMcpExportableTools().map((tool) => ({
      name: tool.name,
    })),
  ]
    .map((tool) => tool.name)
    .sort((left, right) => left.localeCompare(right));
}

function getTransportExportsByProcess(): Record<string, string[]> {
  return {
    calculator: ["calculator"],
    operations: getRecordedOperationsToolInventory(),
  };
}

function normalizeProcessSnapshot(
  process: RuntimeInventoryMcpProcessSnapshot,
): RuntimeInventoryMcpProcessSnapshot {
  return {
    id: process.id,
    serverName: process.serverName,
    entrypoint: process.entrypoint,
    canonicalCommand: process.canonicalCommand,
    compatibilityAliases: [...process.compatibilityAliases].sort((left, right) => left.localeCompare(right)),
    capabilityGroups: [...process.capabilityGroups].sort((left, right) => left.localeCompare(right)),
  };
}

function getExpectedProcessSnapshots(): RuntimeInventoryMcpProcessSnapshot[] {
  return MCP_PROCESS_METADATA.map((process) => normalizeProcessSnapshot({
    id: process.id,
    serverName: process.serverName,
    entrypoint: process.entrypoint,
    canonicalCommand: process.canonicalCommand,
    compatibilityAliases: [...process.compatibilityAliases],
    capabilityGroups: [...process.capabilityGroups],
  }));
}

function runTsxJsonSnippet<T>(code: string): { ok: true; value: T } | { ok: false; diagnostic: string } {
  const result = spawnSync(TSX_BINARY, ["-e", code], {
    cwd: PROJECT_ROOT,
    env: createSpawnEnv(),
    encoding: "utf8",
    timeout: 30000,
  });

  if (result.error) {
    return { ok: false, diagnostic: result.error.message };
  }

  const stdout = result.stdout?.trim() ?? "";
  const stderr = result.stderr?.trim() ?? "";

  if (result.status !== 0) {
    return {
      ok: false,
      diagnostic: [stderr, stdout].filter(Boolean).join("\n") || `tsx exited with status ${result.status ?? "unknown"}.`,
    };
  }

  const markerLine = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .reverse()
    .find((line) => line.startsWith(STDOUT_MARKER));

  if (!markerLine) {
    return {
      ok: false,
      diagnostic: [stdout, stderr].filter(Boolean).join("\n") || "Missing elite-ops JSON marker.",
    };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(markerLine.slice(STDOUT_MARKER.length)) as T,
    };
  } catch (error) {
    return {
      ok: false,
      diagnostic: error instanceof Error ? error.message : "Failed to parse elite-ops JSON output.",
    };
  }
}

function buildLatencyMeasurement(
  id: LatencyBudgetMeasurement["id"],
  label: string,
  budgetMs: number,
  observedMs: number | null,
  notes: string[] = [],
): LatencyBudgetMeasurement {
  return {
    id,
    label,
    budgetMs,
    observedMs,
    status: observedMs !== null && observedMs <= budgetMs ? "passed" : "failed",
    notes,
  };
}

function measureRetrievalPreparation(): LatencyBudgetMeasurement {
  const query = "Need governed prompt provenance, referral exception handling, and operator audit history.";
  const startedAt = performance.now();
  const vectorProcessor = new QueryProcessor([
    new LowercaseStep(),
    new StopwordStep(STOPWORDS),
  ]);
  const bm25Processor = new QueryProcessor([
    new LowercaseStep(),
    new StopwordStep(STOPWORDS),
    new SynonymStep(SYNONYMS),
  ]);
  const vectorTokens = vectorProcessor.process(query);
  const bm25Tokens = bm25Processor.process(query);
  const observedMs = performance.now() - startedAt;

  return buildLatencyMeasurement(
    "retrieval_preparation",
    "Retrieval preparation",
    LATENCY_BUDGETS.retrievalPreparationMs,
    observedMs,
    [
      `vectorTokens=${vectorTokens.length}`,
      `bm25Tokens=${bm25Tokens.length}`,
      "Measures query normalization and synonym expansion only, not full retrieval, to avoid local embedder variance.",
    ],
  );
}

function measureAsyncLatencyBudgets():
  | {
      ok: true;
      value: {
        promptAssemblyMs: number;
        firstToolExecutionMs: number;
        representativeMcpRoundTripMs: number;
      };
    }
  | {
      ok: false;
      diagnostic: string;
    } {
  const result = runTsxJsonSnippet<{
    promptAssemblyMs: number;
    firstToolExecutionMs: number;
    representativeMcpRoundTripMs: number;
  }>(`
    import { performance } from "node:perf_hooks";
    import { createPromptAssemblyBuilder } from "./src/lib/chat/prompt-runtime.ts";
    import { getToolComposition } from "./src/lib/chat/tool-composition-root.ts";
    import { createMcpStdioHarness } from "./tests/mcp/transport/stdio-harness.ts";

    (async () => {
      const { registry, executor } = getToolComposition();
      const builder = createPromptAssemblyBuilder({
        surface: "chat_stream",
        role: "ADMIN",
        currentPathname: "/admin/system",
      });
      builder.withToolManifest(
        registry.getSchemasForRole("ADMIN").map((schema) => ({
          name: schema.name,
          description: schema.description,
        })),
      );
      builder.withConversationSummary(
        "Prompt provenance, routing review, and release evidence must remain governed under change.",
      );

      const promptStartedAt = performance.now();
      await builder.build();
      const promptAssemblyMs = performance.now() - promptStartedAt;

      const toolStartedAt = performance.now();
      await executor(
        "calculator",
        { operation: "add", a: 2, b: 3 },
        { role: "ANONYMOUS", userId: "elite-ops-latency" },
      );
      const firstToolExecutionMs = performance.now() - toolStartedAt;

      const mcpStartedAt = performance.now();
      const harness = await createMcpStdioHarness("mcp/calculator-server.ts");
      await harness.callTool("calculator", { operation: "add", a: 4, b: 5 });
      await harness.close();
      const representativeMcpRoundTripMs = performance.now() - mcpStartedAt;

      process.stdout.write(
        "${STDOUT_MARKER}" + JSON.stringify({
          promptAssemblyMs,
          firstToolExecutionMs,
          representativeMcpRoundTripMs,
        }),
      );
    })().catch((error) => {
      process.stderr.write(error instanceof Error ? error.stack ?? error.message : String(error));
      process.exitCode = 1;
    });
  `);

  return result;
}

export function createArchitectureDriftEvidence(options: {
  inventoryMcpProcesses: RuntimeInventoryMcpProcessSnapshot[];
}): ArchitectureDriftEvidence {
  const toolCompositionSource = fs.readFileSync(TOOL_COMPOSITION_ROOT_PATH, "utf8");
  const releaseEvidenceSource = fs.readFileSync(RELEASE_EVIDENCE_SOURCE_PATH, "utf8");
  const processModelSource = fs.readFileSync(PROCESS_MODEL_DOC_PATH, "utf8");
  const systemArchitectureSource = fs.readFileSync(SYSTEM_ARCHITECTURE_DOC_PATH, "utf8");

  const mcpDirFiles = fs.readdirSync(path.join(PROJECT_ROOT, "mcp"))
    .filter((name) => name.endsWith(".ts"))
    .sort((left, right) => left.localeCompare(right));
  const expectedTransportEntrypoints = MCP_PROCESS_METADATA
    .map((process) => path.basename(process.entrypoint))
    .sort((left, right) => left.localeCompare(right));
  const expectedOperationsInventory = getExpectedOperationsToolInventory();
  const recordedOperationsInventory = getRecordedOperationsToolInventory()
    .slice()
    .sort((left, right) => left.localeCompare(right));
  const expectedProcesses = getExpectedProcessSnapshots();
  const observedProcesses = options.inventoryMcpProcesses
    .map(normalizeProcessSnapshot)
    .sort((left, right) => left.id.localeCompare(right.id));

  const checks: ArchitectureDriftCheck[] = [
    {
      id: "tool_registry_primary_runtime_path",
      label: "Internal ToolRegistry remains the primary runtime path",
      status:
        toolCompositionSource.includes("new ToolRegistry")
        && toolCompositionSource.includes("RbacGuardMiddleware")
        && !toolCompositionSource.includes("@modelcontextprotocol/sdk")
          ? "passed"
          : "failed",
      expected: "tool-composition-root builds the internal ToolRegistry without importing the MCP SDK.",
      observed: [
        `hasToolRegistry=${toolCompositionSource.includes("new ToolRegistry")}`,
        `hasRbacGuard=${toolCompositionSource.includes("RbacGuardMiddleware")}`,
        `importsMcpSdk=${toolCompositionSource.includes("@modelcontextprotocol/sdk")}`,
      ].join("; "),
      sources: ["src/lib/chat/tool-composition-root.ts"],
    },
    {
      id: "mcp_transport_boundary_canonical",
      label: "mcp/ stays transport-only",
      status: arrayEquals(mcpDirFiles, expectedTransportEntrypoints) ? "passed" : "failed",
      expected: formatJson(expectedTransportEntrypoints),
      observed: formatJson(mcpDirFiles),
      sources: ["mcp", "src/core/capability-catalog/mcp-process-metadata.ts"],
    },
    {
      id: "operations_inventory_matches_shared_exports",
      label: "Recorded operations MCP inventory matches shared export schemas",
      status: arrayEquals(recordedOperationsInventory, expectedOperationsInventory)
        ? "passed"
        : "failed",
      expected: formatJson(expectedOperationsInventory),
      observed: formatJson(recordedOperationsInventory),
      sources: [
        "tests/mcp/transport/operations-tool-inventory.json",
        "src/lib/capabilities/shared/embedding-tool.ts",
        "src/lib/capabilities/shared/librarian-tool.ts",
        "src/lib/capabilities/shared/prompt-tool.ts",
        "src/lib/capabilities/shared/analytics-tool.ts",
      ],
    },
    {
      id: "runtime_inventory_tracks_mcp_process_metadata",
      label: "Runtime inventory MCP processes match canonical process metadata",
      status: formatJson(observedProcesses) === formatJson(expectedProcesses) ? "passed" : "failed",
      expected: formatJson(expectedProcesses),
      observed: formatJson(observedProcesses),
      sources: ["src/lib/evals/runtime-integrity-evidence.ts", "src/core/capability-catalog/mcp-process-metadata.ts"],
    },
    {
      id: "active_docs_match_runtime_story",
      label: "Active operations docs match the governed runtime story",
      status:
        processModelSource.includes("MCP servers should stay thin and transport-focused.")
        && processModelSource.includes("npm run mcp:calculator")
        && processModelSource.includes("npm run mcp:operations")
        && systemArchitectureSource.includes("internal tool platform with MCP export")
        && systemArchitectureSource.includes("The main application orchestrates tool use through the internal `ToolRegistry`")
          ? "passed"
          : "failed",
      expected: "Process and system docs describe MCP as a thin export boundary and the internal ToolRegistry as the primary runtime.",
      observed: [
        `processModelHasThinBoundary=${processModelSource.includes("MCP servers should stay thin and transport-focused.")}`,
        `processModelHasCommands=${processModelSource.includes("npm run mcp:calculator") && processModelSource.includes("npm run mcp:operations")}`,
        `systemArchitectureHasExportStory=${systemArchitectureSource.includes("internal tool platform with MCP export")}`,
        `systemArchitectureHasToolRegistry=${systemArchitectureSource.includes("The main application orchestrates tool use through the internal \`ToolRegistry\`")}`,
      ].join("; "),
      sources: ["docs/operations/process-model.md", "docs/operations/system-architecture.md"],
    },
    {
      id: "release_evidence_promotes_elite_ops_summary",
      label: "Release evidence promotes Sprint 25 elite-ops summaries",
      status:
        releaseEvidenceSource.includes("eliteOps:")
        && releaseEvidenceSource.includes("runtimeIntegrityEvidence?.eliteOps")
          ? "passed"
          : "failed",
      expected: "release-evidence exposes a top-level eliteOps summary derived from runtime-integrity evidence.",
      observed: [
        `hasEliteOpsField=${releaseEvidenceSource.includes("eliteOps:")}`,
        `readsRuntimeEliteOps=${releaseEvidenceSource.includes("runtimeIntegrityEvidence?.eliteOps")}`,
      ].join("; "),
      sources: ["src/lib/evals/release-evidence.ts"],
    },
  ];

  const blockingReasons = checks
    .filter((check) => check.status === "failed")
    .map((check) => `${check.label} failed.`);

  return {
    status: blockingReasons.length === 0 ? "passed" : "failed",
    checks,
    blockingReasons,
    warnings: [],
  };
}

export function createRbacRegressionMatrix(): RbacRegressionMatrix {
  const { registry } = getToolComposition();
  const runtimeNamesByRole = Object.fromEntries(
    RUNTIME_MANIFEST_ROLE_ORDER.map((role) => [
      role,
      new Set(getRuntimeToolManifestForRole(registry, role).map((entry) => entry.name)),
    ]),
  ) as Record<RoleName, Set<string>>;
  const transportExports = getTransportExportsByProcess();
  const entries: RbacRegressionMatrixEntry[] = [];

  for (const expectation of CRITICAL_TOOL_EXPECTATIONS) {
    for (const role of RUNTIME_MANIFEST_ROLE_ORDER) {
      const expected = roleAllows(expectation.allowedRoles, role) ? "allow" : "deny";
      const observed = runtimeNamesByRole[role].has(expectation.toolName) ? "allow" : "deny";
      entries.push({
        surfaceKind: "tool",
        surfaceId: expectation.toolName,
        role,
        expected,
        observed,
        status: expected === observed ? "passed" : "failed",
        rationale: expectation.rationale,
        mechanisms: observed === "allow" ? ["runtime_manifest"] : [],
      });
    }
  }

  for (const expectation of CRITICAL_ROUTE_EXPECTATIONS) {
    const route = getShellRouteById(expectation.routeId);
    for (const role of RUNTIME_MANIFEST_ROLE_ORDER) {
      const snapshot = getShellRouteVisibilitySnapshot(route, { roles: [role] });
      const expected = roleAllows(expectation.allowedRoles, role) ? "allow" : "deny";
      const observed = snapshot.any ? "allow" : "deny";
      const mechanisms = Object.entries(snapshot)
        .filter(([key, value]) => key !== "any" && value)
        .map(([key]) => key)
        .sort((left, right) => left.localeCompare(right));

      entries.push({
        surfaceKind: "route",
        surfaceId: route.href,
        role,
        expected,
        observed,
        status: expected === observed ? "passed" : "failed",
        rationale: expectation.rationale,
        mechanisms,
      });
    }
  }

  for (const expectation of CRITICAL_MCP_EXPORT_EXPECTATIONS) {
    const exportedToolNames = transportExports[expectation.processId] ?? [];
    const transportPresent = exportedToolNames.includes(expectation.toolName);

    for (const role of RUNTIME_MANIFEST_ROLE_ORDER) {
      const expected = roleAllows(expectation.runtimeRoles, role) ? "allow" : "deny";
      const observed = runtimeNamesByRole[role].has(expectation.toolName) ? "allow" : "deny";
      entries.push({
        surfaceKind: "mcp_export",
        surfaceId: `${expectation.processId}:${expectation.toolName}`,
        role,
        expected,
        observed,
        status: transportPresent && expected === observed ? "passed" : "failed",
        rationale: expectation.rationale,
        mechanisms: transportPresent ? [`transport_export:${expectation.processId}`] : ["transport_export_missing"],
      });
    }
  }

  const failedEntries = entries.filter((entry) => entry.status === "failed");
  const blockingReasons = uniqueNonEmpty(
    failedEntries.map((entry) => `${entry.surfaceKind}:${entry.surfaceId}:${entry.role} expected ${entry.expected} but observed ${entry.observed}.`),
  );

  return {
    status: failedEntries.length === 0 ? "passed" : "failed",
    entries,
    summary: {
      totalEntries: entries.length,
      failedEntries: failedEntries.length,
      toolEntries: entries.filter((entry) => entry.surfaceKind === "tool").length,
      routeEntries: entries.filter((entry) => entry.surfaceKind === "route").length,
      mcpExportEntries: entries.filter((entry) => entry.surfaceKind === "mcp_export").length,
    },
    blockingReasons,
    warnings: [],
  };
}

export function createLatencyBudgetEvidence(): LatencyBudgetEvidence {
  if (cachedLatencyBudgetEvidence) {
    return cloneJson(cachedLatencyBudgetEvidence);
  }

  const measurements: LatencyBudgetMeasurement[] = [measureRetrievalPreparation()];
  const asyncMeasurements = measureAsyncLatencyBudgets();

  if (asyncMeasurements.ok) {
    measurements.push(
      buildLatencyMeasurement(
        "prompt_assembly",
        "Prompt assembly",
        LATENCY_BUDGETS.promptAssemblyMs,
        asyncMeasurements.value.promptAssemblyMs,
        ["Measures the governed ADMIN prompt assembly path with the live tool manifest."],
      ),
      buildLatencyMeasurement(
        "first_tool_execution",
        "First tool execution",
        LATENCY_BUDGETS.firstToolExecutionMs,
        asyncMeasurements.value.firstToolExecutionMs,
        ["Measures the first governed calculator execution through the composition root."],
      ),
      buildLatencyMeasurement(
        "representative_mcp_round_trip",
        "Representative MCP stdio round trip",
        LATENCY_BUDGETS.representativeMcpRoundTripMs,
        asyncMeasurements.value.representativeMcpRoundTripMs,
        ["Measures calculator MCP stdio startup, call, and teardown as the representative export path."],
      ),
    );
  } else {
    measurements.push(
      buildLatencyMeasurement(
        "prompt_assembly",
        "Prompt assembly",
        LATENCY_BUDGETS.promptAssemblyMs,
        null,
        [asyncMeasurements.diagnostic],
      ),
      buildLatencyMeasurement(
        "first_tool_execution",
        "First tool execution",
        LATENCY_BUDGETS.firstToolExecutionMs,
        null,
        [asyncMeasurements.diagnostic],
      ),
      buildLatencyMeasurement(
        "representative_mcp_round_trip",
        "Representative MCP stdio round trip",
        LATENCY_BUDGETS.representativeMcpRoundTripMs,
        null,
        [asyncMeasurements.diagnostic],
      ),
    );
  }

  const blockingReasons = measurements
    .filter((measurement) => measurement.status === "failed")
    .map((measurement) => `${measurement.label} exceeded its ${measurement.budgetMs}ms budget.`);

  const evidence: LatencyBudgetEvidence = {
    status: blockingReasons.length === 0 ? "passed" : "failed",
    measurements,
    blockingReasons,
    warnings: [
      "Budgets are intentionally generous and rely on representative local samples so the gate catches order-of-magnitude regressions rather than incidental variance.",
    ],
  };

  cachedLatencyBudgetEvidence = cloneJson(evidence);
  return evidence;
}

export function createFailureModeEvidence(): FailureModeEvidence {
  const providerPolicy = resolveProviderPolicy();
  const providerSources = [
    path.join(PROJECT_ROOT, "src/lib/chat/provider-runtime.ts"),
  ];
  const providerFallbackProbe: FailureModeProbe = {
    id: "provider_fallback_path",
    label: "Provider fallback path",
    status:
      classifyProviderError(new Error("not_found_error: elite-ops")) === "model_not_found"
      && providerPolicy.modelCandidates.length >= 2
      && providerSources.every((filePath) => fs.readFileSync(filePath, "utf8").includes('kind: "model_fallback"'))
        ? "passed"
        : "failed",
    diagnostic: `modelCandidates=${providerPolicy.modelCandidates.length}; classification=${classifyProviderError(new Error("not_found_error: elite-ops"))}`,
    expectedSignal: "Model-not-found failures classify predictably and the shared provider runtime emits model_fallback events.",
    evidenceSources: [
      "src/lib/chat/provider-policy.ts",
      "src/lib/chat/provider-runtime.ts",
    ],
  };

  const previousPrimaryKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  let envDiagnostic = "validateRequiredRuntimeConfig unexpectedly passed.";
  try {
    validateRequiredRuntimeConfig();
  } catch (error) {
    envDiagnostic = error instanceof Error ? error.message : String(error);
  } finally {
    if (previousPrimaryKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = previousPrimaryKey;
    }
  }

  const envProbe: FailureModeProbe = {
    id: "env_misconfiguration_path",
    label: "Missing key / env misconfiguration path",
    status:
      envDiagnostic.includes("ANTHROPIC_API_KEY")
      && envDiagnostic.includes("must be set to a non-empty value")
        ? "passed"
        : "failed",
    diagnostic: envDiagnostic,
    expectedSignal: "Missing Anthropic configuration fails fast with an explicit non-empty-value error.",
    evidenceSources: ["src/lib/config/env.ts", "src/lib/admin/processes.ts"],
  };

  const busyTimeout = getDbBusyTimeoutMs();
  const dbSource = fs.readFileSync(DB_INDEX_PATH, "utf8");
  const dbProbe: FailureModeProbe = {
    id: "db_busy_timeout_path",
    label: "DB busy / lock contention path",
    status:
      dbSource.includes('busy_timeout = 5000')
      && (busyTimeout === null || busyTimeout === 5000)
        ? "passed"
        : "failed",
    diagnostic: `busy_timeout=${busyTimeout ?? "unavailable"}`,
    expectedSignal: "SQLite connections advertise a 5000ms busy_timeout before surfacing SQLITE_BUSY.",
    evidenceSources: ["src/lib/db/index.ts"],
  };

  const mcpStartupResult = spawnSync(TSX_BINARY, ["mcp/does-not-exist.ts"], {
    cwd: PROJECT_ROOT,
    env: createSpawnEnv(),
    encoding: "utf8",
    timeout: 15000,
  });
  const mcpDiagnostic = [mcpStartupResult.stderr ?? "", mcpStartupResult.stdout ?? ""]
    .join("\n")
    .trim();
  const mcpProbe: FailureModeProbe = {
    id: "mcp_startup_failure_diagnostics",
    label: "MCP process startup failure diagnostics",
    status:
      mcpStartupResult.status !== 0
      && /(does-not-exist|cannot find|not found|err_module_not_found)/i.test(mcpDiagnostic)
        ? "passed"
        : "failed",
    diagnostic: mcpDiagnostic || `tsx exited with status ${mcpStartupResult.status ?? "unknown"}.`,
    expectedSignal: "A broken MCP entrypoint fails fast with an explicit missing-module diagnostic.",
    evidenceSources: ["tests/mcp/transport/stdio-harness.ts", "mcp"],
  };

  const probes = [providerFallbackProbe, envProbe, dbProbe, mcpProbe];
  const blockingReasons = probes
    .filter((probe) => probe.status === "failed")
    .map((probe) => `${probe.label} failed.`);

  return {
    status: blockingReasons.length === 0 ? "passed" : "failed",
    probes,
    blockingReasons,
    warnings: [],
  };
}

export function createEliteOpsEvidence(options: {
  inventoryMcpProcesses: RuntimeInventoryMcpProcessSnapshot[];
  now?: Date;
}): EliteOpsEvidence {
  const architectureDrift = createArchitectureDriftEvidence({
    inventoryMcpProcesses: options.inventoryMcpProcesses,
  });
  const rbacMatrix = createRbacRegressionMatrix();
  const latencyBudgets = createLatencyBudgetEvidence();
  const failureModes = createFailureModeEvidence();
  const blockingReasons = uniqueNonEmpty([
    ...architectureDrift.blockingReasons.map((reason) => `Architecture drift: ${reason}`),
    ...rbacMatrix.blockingReasons.map((reason) => `RBAC matrix: ${reason}`),
    ...latencyBudgets.blockingReasons.map((reason) => `Latency budgets: ${reason}`),
    ...failureModes.blockingReasons.map((reason) => `Failure modes: ${reason}`),
  ]);
  const warnings = uniqueNonEmpty([
    ...architectureDrift.warnings,
    ...rbacMatrix.warnings,
    ...latencyBudgets.warnings,
    ...failureModes.warnings,
  ]);

  return {
    version: 1,
    generatedAt: (options.now ?? new Date()).toISOString(),
    status: blockingReasons.length === 0 ? "passed" : "failed",
    architectureDrift,
    rbacMatrix,
    latencyBudgets,
    failureModes,
    blockingReasons,
    warnings,
  };
}
