import type { RoleName } from "@/core/entities/user";
import type { ToolCategory, ToolExecutionMode, DeferredExecutionConfig } from "@/core/tool-registry/ToolDescriptor";
import type {
  CapabilityCardKind,
  CapabilityExecutionMode,
  CapabilityFamily,
  CapabilityProgressMode,
  CapabilityDefaultSurface,
  CapabilityHistoryMode,
  CapabilityRetrySupport,
} from "@/core/entities/capability-presentation";
import type { BrowserCapabilityDescriptor } from "@/core/entities/browser-capability";
import type { JobCapabilityDefinition } from "@/lib/jobs/job-capability-types";

// ---------------------------------------------------------------------------
// Core identity — every capability has these
// ---------------------------------------------------------------------------

export interface CapabilityCoreFacet {
  /** Unique tool name — matches the Anthropic tool name exactly. */
  name: string;
  /** Human-readable label for display. */
  label: string;
  /** Tool description shown to the LLM. */
  description: string;
  /** Organizational category for the tool registry. */
  category: ToolCategory;
  /** Which roles can execute this tool. "ALL" = unrestricted. */
  roles: RoleName[] | "ALL";
}

// ---------------------------------------------------------------------------
// Runtime facet — ToolDescriptor-level execution metadata
// ---------------------------------------------------------------------------

export interface CapabilityRuntimeFacet {
  /** ToolDescriptor-level execution mode ("inline" | "deferred"). */
  executionMode?: ToolExecutionMode;
  /** Deferred execution policy metadata for queue-backed tools. */
  deferred?: DeferredExecutionConfig;
}

// ---------------------------------------------------------------------------
// Presentation facet — chat UI presentation metadata
// ---------------------------------------------------------------------------

export interface CapabilityPresentationFacet {
  family: CapabilityFamily;
  cardKind: CapabilityCardKind;
  /** Presentation-level execution mode (includes "browser" | "hybrid"). */
  executionMode: CapabilityExecutionMode;
  progressMode?: CapabilityProgressMode;
  historyMode?: CapabilityHistoryMode;
  defaultSurface?: CapabilityDefaultSurface;
  artifactKinds?: readonly string[];
  supportsRetry?: CapabilityRetrySupport;
}

// ---------------------------------------------------------------------------
// Prompt hint facet — role-directive lines injected into the system prompt
// ---------------------------------------------------------------------------

export interface CapabilityPromptHintFacet {
  /** Map of role → directive lines. Absent roles get no special directive. */
  roleDirectiveLines: Partial<Record<RoleName, readonly string[]>>;
}

// ---------------------------------------------------------------------------
// Prompt exposure facet — controls model-visible schema projection
// ---------------------------------------------------------------------------

export type CapabilityPromptExposure =
  | "default_prompt"
  | "intent_gated"
  | "operator_only"
  | "internal_only";

export interface CapabilityPromptExposureFacet {
  exposure: CapabilityPromptExposure;
  rationale?: string;
}

// ---------------------------------------------------------------------------
// MCP export intent facet
// ---------------------------------------------------------------------------

export interface CapabilityMcpExportFacet {
  /** Whether this capability should be exportable via MCP protocol. */
  exportable: true;
  /** The shared module that contains the core execution logic. */
  sharedModule: string;
  /** Human description for the MCP tool listing. */
  mcpDescription?: string;
}

// ---------------------------------------------------------------------------
// Schema facet — Sprint 20: catalog-driven schema derivation
// ---------------------------------------------------------------------------

export interface CapabilitySchemaFacet {
  /** JSON Schema for the tool's input parameters. */
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  /** Human-readable hint describing the tool's output shape. */
  outputHint?: string;
}

// ---------------------------------------------------------------------------
// Sprint 23 runtime binding facets — catalog-driven execution + validation
// ---------------------------------------------------------------------------

export type CapabilityExecutionSurface = "internal" | "mcp_export" | "shared" | "browser";

export interface CapabilityExecutorBindingFacet {
  /** Canonical tool bundle that owns the runtime registration surface. */
  bundleId: string;
  /** Canonical executor identifier resolved by the runtime binding layer. */
  executorId: string;
  /** Primary execution surface for this capability. */
  executionSurface: CapabilityExecutionSurface;
}

export interface CapabilityValidationBindingFacet {
  /** Canonical parser/validator identifier resolved by the runtime binding layer. */
  validatorId: string;
  /** Whether the binding parses strictly or sanitizes into a normalized payload. */
  mode?: "parse" | "sanitize";
}

// ---------------------------------------------------------------------------
// Local execution target facet — catalog-owned runtime overrides
// ---------------------------------------------------------------------------

export interface CapabilityLocalMcpContainerTargetFacet {
  processId: string;
  serviceName: string;
  toolName?: string;
  healthcheckToolName?: string;
  entrypoint?: string;
  label?: string;
  sharedModule?: string;
}

export interface CapabilityLocalMcpStdioTargetFacet {
  processId: string;
  toolName: string;
  entrypoint?: string;
}

export interface CapabilityLocalNativeProcessTargetFacet {
  processId: string;
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  label?: string;
  entrypoint?: string;
}

export interface CapabilityLocalRemoteServiceTargetFacet {
  serviceId: string;
  endpoint: string;
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
  timeoutMs?: number;
  bridgeExecutionContext?: boolean;
  label?: string;
}

export interface CapabilityLocalExecutionTargetsFacet {
  mcpStdio?: CapabilityLocalMcpStdioTargetFacet;
  mcpContainer?: CapabilityLocalMcpContainerTargetFacet;
  nativeProcess?: CapabilityLocalNativeProcessTargetFacet;
  remoteService?: CapabilityLocalRemoteServiceTargetFacet;
}

// ---------------------------------------------------------------------------
// The unified definition
// ---------------------------------------------------------------------------

export interface CapabilityDefinition {
  core: CapabilityCoreFacet;
  runtime: CapabilityRuntimeFacet;
  presentation: CapabilityPresentationFacet;
  /** Absent = this capability has no deferred-job surface. */
  job?: Omit<JobCapabilityDefinition, "toolName">;
  /** Absent = this capability has no browser-runtime surface. */
  browser?: Omit<BrowserCapabilityDescriptor, "capabilityId">;
  /** Absent = no special prompt directive for this tool. */
  promptHint?: CapabilityPromptHintFacet;
  /** Absent = default prompt-visible for compatibility during rollout. */
  promptExposure?: CapabilityPromptExposureFacet;
  /** Absent = no MCP export intent. */
  mcpExport?: CapabilityMcpExportFacet;
  /** Canonical catalog-owned tool schema for all capability projections. */
  schema: CapabilitySchemaFacet;
  /** Absent = capability does not participate in the catalog runtime-binding surface. */
  executorBinding?: CapabilityExecutorBindingFacet;
  /** Absent = capability does not participate in catalog-owned validation binding. */
  validationBinding?: CapabilityValidationBindingFacet;
  /** Absent = capability has no catalog-owned local execution target overrides. */
  localExecutionTargets?: CapabilityLocalExecutionTargetsFacet;
}
