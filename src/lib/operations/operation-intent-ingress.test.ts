import { describe, expect, it, vi } from "vitest";

import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type { OperationIntentCompilerInput } from "@/core/use-cases/operations/OperationIntent";
import { DeterministicOperationIntentCompiler } from "@/lib/operations/operation-intent-compiler";
import { OperationIntentIngress } from "@/lib/operations/operation-intent-ingress";

function compilerInput(latestUserText: string): OperationIntentCompilerInput {
  return {
    conversationId: "conv_1",
    originMessageId: "msg_user_1",
    userId: "usr_admin",
    role: "ADMIN",
    latestUserText,
    latestUserContent: latestUserText,
    routingSnapshot: createConversationRoutingSnapshot(),
    attachments: [],
    taskOriginHandoff: null,
    mediaContinuityHandoff: null,
    effectiveToolManifestVersion: "manifest_1",
    availableToolNames: [],
    providerCapabilitySummary: {},
    gateSnapshot: {
      generatedAt: "2026-05-03T00:00:00.000Z",
      gates: [],
    },
    now: "2026-05-03T00:00:00.000Z",
  };
}

describe("OperationIntentIngress", () => {
  it("lets pass-through turns continue to normal chat", async () => {
    const router = { route: vi.fn() };
    const ingress = new OperationIntentIngress({
      compiler: new DeterministicOperationIntentCompiler(),
      router,
    });

    const result = await ingress.handle(compilerInput("hello there"));

    expect(result.handled).toBe(false);
    expect(result.routeResult.kind).toBe("pass_through");
    expect(router.route).not.toHaveBeenCalled();
  });

  it("rejects invalid compiler output safely before routing", async () => {
    const router = { route: vi.fn() };
    const ingress = new OperationIntentIngress({
      compiler: { compile: () => ({ kind: "operation_intent", operationKind: "not_registered" }) },
      router,
    });

    const result = await ingress.handle(compilerInput("create a backup"));

    expect(result.handled).toBe(true);
    expect(result.replyText).toContain("could not validate");
    expect(router.route).not.toHaveBeenCalled();
  });

  it("projects handled route results through the projection adapter", async () => {
    const ingress = new OperationIntentIngress({
      compiler: new DeterministicOperationIntentCompiler(),
      router: {
        route: vi.fn(async () => ({
          kind: "clarification_response" as const,
          message: "Which backup?",
          compilerOutput: {
            kind: "clarification_required" as const,
            confidence: 0.9,
            source: "deterministic" as const,
            question: "Which backup?",
            reason: "missing",
          },
        })),
      },
      project: () => "projected response",
    });

    const result = await ingress.handle(compilerInput("restore the appliance"));

    expect(result.handled).toBe(true);
    expect(result.replyText).toBe("projected response");
  });
});

describe("DeterministicOperationIntentCompiler", () => {
  const compiler = new DeterministicOperationIntentCompiler();

  it("recognizes create backup", () => {
    expect(compiler.compile(compilerInput("create an appliance backup now"))).toMatchObject({
      kind: "operation_intent",
      operationKind: "backup_create",
    });
  });

  it("recognizes restore from a full backup id", () => {
    expect(compiler.compile(compilerInput("restore from backup_123456789abc"))).toMatchObject({
      kind: "operation_intent",
      operationKind: "restore_execute",
      input: { snapshotId: "backup_123456789abc" },
    });
  });

  it("clarifies ambiguous short backup ids", () => {
    expect(compiler.compile(compilerInput("restore from backup_12345678"))).toMatchObject({
      kind: "clarification_required",
      reason: "restore_ambiguous_backup_id",
    });
  });

  it("clarifies missing backup ids for restore", () => {
    expect(compiler.compile(compilerInput("restore the appliance"))).toMatchObject({
      kind: "clarification_required",
      reason: "restore_missing_backup_id",
    });
  });

  it("clarifies video workflow requests that do not include executable media inputs", () => {
    expect(compiler.compile(compilerInput("make a video from this chart and narration"))).toMatchObject({
      kind: "clarification_required",
      operationKind: "media_workflow",
      reason: "media_workflow_needs_supported_template_inputs",
      missingInputs: ["visualAssetId", "audioText"],
    });
  });

  it("recognizes executable audio-only media workflow requests", () => {
    expect(compiler.compile(compilerInput("generate audio narration about appliance backups"))).toMatchObject({
      kind: "operation_intent",
      operationKind: "media_workflow",
      input: {
        requestedDeliverable: "audio",
        template: "generated_audio",
      },
      requiredCapabilities: ["generate_audio"],
      requiredProviderSlots: ["tts"],
    });
  });

  it("recognizes factory work orders", () => {
    expect(compiler.compile(compilerInput("implement a FastAPI calculator with frontend and Docker"))).toMatchObject({
      kind: "operation_intent",
      operationKind: "factory_work_order",
    });
  });

  it("recognizes onboarding and help flows", () => {
    expect(compiler.compile(compilerInput("onboard me as the first admin"))).toMatchObject({
      kind: "operation_intent",
      operationKind: "onboarding_flow",
    });
    expect(compiler.compile(compilerInput("show me Ordo documentation for backups"))).toMatchObject({
      kind: "operation_intent",
      operationKind: "help_flow",
    });
  });

  it("recognizes publish intents without treating post as a noun as publish", () => {
    expect(compiler.compile(compilerInput("publish draft post_1"))).toMatchObject({
      kind: "operation_intent",
      operationKind: "content_publish",
    });
    expect(compiler.compile(compilerInput("draft a post about the queue"))).toMatchObject({
      kind: "pass_through",
    });
  });

  it("does not treat generic help wording as Ordo system help", () => {
    expect(compiler.compile(compilerInput("Help my company redesign an internal workflow."))).toMatchObject({
      kind: "pass_through",
    });
  });

  it("passes through normal chat", () => {
    expect(compiler.compile(compilerInput("write a friendly two sentence reply"))).toMatchObject({
      kind: "pass_through",
    });
  });
});
