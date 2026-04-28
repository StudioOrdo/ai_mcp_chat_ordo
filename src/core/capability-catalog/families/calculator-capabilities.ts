import type { CapabilityDefinition } from "../capability-definition";
import { CATALOG_INPUT_SCHEMAS } from "../catalog-input-schemas";

export const CALCULATOR_CAPABILITIES = {
  calculator: {
    core: {
      name: "calculator",
      label: "Calculator",
      description: "Performs arithmetic. Mandatory for every math calculation.",
      category: "math",
      roles: "ALL",
    },
    schema: {
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["add", "subtract", "multiply", "divide"],
          },
          a: { type: "number" },
          b: { type: "number" },
        },
        required: ["operation", "a", "b"],
      },
      outputHint: "Returns the arithmetic result for the requested operation.",
    },
    executorBinding: {
      bundleId: "calculator",
      executorId: "calculator",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "calculator",
      mode: "parse",
    },
    runtime: {},
    presentation: {
      family: "system",
      cardKind: "fallback",
      executionMode: "inline",
    },
  },

  generate_chart: {
    core: {
      name: "generate_chart",
      label: "Generate Chart",
      description:
        "Generate a visual Mermaid.js chart. Prefer the structured spec for common chart families like flowcharts, pie charts, quadrants, xy charts, and mindmaps.",
      category: "content",
      roles: "ALL",
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.generate_chart,
    },
    runtime: {},
    executorBinding: {
      bundleId: "media",
      executorId: "generate_chart",
      executionSurface: "browser",
    },
    validationBinding: {
      validatorId: "generate_chart",
      mode: "parse",
    },
    presentation: {
      family: "artifact",
      cardKind: "artifact_viewer",
      executionMode: "browser",
      progressMode: "single",
      artifactKinds: ["chart"],
    },
    browser: {
      runtimeKind: "worker_only",
      moduleId: "mermaid-renderer-runtime",
      supportedAssetKinds: ["chart"],
      fallbackPolicy: "fail",
      recoveryPolicy: "fail_interrupted",
      maxConcurrentExecutions: 4,
    },
  },

  generate_graph: {
    core: {
      name: "generate_graph",
      label: "Generate Graph",
      description:
        "Generate a quantitative graph or data table for time-series, comparisons, distributions, or trend visualizations.",
      category: "content",
      roles: "ALL",
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.generate_graph,
    },
    runtime: {},
    executorBinding: {
      bundleId: "media",
      executorId: "generate_graph",
      executionSurface: "browser",
    },
    validationBinding: {
      validatorId: "generate_graph",
      mode: "parse",
    },
    presentation: {
      family: "artifact",
      cardKind: "artifact_viewer",
      executionMode: "browser",
      progressMode: "single",
      artifactKinds: ["graph"],
    },
    browser: {
      runtimeKind: "worker_only",
      moduleId: "graph-renderer-runtime",
      supportedAssetKinds: ["graph"],
      fallbackPolicy: "fail",
      recoveryPolicy: "fail_interrupted",
      maxConcurrentExecutions: 4,
    },
  },

  generate_audio: {
    core: {
      name: "generate_audio",
      label: "Generate Audio",
      description: "Generate in-chat audio player.",
      category: "content",
      roles: "ALL",
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.generate_audio,
    },
    runtime: {},
    executorBinding: {
      bundleId: "media",
      executorId: "generate_audio",
      executionSurface: "shared",
    },
    validationBinding: {
      validatorId: "generate_audio",
      mode: "parse",
    },
    presentation: {
      family: "artifact",
      cardKind: "artifact_viewer",
      executionMode: "browser",
      progressMode: "single",
      artifactKinds: ["audio"],
    },
    browser: {
      runtimeKind: "worker_only",
      moduleId: "audio-player-runtime",
      supportedAssetKinds: ["audio"],
      fallbackPolicy: "server",
      recoveryPolicy: "fallback_to_server",
      maxConcurrentExecutions: 2,
    },
  },
} as const satisfies Record<string, CapabilityDefinition>;