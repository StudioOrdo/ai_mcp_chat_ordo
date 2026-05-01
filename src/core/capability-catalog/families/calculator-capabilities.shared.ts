import type { CapabilityDefinition } from "../capability-definition";

export const SHARED_CALCULATOR_CAPABILITIES = {
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
} as const satisfies Record<string, CapabilityDefinition>;
