import { describe, expect, it } from "vitest";

import {
  DEFAULT_OPERATION_PROMPT_GROUNDING_BUDGET,
  type OperationPromptGroundingSnapshot,
} from "@/core/use-cases/operations/OperationPromptGrounding";
import { buildOperationPromptGroundingSection } from "@/lib/operations/operation-prompt-grounding";

function snapshot(overrides: Partial<OperationPromptGroundingSnapshot> = {}): OperationPromptGroundingSnapshot {
  return {
    generatedAt: "2026-05-03T12:00:00.000Z",
    conversationId: "conv_1",
    status: "available",
    includeInPrompt: true,
    operations: [
      {
        operationId: "op_restore",
        kind: "restore_execute",
        title: "Restore Appliance",
        status: "blocked",
        riskLevel: "destructive",
        revision: 3,
        currentStepId: "restore.safety_backup",
        summary: "Restore is waiting for a safety backup.",
        progress: {
          totalSteps: 2,
          pendingSteps: 1,
          readySteps: 0,
          runningSteps: 0,
          blockedSteps: 1,
          succeededSteps: 0,
          failedSteps: 0,
          skippedSteps: 0,
          cancelledSteps: 0,
          percentComplete: 25,
        },
        error: { code: "BACKUP_REQUIRED", message: "Safety backup required." },
        latestEvents: [
          {
            sequence: 7,
            type: "operation_status_changed",
            stepId: "restore.safety_backup",
            createdAt: "2026-05-03T12:00:00.000Z",
            payloadSummary: "{\"status\":\"blocked\"}",
          },
        ],
        availableActions: [],
        artifacts: [],
        updatedAt: "2026-05-03T12:00:00.000Z",
        groundingReason: "active",
      },
    ],
    toolEvidence: [],
    budget: {
      ...DEFAULT_OPERATION_PROMPT_GROUNDING_BUDGET,
      operationsDropped: 0,
      eventsDropped: 0,
      artifactsDropped: 0,
      actionsDropped: 0,
      toolEvidenceDropped: 0,
    },
    warnings: [],
    ...overrides,
  };
}

describe("operation-prompt-grounding", () => {
  it("formats an authoritative operation grounding prompt block", () => {
    const section = buildOperationPromptGroundingSection(snapshot());

    expect(section).toMatchObject({
      key: "operation_grounding",
      priority: 43,
      payload: {
        status: "available",
        operationRefs: [
          expect.objectContaining({
            operationId: "op_restore",
            kind: "restore_execute",
            status: "blocked",
          }),
        ],
      },
    });
    expect(section?.content).toContain("[Server operation grounding]");
    expect(section?.content).toContain("Ledger status beats chat text");
    expect(section?.content).toContain("status: blocked");
    expect(section?.content).not.toContain("status: succeeded");
  });

  it("includes relevant tool evidence without making it operation truth", () => {
    const section = buildOperationPromptGroundingSection(snapshot({
      toolEvidence: [
        {
          messageId: "msg_tool",
          toolInvocationId: "toolu_1",
          toolName: "generate_audio",
          evidenceKind: "result",
          summary: "{\"success\":false}",
          error: "provider key missing",
          relatedOperationId: "op_restore",
          createdAt: "2026-05-03T12:00:00.000Z",
        },
      ],
    }));

    expect(section?.content).toContain("Tool result evidence can explain what happened");
    expect(section?.content).toContain("generate_audio result toolu_1 related=op_restore: failed - provider key missing");
  });

  it("omits the prompt section when empty grounding is not prompt relevant", () => {
    expect(buildOperationPromptGroundingSection(snapshot({
      status: "empty",
      includeInPrompt: false,
      operations: [],
    }))).toBeNull();
  });

  it("formats compact empty grounding for operation status questions", () => {
    const section = buildOperationPromptGroundingSection(snapshot({
      status: "empty",
      includeInPrompt: true,
      operations: [],
      warnings: ["no_current_operation_state_found_for_conversation"],
    }));

    expect(section?.content).toContain("No current operation state was found");
    expect(section?.content).toContain("no_current_operation_state_found_for_conversation");
  });

  it("formats explicit unavailable grounding when reads fail", () => {
    const section = buildOperationPromptGroundingSection(snapshot({
      status: "unavailable",
      includeInPrompt: true,
      operations: [],
      warnings: ["operation_grounding_unavailable:db offline"],
    }));

    expect(section?.content).toContain("Operation grounding is unavailable");
    expect(section?.content).toContain("db offline");
  });
});
