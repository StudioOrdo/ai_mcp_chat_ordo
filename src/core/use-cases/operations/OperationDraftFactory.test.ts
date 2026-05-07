import { describe, expect, it } from "vitest";

import type { ProductBrief } from "@/core/entities/product-brief";
import type {
  OperationIntentCompilerInput,
  OperationIntentOperationOutput,
} from "@/core/use-cases/operations/OperationIntent";

import { OperationDraftFactory } from "./OperationDraftFactory";

const NOW = "2026-05-03T12:00:00.000Z";

function compilerInput(): OperationIntentCompilerInput {
  return {
    conversationId: "conv_1",
    originMessageId: "msg_1",
    userId: "usr_1",
    role: "STAFF",
    latestUserText: "make a launch page",
    latestUserContent: "make a launch page",
    routingSnapshot: {
      lane: "development",
      confidence: 0.9,
      recommendedNextStep: null,
      detectedNeedSummary: "test",
      lastAnalyzedAt: NOW,
    },
    attachments: [],
    taskOriginHandoff: null,
    mediaContinuityHandoff: null,
    effectiveToolManifestVersion: "test",
    availableToolNames: [],
    providerCapabilitySummary: {},
    gateSnapshot: { generatedAt: NOW, gates: [] },
    operationGrounding: null,
    now: NOW,
  };
}

function brief(overrides: Partial<ProductBrief> = {}): ProductBrief {
  return {
    id: "brief_1",
    schemaVersion: 1,
    title: "Factory launch page",
    topic: "Solopreneur launch",
    assetKinds: ["chart"],
    qaCriteria: ["accuracy"],
    targetChannels: ["blog"],
    executionPreferences: {
      autoRetryOnFailure: true,
      parallelizeAssets: true,
    },
    createdAt: NOW,
    createdBy: "usr_1",
    ...overrides,
  };
}

function factoryIntent(input: Record<string, unknown>): OperationIntentOperationOutput {
  return {
    kind: "operation_intent",
    intentKind: "factory_work_order",
    operationKind: "factory_work_order",
    requiredRole: "STAFF",
    riskLevel: "medium",
    title: "Produce launch page",
    summary: "Create a factory work order.",
    confidence: 0.9,
    source: "deterministic",
    input,
    requiredCapabilities: [],
    requiredProviderSlots: [],
    missingInputs: [],
  };
}

describe("OperationDraftFactory factory work orders", () => {
  it("emits typed create actions for complete ProductBriefs", () => {
    const factory = new OperationDraftFactory((prefix) => `${prefix}_1`);
    const result = factory.build({
      compilerInput: compilerInput(),
      intent: factoryIntent({ brief: brief(), previousWorkOrderIds: [] }),
      blockingGates: [],
    });

    expect(result.operation.status).toBe("draft");
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      actionType: "factory.work_order.create",
      enabled: true,
      payloadSchemaKey: "factory.work_order.create",
    });
  });

  it("blocks incomplete factory briefs and avoids placeholder payload schemas", () => {
    const factory = new OperationDraftFactory((prefix) => `${prefix}_1`);
    const result = factory.build({
      compilerInput: compilerInput(),
      intent: factoryIntent({ brief: { ...brief(), title: "" } }),
      blockingGates: [],
    });

    expect(result.operation.status).toBe("blocked");
    expect(result.operation.error).toMatchObject({ code: "FACTORY_PRODUCT_BRIEF_REQUIRED" });
    expect(result.actions[0]).toMatchObject({
      actionType: "factory.work_order.create",
      enabled: false,
      payloadSchemaKey: "factory.work_order.create",
    });
    expect(result.actions[0]?.payloadSchemaKey).not.toBe("none");
  });

  it("emits help flow actions with role and query payloads", () => {
    const factory = new OperationDraftFactory((prefix) => `${prefix}_1`);
    const result = factory.build({
      compilerInput: compilerInput(),
      intent: {
        kind: "operation_intent",
        intentKind: "help_flow",
        operationKind: "help_flow",
        requiredRole: "STAFF",
        riskLevel: "info",
        title: "Open Help",
        summary: "Open governed help.",
        confidence: 1,
        source: "deterministic",
        input: { requestedText: "backup help" },
        requiredCapabilities: [],
        requiredProviderSlots: [],
        missingInputs: [],
      },
      blockingGates: [],
    });

    expect(result.actions.map((action) => action.actionType)).toContain("help.search");
    expect(result.actions[0]).toMatchObject({
      enabled: true,
      payload: expect.objectContaining({ role: "STAFF", query: "backup help" }),
    });
  });

  it("emits onboarding flow actions with role-aware payloads", () => {
    const factory = new OperationDraftFactory((prefix) => `${prefix}_1`);
    const result = factory.build({
      compilerInput: compilerInput(),
      intent: {
        kind: "operation_intent",
        intentKind: "onboarding_flow",
        operationKind: "onboarding_flow",
        requiredRole: "STAFF",
        riskLevel: "info",
        title: "Start onboarding",
        summary: "Start onboarding.",
        confidence: 1,
        source: "deterministic",
        input: {},
        requiredCapabilities: [],
        requiredProviderSlots: [],
        missingInputs: [],
      },
      blockingGates: [],
    });

    expect(result.actions.map((action) => action.actionType)).toContain("onboarding.start");
    expect(result.actions[0]).toMatchObject({
      enabled: true,
      payload: expect.objectContaining({ role: "STAFF", pathId: "staff-operator" }),
    });
  });
});
