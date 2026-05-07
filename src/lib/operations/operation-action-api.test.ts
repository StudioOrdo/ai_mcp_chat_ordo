import { describe, expect, it } from "vitest";

import {
  OperationActionRequestError,
  parseOperationActionRequestBody,
  resolveStrongestOperationRole,
  statusForOperationActionError,
} from "@/lib/operations/operation-action-api";
import { OperationAuthorizationError, OperationPayloadValidationError } from "@/core/entities/operation";
import { OperationActionDispatchError } from "@/core/use-cases/operations/OperationActionDispatch";

describe("operation-action-api", () => {
  it("parses a valid operation action request body", () => {
    expect(parseOperationActionRequestBody({
      idempotencyKey: " idem_1 ",
      operationRevision: 3,
      payload: { restorePlanId: "restore_1" },
      confirmation: { confirmed: true, phrase: "RESTORE" },
    })).toEqual({
      idempotencyKey: "idem_1",
      operationRevision: 3,
      payload: { restorePlanId: "restore_1" },
      confirmation: { confirmed: true, phrase: "RESTORE" },
    });
  });

  it("rejects malformed payload and revision fields", () => {
    expect(() => parseOperationActionRequestBody({
      idempotencyKey: "idem_1",
      operationRevision: 0,
    })).toThrow(OperationActionRequestError);

    expect(() => parseOperationActionRequestBody({
      idempotencyKey: "idem_1",
      operationRevision: 1,
      payload: [],
    })).toThrow(OperationActionRequestError);
  });

  it("resolves the strongest effective role instead of the first role", () => {
    expect(resolveStrongestOperationRole(["AUTHENTICATED", "ADMIN"])).toBe("ADMIN");
    expect(resolveStrongestOperationRole(["APPRENTICE", "STAFF"])).toBe("STAFF");
    expect(resolveStrongestOperationRole([])).toBe("ANONYMOUS");
  });

  it("maps operation action errors to deterministic HTTP statuses", () => {
    expect(statusForOperationActionError(
      new OperationAuthorizationError("denied"),
      "ANONYMOUS",
    )).toBe(401);
    expect(statusForOperationActionError(
      new OperationAuthorizationError("denied"),
      "STAFF",
    )).toBe(403);
    expect(statusForOperationActionError(
      new OperationPayloadValidationError("bad payload"),
      "ADMIN",
    )).toBe(422);
    expect(statusForOperationActionError(
      new OperationActionDispatchError({
        code: "OPERATION_ACTION_EXECUTOR_UNAVAILABLE",
        message: "executor unavailable",
      }),
      "ADMIN",
    )).toBe(501);
  });
});
