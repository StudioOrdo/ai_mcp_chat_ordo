import { describe, expect, it, vi } from "vitest";

import { ToolRegistry } from "./ToolRegistry";
import type { ToolDescriptor } from "./ToolDescriptor";

function createDescriptor(name: string, roles: ToolDescriptor["roles"] = "ALL"): ToolDescriptor {
  return {
    name,
    roles,
    category: "system",
    schema: {
      description: `${name} description`,
      input_schema: { type: "object", properties: {} },
    },
    command: {
      execute: vi.fn(),
    },
  };
}

function createDescriptorWithPromptExposure(
  name: string,
  exposure: NonNullable<ToolDescriptor["promptExposure"]>["exposure"],
  roles: ToolDescriptor["roles"] = "ALL",
): ToolDescriptor {
  return {
    ...createDescriptor(name, roles),
    promptExposure: { exposure },
  };
}

describe("ToolRegistry.getSchemasForRole", () => {
  it("returns schemas in alphabetical order regardless of registration order", () => {
    const registry = new ToolRegistry();

    registry.register(createDescriptor("zeta_tool"));
    registry.register(createDescriptor("alpha_tool"));
    registry.register(createDescriptor("middle_tool"));

    expect(registry.getSchemasForRole("ANONYMOUS").map((schema) => schema.name)).toEqual([
      "alpha_tool",
      "middle_tool",
      "zeta_tool",
    ]);
  });

  it("sorts after role filtering so each role gets a deterministic manifest", () => {
    const registry = new ToolRegistry();

    registry.register(createDescriptor("zeta_tool", ["ADMIN"]));
    registry.register(createDescriptor("alpha_tool", ["ANONYMOUS", "ADMIN"]));
    registry.register(createDescriptor("middle_tool", ["ANONYMOUS"]));

    expect(registry.getSchemasForRole("ANONYMOUS").map((schema) => schema.name)).toEqual([
      "alpha_tool",
      "middle_tool",
    ]);
    expect(registry.getSchemasForRole("ADMIN").map((schema) => schema.name)).toEqual([
      "alpha_tool",
      "zeta_tool",
    ]);
  });
});

describe("ToolRegistry.getPromptVisibleSchemasForRole", () => {
  it("keeps executable schemas separate from default prompt-visible schemas", () => {
    const registry = new ToolRegistry();

    registry.register(createDescriptor("default_tool"));
    registry.register(createDescriptorWithPromptExposure("diagnostic_tool", "intent_gated"));
    registry.register(createDescriptorWithPromptExposure("operator_tool", "operator_only", ["ADMIN"]));

    expect(registry.getSchemasForRole("ADMIN").map((schema) => schema.name)).toEqual([
      "default_tool",
      "diagnostic_tool",
      "operator_tool",
    ]);

    expect(registry.getPromptVisibleSchemasForRole("ADMIN", { mode: "default_chat" }).map((schema) => schema.name)).toEqual([
      "default_tool",
    ]);

    expect(registry.canExecute("diagnostic_tool", "ADMIN")).toBe(true);
    expect(registry.canExecute("operator_tool", "ADMIN")).toBe(true);
  });

  it("supports intent-gated and operator projection modes without weakening role checks", () => {
    const registry = new ToolRegistry();

    registry.register(createDescriptor("default_tool"));
    registry.register(createDescriptorWithPromptExposure("diagnostic_tool", "intent_gated"));
    registry.register(createDescriptorWithPromptExposure("operator_tool", "operator_only", ["ADMIN"]));
    registry.register(createDescriptorWithPromptExposure("internal_tool", "internal_only"));

    expect(registry.getPromptVisibleSchemasForRole("AUTHENTICATED", {
      mode: "intent_gated",
      intentToolNames: ["diagnostic_tool"],
    }).map((schema) => schema.name)).toEqual([
      "default_tool",
      "diagnostic_tool",
    ]);

    expect(registry.getPromptVisibleSchemasForRole("ADMIN", { mode: "operator_chat" }).map((schema) => schema.name)).toEqual([
      "default_tool",
      "diagnostic_tool",
      "operator_tool",
    ]);

    expect(registry.getPromptVisibleSchemasForRole("ADMIN", { mode: "internal" }).map((schema) => schema.name)).toEqual([
      "default_tool",
      "diagnostic_tool",
      "internal_tool",
      "operator_tool",
    ]);
  });
});
