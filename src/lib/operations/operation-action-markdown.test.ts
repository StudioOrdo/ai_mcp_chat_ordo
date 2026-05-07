import { describe, expect, it } from "vitest";

import type { OperationAction } from "@/core/entities/operation";
import { INLINE_TYPES } from "@/core/entities/rich-content";
import { MarkdownParserService } from "@/adapters/MarkdownParserService";
import { operationActionToMarkdown } from "@/lib/operations/operation-action-markdown";
import { parseOperationActionLinkModel } from "@/lib/operations/operation-action-view-model";

const action: OperationAction = {
  id: "act_1",
  operationId: "op_1",
  operationRevision: 1,
  actionType: "restore.prepare",
  label: "Prepare Restore",
  riskLevel: "destructive",
  confirmPolicy: "phrase",
  allowedRoles: ["ADMIN"],
  allowedStatuses: ["draft"],
  enabled: false,
  disabledReason: "Restore executor is not registered.",
  idempotencyKey: "idem_1",
  expiresAt: null,
  payload: { snapshotId: "backup_123456789abc" },
  payloadSchemaKey: "restore.prepare",
  confirmationText: "RESTORE backup_123456789abc",
};

describe("operation-action-markdown", () => {
  it("round-trips operation actions through markdown parsing and view model parsing", () => {
    const markdown = operationActionToMarkdown(action);
    const richContent = new MarkdownParserService().parse(markdown);
    const node = richContent.blocks[0]?.type === "paragraph"
      ? richContent.blocks[0].content.find((inline) => inline.type === INLINE_TYPES.ACTION_LINK)
      : null;

    expect(node).toMatchObject({
      type: "action-link",
      actionType: "operation",
      value: "op_1",
    });
    if (!node || node.type !== INLINE_TYPES.ACTION_LINK) {
      throw new Error("Expected operation action link");
    }

    const model = parseOperationActionLinkModel(node.value, node.params);
    expect(model).toMatchObject({
      operationId: "op_1",
      actionId: "act_1",
      operationRevision: 1,
      payload: { snapshotId: "backup_123456789abc" },
      confirmPolicy: "phrase",
      disabledReason: "Restore executor is not registered.",
    });
  });
});
