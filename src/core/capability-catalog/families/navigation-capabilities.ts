import type { CapabilityDefinition } from "../capability-definition";

export const NAVIGATION_CAPABILITIES = {
  get_current_page: {
    core: {
      name: "get_current_page",
      label: "Get Current Page",
      description:
        "Return authoritative information about the page the user is currently viewing.",
      category: "ui",
      roles: "ALL",
    },
    schema: {
      inputSchema: {
        type: "object",
        properties: {
          pathname: { type: "string", description: "Optional pathname override when trusted page context is unavailable." },
        },
      },
      outputHint: "Returns page title, pathname, and metadata",
    },
    executorBinding: {
      bundleId: "navigation",
      executorId: "get_current_page",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "get_current_page",
      mode: "parse",
    },
    runtime: {},
    promptExposure: {
      exposure: "intent_gated",
      rationale: "Page inspection should appear only when the user asks for navigation or current-page context.",
    },
    presentation: {
      family: "system",
      cardKind: "fallback",
      executionMode: "inline",
    },
  },

  inspect_runtime_context: {
    core: {
      name: "inspect_runtime_context",
      label: "Inspect Runtime Context",
      description:
        "Inspect the current role-scoped runtime context for truthful meta answers about available capabilities.",
      category: "system",
      roles: "ALL",
    },
    schema: {
      inputSchema: {
        type: "object",
        properties: {
          includeTools: {
            type: "boolean",
            description: "Set to false to inspect current page context without returning the role-scoped tool manifest.",
          },
          includePrompt: {
            type: "boolean",
            description: "Set to true to include the effective prompt runtime result for the current surface when it is available.",
          },
        },
      },
      outputHint: "Returns role-scoped runtime context with optional tool manifest and prompt result",
    },
    executorBinding: {
      bundleId: "navigation",
      executorId: "inspect_runtime_context",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "inspect_runtime_context",
      mode: "parse",
    },
    runtime: {},
    promptExposure: {
      exposure: "intent_gated",
      rationale: "Runtime context is diagnostic metadata and should not be part of the default model prompt.",
    },
    presentation: {
      family: "system",
      cardKind: "fallback",
      executionMode: "inline",
    },
  },

  list_available_pages: {
    core: {
      name: "list_available_pages",
      label: "List Available Pages",
      description: "List all pages the current user can access based on their role.",
      category: "ui",
      roles: "ALL",
    },
    schema: {
      inputSchema: {
        type: "object",
        properties: {},
      },
      outputHint: "Returns the internal routes visible to the current role.",
    },
    executorBinding: {
      bundleId: "navigation",
      executorId: "list_available_pages",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "list_available_pages",
      mode: "parse",
    },
    runtime: {},
    promptExposure: {
      exposure: "intent_gated",
      rationale: "Page listing should appear only for navigation intent.",
    },
    presentation: {
      family: "system",
      cardKind: "fallback",
      executionMode: "inline",
    },
  },

  navigate_to_page: {
    core: {
      name: "navigate_to_page",
      label: "Navigate to Page",
      description:
        "Navigate the user to a validated page. Dispatches the destination to the client router.",
      category: "ui",
      roles: "ALL",
    },
    schema: {
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Destination pathname, e.g. /admin/users." },
        },
        required: ["path"],
      },
      outputHint: "Returns navigation confirmation",
    },
    executorBinding: {
      bundleId: "navigation",
      executorId: "navigate_to_page",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "navigate_to_page",
      mode: "parse",
    },
    runtime: {},
    promptExposure: {
      exposure: "intent_gated",
      rationale: "Navigation should be offered only when the user asks to move to another surface.",
    },
    presentation: {
      family: "system",
      cardKind: "fallback",
      executionMode: "inline",
    },
  },

  admin_search: {
    core: {
      name: "admin_search",
      label: "Admin Search",
      description:
        "Search across users, conversations, leads, and referrals for administrative lookups.",
      category: "system",
      roles: ["ADMIN"],
    },
    schema: {
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (minimum 2 characters).",
          },
          entityTypes: {
            type: "array",
            items: { type: "string" },
            description: "Optional filter to search only specific entity types. Valid values: user, lead, consultation, deal, training, conversation, job, prompt, journal.",
          },
        },
        required: ["query"],
      },
      outputHint: "Returns matching entities with type, name, and metadata",
    },
    executorBinding: {
      bundleId: "navigation",
      executorId: "admin_search",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "admin_search",
      mode: "sanitize",
    },
    localExecutionTargets: {
      mcpStdio: {
        processId: "operations",
        toolName: "admin_search",
      },
    },
    mcpExport: {
      exportable: true,
      sharedModule: "src/lib/capabilities/shared/admin-intelligence-tool",
      mcpDescription:
        "Shared admin entity-search logic exported through the operations MCP sidecar.",
    },
    runtime: {},
    promptExposure: {
      exposure: "operator_only",
      rationale: "Administrative entity search is useful for operators but too broad for default chat prompts.",
    },
    presentation: {
      family: "search",
      cardKind: "search_result",
      executionMode: "inline",
    },
  },
} as const satisfies Record<string, CapabilityDefinition>;
