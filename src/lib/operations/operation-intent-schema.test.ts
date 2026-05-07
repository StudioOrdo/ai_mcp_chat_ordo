import { describe, expect, it } from "vitest";

import {
  OperationIntentSchemaError,
  parseOperationIntentCompilerOutput,
} from "@/lib/operations/operation-intent-schema";

const validOperationIntent = {
  kind: "operation_intent",
  intentKind: "backup_create",
  operationKind: "backup_create",
  requiredRole: "ADMIN",
  riskLevel: "medium",
  confidence: 0.95,
  source: "deterministic",
  title: "Create Backup",
  summary: "Create a governed backup.",
  input: {},
  requiredCapabilities: ["create_appliance_backup"],
  requiredProviderSlots: [],
  missingInputs: [],
};

describe("operation-intent-schema", () => {
  it("accepts valid operation compiler output", () => {
    expect(parseOperationIntentCompilerOutput(validOperationIntent)).toMatchObject({
      kind: "operation_intent",
      operationKind: "backup_create",
    });
  });

  it("rejects malformed JSON", () => {
    expect(() => parseOperationIntentCompilerOutput("{not-json")).toThrow(OperationIntentSchemaError);
  });

  it("rejects unknown operation kinds", () => {
    expect(() => parseOperationIntentCompilerOutput({
      ...validOperationIntent,
      operationKind: "unknown_kind",
    })).toThrow(OperationIntentSchemaError);
  });

  it("rejects unknown risk levels", () => {
    expect(() => parseOperationIntentCompilerOutput({
      ...validOperationIntent,
      riskLevel: "catastrophic",
    })).toThrow(OperationIntentSchemaError);
  });

  it("rejects missing titles", () => {
    const { title: _title, ...withoutTitle } = validOperationIntent;
    expect(() => parseOperationIntentCompilerOutput(withoutTitle)).toThrow(OperationIntentSchemaError);
  });

  it("rejects missing operation draft input", () => {
    const { input: _input, ...withoutInput } = validOperationIntent;
    expect(() => parseOperationIntentCompilerOutput(withoutInput)).toThrow(OperationIntentSchemaError);
  });

  it("rejects invalid required roles", () => {
    expect(() => parseOperationIntentCompilerOutput({
      ...validOperationIntent,
      requiredRole: "OWNER",
    })).toThrow(OperationIntentSchemaError);
  });
});
