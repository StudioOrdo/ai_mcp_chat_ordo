import { describe, expect, it } from "vitest";

import { OperationIntentPolicy } from "@/core/use-cases/operations/OperationIntentPolicy";

const policy = new OperationIntentPolicy();

describe("OperationIntentPolicy", () => {
  it("authorizes operation kinds through OperationKindRegistry", () => {
    expect(policy.authorizeKind("backup_create", "ADMIN")).toEqual({ allowed: true });
    expect(policy.authorizeKind("backup_create", "AUTHENTICATED")).toMatchObject({
      allowed: false,
      message: expect.stringContaining("ADMIN"),
    });
  });

  it("turns unavailable required capabilities into serializable gate facts", () => {
    expect(policy.findMissingCapabilities({
      kind: "operation_intent",
      intentKind: "backup_create",
      operationKind: "backup_create",
      requiredRole: "ADMIN",
      riskLevel: "medium",
      confidence: 0.9,
      title: "Create Backup",
      summary: "Create a backup.",
      input: {},
      requiredCapabilities: ["create_appliance_backup"],
      requiredProviderSlots: [],
      missingInputs: [],
      source: "deterministic",
    }, [])).toEqual([
      expect.objectContaining({
        id: "tool:create_appliance_backup",
        state: "blocked",
        affectedOperationKinds: ["backup_create"],
      }),
    ]);
  });

  it("turns missing required provider slots into media workflow gate facts", () => {
    const gates = policy.findMissingProviderSlots({
      kind: "operation_intent",
      intentKind: "media_workflow",
      operationKind: "media_workflow",
      requiredRole: "AUTHENTICATED",
      riskLevel: "medium",
      confidence: 0.9,
      title: "Create Media Workflow",
      summary: "Create media.",
      input: {},
      requiredCapabilities: ["compose_media"],
      requiredProviderSlots: ["tts"],
      missingInputs: [],
      source: "deterministic",
    }, {
      providerBackedTools: [
        {
          name: "generate_audio",
          slot: "tts",
          state: "missing_key",
          provider: "openai",
        },
      ],
    });

    expect(gates).toEqual([
      expect.objectContaining({
        id: "provider:tts",
        state: "blocked",
        source: "provider_capability",
        affectedOperationKinds: ["media_workflow"],
        affectedCapabilities: ["generate_audio"],
        remediation: expect.stringContaining("provider key"),
      }),
    ]);
  });

  it("does not block provider slots when a matching provider-backed tool is available", () => {
    expect(policy.findMissingProviderSlots({
      kind: "operation_intent",
      intentKind: "media_workflow",
      operationKind: "media_workflow",
      requiredRole: "AUTHENTICATED",
      riskLevel: "medium",
      confidence: 0.9,
      title: "Create Media Workflow",
      summary: "Create media.",
      input: {},
      requiredCapabilities: ["compose_media"],
      requiredProviderSlots: ["tts"],
      missingInputs: [],
      source: "deterministic",
    }, {
      providerBackedTools: [
        {
          name: "generate_audio",
          slot: "tts",
          state: "available",
          provider: "openai",
        },
      ],
    })).toEqual([]);
  });

  it("matches blocking gates by operation kind or capability", () => {
    const gates = policy.findBlockingGates({
      kind: "operation_intent",
      intentKind: "restore_execute",
      operationKind: "restore_execute",
      requiredRole: "ADMIN",
      riskLevel: "destructive",
      confidence: 0.95,
      title: "Restore",
      summary: "Restore.",
      input: { snapshotId: "backup_123456789abc" },
      requiredCapabilities: ["execute_appliance_restore"],
      requiredProviderSlots: [],
      missingInputs: [],
      source: "deterministic",
    }, {
      generatedAt: "2026-05-03T00:00:00.000Z",
      gates: [
        {
          id: "resource:data-volume",
          state: "blocked",
          summary: "Disk is full.",
          affectedOperationKinds: ["restore_execute"],
        },
        {
          id: "provider:image",
          state: "blocked",
          summary: "Image provider missing.",
          affectedOperationKinds: ["media_workflow"],
        },
      ],
    });

    expect(gates.map((gate) => gate.id)).toEqual(["resource:data-volume"]);
  });

  it("passes through low-confidence non-destructive intents but clarifies destructive ones", () => {
    expect(policy.shouldPassThroughLowConfidence({
      kind: "operation_intent",
      intentKind: "backup_create",
      operationKind: "backup_create",
      requiredRole: "ADMIN",
      riskLevel: "medium",
      confidence: 0.4,
      title: "Create Backup",
      summary: "Maybe backup.",
      input: {},
      requiredCapabilities: [],
      requiredProviderSlots: [],
      missingInputs: [],
      source: "llm",
    })).toBe(true);

    expect(policy.shouldClarifyLowConfidenceDestructive({
      kind: "operation_intent",
      intentKind: "restore_execute",
      operationKind: "restore_execute",
      requiredRole: "ADMIN",
      riskLevel: "destructive",
      confidence: 0.7,
      title: "Restore",
      summary: "Maybe restore.",
      input: { snapshotId: "backup_123456789abc" },
      requiredCapabilities: [],
      requiredProviderSlots: [],
      missingInputs: [],
      source: "llm",
    })).toBe(true);
  });
});
