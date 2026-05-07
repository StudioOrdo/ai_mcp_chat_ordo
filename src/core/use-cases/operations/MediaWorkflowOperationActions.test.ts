import { describe, expect, it } from "vitest";

import {
  createMediaWorkflowCancelAction,
  createMediaWorkflowCreateAction,
  createMediaWorkflowRetryStepAction,
  mediaWorkflowOperationStepId,
  mediaWorkflowOperationStepKindForMediaStepKind,
} from "./MediaWorkflowOperationActions";

function idFactory(prefix: string): string {
  return `${prefix}_1`;
}

describe("MediaWorkflowOperationActions", () => {
  it("creates a typed create action with authenticated role rules and payload schema", () => {
    const action = createMediaWorkflowCreateAction({
      operationId: "op_media_1",
      operationRevision: 2,
      idFactory,
      payload: {
        requestedDeliverable: "audio",
        template: "generated_audio",
        idempotencyKey: "idem_media",
      },
    });

    expect(action).toMatchObject({
      actionType: "media.workflow.create",
      riskLevel: "medium",
      confirmPolicy: "single_click",
      allowedRoles: ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
      allowedStatuses: ["draft", "blocked"],
      payloadSchemaKey: "media.workflow.create",
      enabled: true,
    });
  });

  it("creates retry and cancel actions with explicit workflow payloads", () => {
    expect(createMediaWorkflowRetryStepAction({
      operationId: "op_media_1",
      operationRevision: 3,
      idFactory,
      workflowId: "mwf_1",
      stepId: "mwfs_1",
      idempotencyKey: "retry_1",
    })).toMatchObject({
      actionType: "media.workflow.retry_step",
      riskLevel: "medium",
      confirmPolicy: "single_click",
      allowedStatuses: ["blocked", "failed"],
      payloadSchemaKey: "media.workflow.retry_step",
      payload: {
        workflowId: "mwf_1",
        stepId: "mwfs_1",
        idempotencyKey: "retry_1",
      },
    });

    expect(createMediaWorkflowCancelAction({
      operationId: "op_media_1",
      operationRevision: 3,
      idFactory,
      workflowId: "mwf_1",
    })).toMatchObject({
      actionType: "media.workflow.cancel",
      riskLevel: "low",
      confirmPolicy: "single_click",
      payloadSchemaKey: "media.workflow.cancel",
      payload: {
        workflowId: "mwf_1",
        reason: "User requested cancellation.",
      },
    });
  });

  it("maps media workflow step kinds to canonical operation step ids and kinds", () => {
    expect(mediaWorkflowOperationStepId("op_1", "mwfs_1")).toBe("op_1:media_step:mwfs_1");
    expect(mediaWorkflowOperationStepKindForMediaStepKind("generate_audio")).toBe("media.generate_audio");
    expect(mediaWorkflowOperationStepKindForMediaStepKind("compose_media")).toBe("media.compose");
    expect(mediaWorkflowOperationStepKindForMediaStepKind("reuse_asset")).toBe("media.reuse_asset");
    expect(() => mediaWorkflowOperationStepKindForMediaStepKind("unknown")).toThrow(/Unsupported media workflow step kind/);
  });
});
