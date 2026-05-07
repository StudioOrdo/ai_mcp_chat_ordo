import { describe, expect, it } from "vitest";

import type {
  Operation,
  OperationAction,
  OperationArtifact,
  OperationEvent,
  OperationStep,
} from "@/core/entities/operation";
import { INLINE_TYPES } from "@/core/entities/rich-content";
import { MarkdownParserService } from "@/adapters/MarkdownParserService";
import type { OperationSnapshot } from "@/core/use-cases/operations/OperationRepository";
import { projectOperationSnapshot } from "@/lib/operations/operation-intent-projection";

const operation: Operation = {
  id: "op_1",
  kind: "backup_create",
  revision: 1,
  title: "Create Appliance Backup",
  status: "blocked",
  riskLevel: "medium",
  conversationId: "conv_1",
  originMessageId: "msg_user_1",
  createdByUserId: "usr_admin",
  createdByRole: "ADMIN",
  visibility: "admin",
  currentStepId: null,
  summary: "Create a backup.",
  input: {
    gates: [{
      id: "executor:ordo-backup",
      state: "blocked",
      summary: "Backup executor binary is unavailable.",
    }],
  },
  result: null,
  error: {
    code: "OPERATION_GATED",
    message: "Operation gated.",
  },
  createdAt: "2026-05-03T00:00:00.000Z",
  updatedAt: "2026-05-03T00:00:00.000Z",
  completedAt: null,
};

const action: OperationAction = {
  id: "act_1",
  operationId: "op_1",
  operationRevision: 1,
  actionType: "backup.create",
  label: "Create Backup",
  riskLevel: "medium",
  confirmPolicy: "single_click",
  allowedRoles: ["ADMIN"],
  allowedStatuses: ["blocked", "draft"],
  enabled: false,
  disabledReason: "Backup executor binary is unavailable.",
  idempotencyKey: "idem_1",
  expiresAt: null,
  payload: {},
  payloadSchemaKey: "backup.create",
  confirmationText: null,
};

describe("operation-intent-projection", () => {
  it("renders ledger state and operation buttons without claiming execution", () => {
    const snapshot: OperationSnapshot = {
      operation,
      actions: [action],
      steps: [] as OperationStep[],
      events: [] as OperationEvent[],
      artifacts: [] as OperationArtifact[],
    };

    const markdown = projectOperationSnapshot({
      snapshot,
      heading: "Operation Blocked",
      reason: "Create a backup.",
    });

    expect(markdown).toContain("Status: `blocked`");
    expect(markdown).toContain("Backup executor binary is unavailable.");
    expect(markdown).not.toContain("I ran the backup");
    expect(markdown).not.toContain("backup completed");

    const richContent = new MarkdownParserService().parse(markdown);
    const actionLinks = richContent.blocks.flatMap((block) =>
      block.type === "paragraph"
        ? block.content.filter((inline) => inline.type === INLINE_TYPES.ACTION_LINK)
        : []);

    expect(actionLinks).toHaveLength(1);
    expect(actionLinks[0]).toMatchObject({
      actionType: "operation",
      value: "op_1",
    });
  });
});
