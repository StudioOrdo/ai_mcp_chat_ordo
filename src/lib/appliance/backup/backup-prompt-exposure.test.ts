import { describe, expect, it } from "vitest";
import { createToolRegistry } from "@/lib/chat/tool-composition-root";

describe("backup governance prompt exposure", () => {
  it("does not add backup or restore tools to default chat in Phase 04A", () => {
    const registry = createToolRegistry({
      getAllDocuments: async () => [],
      getDocument: async () => null,
      getSectionsByDocument: async () => [],
      getAllSections: async () => [],
      getSection: async () => {
        throw new Error("not found");
      },
    });
    const defaultToolNames = registry
      .getPromptVisibleSchemasForRole("ADMIN", { mode: "default_chat" })
      .map((schema) => schema.name);

    expect(defaultToolNames).not.toContain("create_appliance_backup");
    expect(defaultToolNames).not.toContain("list_appliance_backups");
    expect(defaultToolNames).not.toContain("validate_appliance_backup");
    expect(defaultToolNames).not.toContain("prepare_appliance_restore");
    expect(defaultToolNames).not.toContain("request_pre_restore_backup");
    expect(defaultToolNames).not.toContain("confirm_appliance_restore");
    expect(defaultToolNames).not.toContain("execute_appliance_restore");
    expect(defaultToolNames).not.toContain("cancel_appliance_restore");
  });
});
