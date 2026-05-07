import { describe, expect, it } from "vitest";

import type { ProductBrief } from "@/core/entities/product-brief";

import {
  createFactoryWorkOrderCreateAction,
  createFactoryWorkOrderRefineAssetAction,
  listFactoryWorkOrderCreatePayloadErrors,
  listFactoryWorkOrderRefineAssetPayloadErrors,
} from "./FactoryWorkOrderOperationActions";

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
    createdAt: "2026-05-03T12:00:00.000Z",
    createdBy: "usr_1",
    ...overrides,
  };
}

describe("FactoryWorkOrderOperationActions", () => {
  it("creates typed factory actions without placeholder payload schemas", () => {
    const action = createFactoryWorkOrderCreateAction({
      operationId: "op_1",
      operationRevision: 1,
      idFactory: (prefix) => `${prefix}_1`,
      payload: { brief: brief(), previousWorkOrderIds: [] },
    });

    expect(action).toMatchObject({
      actionType: "factory.work_order.create",
      allowedRoles: ["STAFF", "ADMIN"],
      allowedStatuses: ["draft", "blocked"],
      payloadSchemaKey: "factory.work_order.create",
      confirmPolicy: "single_click",
    });
    expect(action.payloadSchemaKey).not.toBe("none");
  });

  it("validates complete and incomplete ProductBrief payloads", () => {
    expect(listFactoryWorkOrderCreatePayloadErrors({ brief: brief() })).toEqual([]);
    expect(listFactoryWorkOrderCreatePayloadErrors({ brief: { ...brief(), title: "" } }))
      .toContain("ProductBrief.title must be a non-empty string.");
    expect(listFactoryWorkOrderCreatePayloadErrors({})).toEqual(["brief must be a ProductBrief object."]);
  });

  it("requires upload ids for upload-based refinement", () => {
    const action = createFactoryWorkOrderRefineAssetAction({
      operationId: "op_1",
      operationRevision: 2,
      idFactory: (prefix) => `${prefix}_2`,
      payload: {
        workOrderId: "wo_1",
        checkpointId: "checkpoint_1",
        assetId: "asset_1",
        mode: "replace_with_upload",
        userFileId: "uf_1",
      },
    });

    expect(action.payloadSchemaKey).toBe("factory.work_order.refine_asset");
    expect(listFactoryWorkOrderRefineAssetPayloadErrors({
      workOrderId: "wo_1",
      checkpointId: "checkpoint_1",
      assetId: "asset_1",
      mode: "replace_with_upload",
    })).toContain("userFileId must be a non-empty string.");
  });
});
