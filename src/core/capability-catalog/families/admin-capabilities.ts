import type { CapabilityDefinition } from "../capability-definition";
import { CATALOG_INPUT_SCHEMAS } from "../catalog-input-schemas";
import type { JobProgressPhaseDefinition } from "@/lib/jobs/job-capability-types";
import { ADMIN_ROLES, MANUAL_ONLY_RETRY } from "./shared";

const PRODUCE_PRODUCT_PROGRESS_PHASES = [
  { key: "research", label: "Researching brief", baselinePercent: 5 },
  { key: "draft", label: "Drafting core content", baselinePercent: 20 },
  { key: "asset_generation_image_1", label: "Generating assets", baselinePercent: 40 },
  { key: "composition", label: "Composing release package", baselinePercent: 65 },
  { key: "qa_asset", label: "Reviewing asset QA", baselinePercent: 78 },
  { key: "qa_page", label: "Reviewing composition QA", baselinePercent: 86 },
  { key: "qa_resolution", label: "Resolving QA status", baselinePercent: 93 },
  { key: "release", label: "Publishing release", baselinePercent: 98 },
] as const satisfies readonly JobProgressPhaseDefinition[];

export const ADMIN_PILOT_CAPABILITIES = {
  admin_web_search: {
    core: {
      name: "admin_web_search",
      label: "Admin Web Search",
      description:
        "Search the live web using OpenAI and return a sourced answer with citations. Use allowed_domains to target specific sites (e.g. en.wikipedia.org for Wikipedia searches). Admin only.",
      category: "content",
      roles: ["ADMIN"],
    },
    runtime: {
      executionMode: "deferred",
      deferred: {
        retryable: true,
      },
    },
    presentation: {
      family: "search",
      cardKind: "search_result",
      executionMode: "deferred",
    },
    promptHint: {
      roleDirectiveLines: {
        ADMIN: [
          "ADMIN-ONLY TOOL — Web Search:",
          "- **admin_web_search**: Search the live web and return a sourced answer with citations. Use allowed_domains to target specific sites (e.g., allowed_domains=['en.wikipedia.org'] for Wikipedia research). You MUST call this tool directly when the admin asks you to search the web.",
        ],
      },
    },
    schema: {
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query (max 2000 characters).",
          },
          allowed_domains: {
            type: "array",
            description: "Optional list of domains to restrict search results to (e.g. ['en.wikipedia.org']).",
            items: { type: "string" },
          },
          model: {
            type: "string",
            description: "OpenAI model to use (default: gpt-5). Must support the web_search tool.",
          },
        },
        required: ["query"],
      },
      outputHint: "Returns sourced answer with citations",
    },
    executorBinding: {
      bundleId: "admin",
      executorId: "admin_web_search",
      executionSurface: "shared",
    },
    validationBinding: {
      validatorId: "admin_web_search",
      mode: "sanitize",
    },
    localExecutionTargets: {
      mcpStdio: {
        processId: "admin-web-search",
        toolName: "admin_web_search",
      },
      mcpContainer: {
        processId: "admin-web-search",
        serviceName: "admin-web-search-mcp",
        toolName: "admin_web_search",
        healthcheckToolName: "admin_web_search",
      },
    },
    mcpExport: {
      exportable: true,
      sharedModule: "src/lib/capabilities/shared/web-search-tool",
      mcpDescription:
        "Core web search execution logic is shared between the app tool and the MCP export layer.",
    },
    job: {
      family: "system",
      label: "Admin Web Search",
      description: "Perform an administrative web search and store the results.",
      executionPrincipal: "system_worker",
      executionAllowedRoles: ["ADMIN"],
      retryPolicy: {
        mode: "automatic",
        maxAttempts: 2,
        backoffStrategy: "fixed",
        baseDelayMs: 2_000,
      },
      recoveryMode: "rerun",
      resultRetention: "retain",
      artifactPolicy: { mode: "open_or_download" },
      initiatorRoles: ["ADMIN"],
      ownerViewerRoles: ["ADMIN"],
      ownerActionRoles: ["ADMIN"],
      globalViewerRoles: ["ADMIN"],
      globalActionRoles: ["ADMIN"],
      defaultSurface: "global",
    },
  },
} as const satisfies Record<string, CapabilityDefinition>;

export const ADMIN_OPERATIONS_CAPABILITIES = {
  produce_product: {
    core: {
      name: "produce_product",
      label: "Produce Product",
      description:
        "Run the factory orchestration pipeline from validated brief through release persistence.",
      category: "content",
      roles: ["ADMIN"],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.produce_product,
      outputHint:
        "Returns workOrderId, releaseId, compositionId, and persisted output ids for the completed factory run.",
    },
    runtime: {
      executionMode: "deferred",
      deferred: {
        dedupeStrategy: "per-conversation-payload",
        retryable: true,
        notificationPolicy: "completion-and-failure",
      },
    },
    executorBinding: {
      bundleId: "admin",
      executorId: "produce_product",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "produce_product",
      mode: "parse",
    },
    presentation: {
      family: "editorial",
      cardKind: "editorial_workflow",
      executionMode: "deferred",
      progressMode: "phased",
      artifactKinds: ["image", "chart", "graph", "audio", "video"],
    },
    job: {
      family: "editorial",
      label: "Produce Product",
      description:
        "Run the factory orchestration pipeline from validated brief through release persistence.",
      executionPrincipal: "system_worker",
      executionAllowedRoles: ADMIN_ROLES,
      retryPolicy: MANUAL_ONLY_RETRY,
      recoveryMode: "rerun",
      resultRetention: "retain",
      artifactPolicy: { mode: "open_artifact" },
      initiatorRoles: ADMIN_ROLES,
      ownerViewerRoles: ADMIN_ROLES,
      ownerActionRoles: ADMIN_ROLES,
      globalViewerRoles: ADMIN_ROLES,
      globalActionRoles: ADMIN_ROLES,
      defaultSurface: "global",
      progressPhases: PRODUCE_PRODUCT_PROGRESS_PHASES,
    },
  },
  admin_prioritize_leads: {
    core: {
      name: "admin_prioritize_leads",
      label: "Admin Prioritize Leads",
      description:
        "Retrieve and prioritize the current lead queue for administrative triage and follow-up.",
      category: "system",
      roles: ["ADMIN"],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.admin_prioritize_leads,
      outputHint: "Returns prioritized lead list with scores and recommended actions",
    },
    runtime: {},
    executorBinding: {
      bundleId: "admin",
      executorId: "admin_prioritize_leads",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "admin_prioritize_leads",
      mode: "parse",
    },
    localExecutionTargets: {
      mcpStdio: {
        processId: "operations",
        toolName: "admin_prioritize_leads",
      },
    },
    presentation: {
      family: "system",
      cardKind: "fallback",
      executionMode: "inline",
    },
    promptHint: {
      roleDirectiveLines: {
        ADMIN: [
          "- **admin_prioritize_leads**: Rank submitted leads that need founder attention and return the next revenue action. Use this first when the admin asks what to do first today, which lead matters most, or who needs founder follow-up now.",
        ],
      },
    },
    mcpExport: {
      exportable: true,
      sharedModule: "src/lib/capabilities/shared/admin-intelligence-tool",
      mcpDescription:
        "Shared admin lead-prioritization logic exported through the operations MCP sidecar.",
    },
  },

  admin_prioritize_offer: {
    core: {
      name: "admin_prioritize_offer",
      label: "Admin Prioritize Offer",
      description:
        "Analyze a lead's profile and recommend a tailored service offer from the available packages.",
      category: "system",
      roles: ["ADMIN"],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.admin_prioritize_offer,
    },
    runtime: {},
    executorBinding: {
      bundleId: "admin",
      executorId: "admin_prioritize_offer",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "admin_prioritize_offer",
      mode: "parse",
    },
    localExecutionTargets: {
      mcpStdio: {
        processId: "operations",
        toolName: "admin_prioritize_offer",
      },
    },
    presentation: {
      family: "system",
      cardKind: "fallback",
      executionMode: "inline",
    },
    promptHint: {
      roleDirectiveLines: {
        ADMIN: [
          "- **admin_prioritize_offer**: Choose the single offer or message that should be pushed first based on current funnel, anonymous-demand, and lead-queue signals. Use this first when the admin asks what to sell, what offer to push, or which message should drive revenue today.",
        ],
      },
    },
    mcpExport: {
      exportable: true,
      sharedModule: "src/lib/capabilities/shared/admin-intelligence-tool",
      mcpDescription:
        "Shared admin offer-prioritization logic exported through the operations MCP sidecar.",
    },
  },

  admin_triage_routing_risk: {
    core: {
      name: "admin_triage_routing_risk",
      label: "Admin Triage Routing Risk",
      description:
        "Analyze routing risk signals and recommend triage actions for conversations with uncertain intent.",
      category: "system",
      roles: ["ADMIN"],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.admin_triage_routing_risk,
    },
    runtime: {},
    executorBinding: {
      bundleId: "admin",
      executorId: "admin_triage_routing_risk",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "admin_triage_routing_risk",
      mode: "parse",
    },
    localExecutionTargets: {
      mcpStdio: {
        processId: "operations",
        toolName: "admin_triage_routing_risk",
      },
    },
    presentation: {
      family: "system",
      cardKind: "fallback",
      executionMode: "inline",
    },
    promptHint: {
      roleDirectiveLines: {
        ADMIN: [
          "- **admin_triage_routing_risk**: Identify the conversations most likely to hurt customer outcome because of routing uncertainty or overdue follow-up. Use this first when the admin asks about service risk, routing risk, or which customers need intervention now.",
        ],
      },
    },
      mcpExport: {
      exportable: true,
      sharedModule: "src/lib/capabilities/shared/admin-intelligence-tool",
      mcpDescription:
        "Shared admin routing-risk triage logic exported through the operations MCP sidecar.",
    },
  },

  inspect_runtime_logs: {
    core: {
      name: "inspect_runtime_logs",
      label: "Inspect Runtime Logs",
      description:
        "Inspect system runtime logs for debugging issues with deferred jobs, MCP processes, and remote services. Output should be summarized as a Markdown report so the admin can copy it to GitHub if needed.",
      category: "system",
      roles: ["ADMIN"],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.inspect_runtime_logs,
      outputHint: "Returns a list of parsed JSON log entries matching the criteria.",
    },
    runtime: {},
    executorBinding: {
      bundleId: "admin",
      executorId: "inspect_runtime_logs",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "inspect_runtime_logs",
      mode: "parse",
    },
    localExecutionTargets: {
      mcpStdio: {
        processId: "operations",
        toolName: "inspect_runtime_logs",
      },
    },
    presentation: {
      family: "system",
      cardKind: "fallback",
      executionMode: "inline",
    },
    promptHint: {
      roleDirectiveLines: {
        ADMIN: [
          "- **inspect_runtime_logs**: Query local system JSONL logs (.runtime-logs directory). Use this when debugging failures, looking for crash context, or inspecting background job/MCP logs. Summarize your findings as a Markdown report suitable for GitHub issues.",
        ],
      },
    },
    mcpExport: {
      exportable: true,
      sharedModule: "src/lib/capabilities/shared/admin-intelligence-tool",
      mcpDescription:
        "Log inspection tool exported through the operations MCP sidecar.",
    },
  },
} as const satisfies Record<string, CapabilityDefinition>;