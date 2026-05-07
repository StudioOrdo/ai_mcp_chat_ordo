import { z } from "zod";

import {
  OPERATION_KINDS,
  OPERATION_RISK_LEVELS,
  type OperationKind,
} from "@/core/entities/operation";
import type {
  OperationIntentCompilerOutput,
} from "@/core/use-cases/operations/OperationIntent";

const ROLE_NAMES = ["ANONYMOUS", "AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"] as const;
const SOURCES = ["deterministic", "llm", "hybrid"] as const;

const confidenceSchema = z.number().min(0).max(1);
const stringArraySchema = z.array(z.string());
const objectSchema = z.record(z.string(), z.unknown());

const passThroughSchema = z.object({
  kind: z.literal("pass_through"),
  confidence: confidenceSchema,
  source: z.enum(SOURCES),
  reason: z.string().optional(),
});

const clarificationSchema = z.object({
  kind: z.literal("clarification_required"),
  confidence: confidenceSchema,
  source: z.enum(SOURCES),
  question: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  operationKind: z.enum(OPERATION_KINDS).optional(),
  riskLevel: z.enum(OPERATION_RISK_LEVELS).optional(),
  missingInputs: stringArraySchema.optional(),
});

const rejectedSchema = z.object({
  kind: z.literal("rejected"),
  confidence: confidenceSchema,
  source: z.enum(SOURCES),
  rejectedReason: z.string().trim().min(1),
  operationKind: z.enum(OPERATION_KINDS).optional(),
  requiredRole: z.enum(ROLE_NAMES).optional(),
  riskLevel: z.enum(OPERATION_RISK_LEVELS).optional(),
});

const operationIntentSchema = z.object({
  kind: z.literal("operation_intent"),
  intentKind: z.enum(OPERATION_KINDS),
  confidence: confidenceSchema,
  source: z.enum(SOURCES),
  operationKind: z.enum(OPERATION_KINDS),
  requiredRole: z.enum(ROLE_NAMES),
  riskLevel: z.enum(OPERATION_RISK_LEVELS),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  input: objectSchema,
  requiredCapabilities: stringArraySchema,
  requiredProviderSlots: stringArraySchema,
  missingInputs: stringArraySchema,
  explicitNewOperation: z.boolean().optional(),
}).superRefine((value, context) => {
  if (value.intentKind !== value.operationKind) {
    context.addIssue({
      code: "custom",
      message: "intentKind must match operationKind in Phase 04.",
      path: ["intentKind"],
    });
  }
});

export const operationIntentCompilerOutputSchema = z.discriminatedUnion("kind", [
  passThroughSchema,
  clarificationSchema,
  rejectedSchema,
  operationIntentSchema,
]);

export class OperationIntentSchemaError extends Error {
  readonly code = "OPERATION_INTENT_SCHEMA_INVALID";

  constructor(message: string, readonly details: Record<string, unknown> = {}) {
    super(message);
    this.name = "OperationIntentSchemaError";
  }
}

export function parseOperationIntentCompilerOutput(value: unknown): OperationIntentCompilerOutput {
  const decoded = typeof value === "string" ? parseJson(value) : value;
  const parsed = operationIntentCompilerOutputSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new OperationIntentSchemaError("Operation intent compiler output is invalid.", {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  return parsed.data as OperationIntentCompilerOutput;
}

export function isKnownOperationIntentKind(value: string): value is OperationKind {
  return (OPERATION_KINDS as readonly string[]).includes(value);
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new OperationIntentSchemaError("Operation intent compiler output is not valid JSON.", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
