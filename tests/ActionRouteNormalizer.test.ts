import { describe, it, expect } from "vitest";
import { normalizeMessageActions } from "../src/lib/chat/ActionRouteNormalizer";

describe("ActionRouteNormalizer", () => {
  describe("normalizeMessageActions", () => {
    it("Positive: Maps valid routing actions correctly", () => {
      const payload = [
        { label: "Go to Dashboard", type: "route", path: "/dashboard" }
      ];
      const result = normalizeMessageActions(payload);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        label: "Go to Dashboard",
        action: "route",
        params: { path: "/dashboard" }
      });
    });

    it("Negative: Filters out invalid actions and malformed types", () => {
      const payload = [
        { label: "Missing Type", path: "/dashboard" },
        { label: "Unknown Action", type: "fly", path: "/space" },
        "Not an object",
        null
      ];
      const result = normalizeMessageActions(payload);
      expect(result).toHaveLength(0);
    });

    it("Edge Case: Slices to a maximum of 3 actions", () => {
      const payload = [
        { label: "A", type: "send", text: "A" },
        { label: "B", type: "send", text: "B" },
        { label: "C", type: "send", text: "C" },
        { label: "D", type: "send", text: "D" },
      ];
      const result = normalizeMessageActions(payload);
      expect(result).toHaveLength(3);
    });

    it("Positive: Preserves durable operation action identity", () => {
      const payload = [
        {
          label: "Execute restore",
          type: "operation",
          value: "op_1",
          params: {
            actionId: "action_1",
            idempotencyKey: "idem_1",
            operationRevision: "3",
            riskLevel: "destructive",
          },
        },
      ];

      expect(normalizeMessageActions(payload)).toEqual([
        {
          label: "Execute restore",
          action: "operation",
          params: {
            operationId: "op_1",
            actionId: "action_1",
            idempotencyKey: "idem_1",
            operationRevision: "3",
            riskLevel: "destructive",
          },
        },
      ]);
    });

    it("Negative: Drops operation actions without durable IDs", () => {
      expect(normalizeMessageActions([
        { label: "Execute restore", type: "operation", value: "op_1" },
      ])).toHaveLength(0);
    });
  });
});
