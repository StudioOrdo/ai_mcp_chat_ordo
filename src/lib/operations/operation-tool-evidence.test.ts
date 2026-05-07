import { describe, expect, it } from "vitest";

import type { Message } from "@/core/entities/conversation";
import { extractOperationToolEvidence } from "@/lib/operations/operation-tool-evidence";

function message(parts: Message["parts"], overrides: Partial<Message> = {}): Message {
  return {
    id: overrides.id ?? "msg_1",
    conversationId: overrides.conversationId ?? "conv_1",
    role: overrides.role ?? "assistant",
    content: overrides.content ?? "",
    parts,
    createdAt: overrides.createdAt ?? "2026-05-03T12:00:00.000Z",
    tokenEstimate: overrides.tokenEstimate ?? 1,
  };
}

describe("operation-tool-evidence", () => {
  it("pairs tool calls and results by invocation id", () => {
    const evidence = extractOperationToolEvidence([
      message([
        {
          type: "tool_call",
          name: "create_appliance_backup",
          args: { operationId: "op_backup" },
          toolInvocationId: "toolu_1",
        },
        {
          type: "tool_result",
          name: "create_appliance_backup",
          result: { success: true, backupId: "backup_1" },
          toolInvocationId: "toolu_1",
        },
      ]),
    ]);

    expect(evidence).toEqual([
      expect.objectContaining({
        toolInvocationId: "toolu_1",
        toolName: "create_appliance_backup",
        evidenceKind: "paired",
        relatedOperationId: "op_backup",
        summary: expect.stringContaining("backup_1"),
      }),
    ]);
  });

  it("prioritizes latest failed tool result evidence", () => {
    const evidence = extractOperationToolEvidence([
      message([
        {
          type: "tool_result",
          name: "generate_audio",
          result: { success: true },
          toolInvocationId: "toolu_ok",
        },
      ], { id: "msg_old", createdAt: "2026-05-03T11:00:00.000Z" }),
      message([
        {
          type: "tool_result",
          name: "generate_audio",
          result: { success: false, error: "provider key missing" },
          toolInvocationId: "toolu_fail",
        },
      ], { id: "msg_new", createdAt: "2026-05-03T12:00:00.000Z" }),
    ]);

    expect(evidence[0]).toMatchObject({
      messageId: "msg_new",
      error: "provider key missing",
    });
  });

  it("truncates large tool payloads and redacts unsafe fields", () => {
    const evidence = extractOperationToolEvidence([
      message([
        {
          type: "tool_result",
          name: "inspect_runtime_logs",
          result: {
            status: "failed",
            apiKey: "sk-live",
            nested: {
              password: "do-not-include",
              body: "x".repeat(1_000),
            },
          },
          toolInvocationId: "toolu_logs",
        },
      ]),
    ], { maxSummaryCharacters: 160 });

    expect(evidence[0].summary).toContain("[redacted]");
    expect(evidence[0].summary).not.toContain("sk-live");
    expect(evidence[0].summary).not.toContain("do-not-include");
    expect(evidence[0].summary.length).toBeLessThanOrEqual(160);
  });

  it("keeps unmatched calls and unmatched results as separate evidence", () => {
    const evidence = extractOperationToolEvidence([
      message([
        {
          type: "tool_call",
          name: "run_backup",
          args: { operationId: "op_backup" },
          toolInvocationId: "toolu_call",
        },
        {
          type: "tool_result",
          name: "run_backup",
          result: { status: "failed", error: "worker crashed" },
          toolInvocationId: "toolu_result",
        },
      ]),
    ]);

    expect(evidence.map((entry) => entry.evidenceKind)).toEqual(["result", "call"]);
  });
});
