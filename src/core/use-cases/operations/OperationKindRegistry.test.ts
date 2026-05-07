import { describe, expect, it } from "vitest";

import {
  OperationActionRejectedError,
  OperationKindNotRegisteredError,
  type OperationKindDefinition,
} from "@/core/entities/operation";

import {
  createDefaultOperationKindRegistry,
  DEFAULT_OPERATION_KIND_DEFINITIONS,
  OperationKindRegistry,
} from "./OperationKindRegistry";

describe("OperationKindRegistry", () => {
  it("registers the required initial operation kinds", () => {
    const registry = createDefaultOperationKindRegistry();

    expect(registry.list().map((definition) => definition.kind)).toEqual([
      "backup_create",
      "restore_execute",
      "media_workflow",
      "factory_work_order",
      "system_diagnostic",
      "tool_task",
      "content_publish",
      "onboarding_flow",
      "help_flow",
    ]);
  });

  it("exposes risk, visibility, role, retry, conversation, and handler policy", () => {
    const registry = createDefaultOperationKindRegistry();

    expect(registry.require("restore_execute")).toMatchObject({
      defaultRiskLevel: "destructive",
      defaultVisibility: "admin",
      allowedRoles: ["ADMIN"],
      supportsRetry: false,
      requiresConversation: false,
      handlerKey: "restore.execute",
    });
    expect(registry.require("help_flow").allowedRoles).toContain("ANONYMOUS");
  });

  it("rejects unknown operation kinds", () => {
    const registry = createDefaultOperationKindRegistry();

    expect(() => registry.require("unknown_kind")).toThrow(OperationKindNotRegisteredError);
  });

  it("rejects duplicate registrations", () => {
    const registry = new OperationKindRegistry([DEFAULT_OPERATION_KIND_DEFINITIONS[0]]);

    expect(() => registry.register(DEFAULT_OPERATION_KIND_DEFINITIONS[0])).toThrow(OperationActionRejectedError);
  });

  it("supports explicit clean registration for tests and future phases", () => {
    const definition: OperationKindDefinition = {
      kind: "help_flow",
      label: "Help",
      description: "Help flow",
      defaultRiskLevel: "info",
      defaultVisibility: "conversation",
      allowedRoles: ["ANONYMOUS", "AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
      supportsRetry: true,
      requiresConversation: true,
      handlerKey: "help.flow",
    };
    const registry = new OperationKindRegistry();

    registry.register(definition);

    expect(registry.has("help_flow")).toBe(true);
    expect(registry.get("help_flow")).toMatchObject({ handlerKey: "help.flow" });
  });
});
