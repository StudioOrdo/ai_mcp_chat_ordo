import { describe, expect, it } from "vitest";

import { assembleRoleDirective } from "./role-directive-assembler";

describe("assembleRoleDirective", () => {
  it("omits prompt hints for unavailable provider-backed tools", () => {
    const directive = assembleRoleDirective("ADMIN", {
      availableToolNames: [
        "inspect_runtime_context",
        "set_theme",
      ],
    });

    expect(directive).not.toContain("admin_web_search");
    expect(directive).not.toContain("Search the live web");
  });

  it("omits operator diagnostic prompt hints when the prompt-visible manifest excludes them", () => {
    const directive = assembleRoleDirective("ADMIN", {
      availableToolNames: [
        "admin_web_search",
        "search_corpus",
      ],
    });

    expect(directive).toContain("admin_web_search");
    expect(directive).not.toContain("inspect_runtime_logs");
    expect(directive).not.toContain("Read bounded runtime logs");
  });
});
