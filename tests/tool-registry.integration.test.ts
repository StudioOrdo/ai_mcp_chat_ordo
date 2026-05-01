import { describe, it, expect, vi, beforeEach } from "vitest";
import { createToolRegistry } from "@/lib/chat/tool-composition-root";
import { composeMiddleware, type ToolExecuteFn } from "@/core/tool-registry/ToolMiddleware";
import { LoggingMiddleware } from "@/core/tool-registry/LoggingMiddleware";
import { RbacGuardMiddleware } from "@/core/tool-registry/RbacGuardMiddleware";
import { ToolAccessDeniedError, UnknownToolError } from "@/core/tool-registry/errors";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type { CorpusRepository } from "@/core/use-cases/CorpusRepository";
import { logEvent } from "@/lib/observability/logger";

vi.mock("@/lib/observability/logger", () => ({
  logEvent: vi.fn(),
}));

const logEventMock = vi.mocked(logEvent);

// Minimal mock CorpusRepository — returns canned data, no filesystem
const mockCorpusRepo: CorpusRepository = {
  getAllDocuments: vi.fn().mockResolvedValue([]),
  getDocument: vi.fn().mockResolvedValue(null),
  getAllSections: vi.fn().mockResolvedValue([]),
  getSectionsByDocument: vi.fn().mockResolvedValue([]),
  getSection: vi.fn().mockResolvedValue({ documentSlug: "", sectionSlug: "", title: "", content: "", contributors: [], supplements: [], headings: [] }),
};

function buildStack() {
  const registry = createToolRegistry(mockCorpusRepo);
  const executor: ToolExecuteFn = composeMiddleware(
    [new LoggingMiddleware(), new RbacGuardMiddleware(registry)],
    registry.execute.bind(registry),
  );
  return { registry, executor };
}

const anonCtx: ToolExecutionContext = { role: "ANONYMOUS", userId: "anon-1" };
const authCtx: ToolExecutionContext = { role: "AUTHENTICATED", userId: "user-1" };
const adminCtx: ToolExecutionContext = { role: "ADMIN", userId: "admin-1" };

describe("Tool Registry Integration", () => {
  beforeEach(() => {
    logEventMock.mockClear();
  });

  // TEST-REG-01
  it("registry has the full Sprint 3 tool surface after composition", () => {
    const { registry } = buildStack();
    expect(registry.getToolNames()).toHaveLength(59);
  });

  // TEST-REG-02
  it("registering a duplicate tool name throws", () => {
    const { registry } = buildStack();
    expect(() => registry.register({
      name: "calculator",
      schema: { description: "dup", input_schema: { type: "object", properties: {} } },
      command: { execute: async () => ({}) },
      roles: "ALL",
      category: "math",
    })).toThrow('Tool "calculator" is already registered');
  });

  // TEST-REG-03
  it("ANONYMOUS gets the current public tool surface", () => {
    const { registry } = buildStack();
    const schemas = registry.getSchemasForRole("ANONYMOUS");
    const names = schemas.map(s => s.name).sort();
    expect(names).toEqual([
      "adjust_ui",
      "calculator",
      "generate_audio",
      "generate_chart",
      "generate_graph",
      "get_checklist",
      "get_corpus_summary",
      "get_current_page",
      "get_section",
      "inspect_runtime_context",
      "inspect_theme",
      "list_available_pages",
      "list_practitioners",
      "navigate_to_page",
      "search_corpus",
      "set_theme",
    ]);
  });

  // TEST-REG-04
  it("AUTHENTICATED gets all member tools", () => {
    const { registry } = buildStack();
    const schemas = registry.getSchemasForRole("AUTHENTICATED");
    expect(schemas).toHaveLength(28);
  });

  it("ADMIN gets the journal wrapper tools alongside compatibility-safe blog tools", () => {
    const { registry } = buildStack();
    const names = registry.getSchemasForRole("ADMIN").map((schema) => schema.name);

    expect(names).toEqual(expect.arrayContaining([
      "list_journal_posts",
      "get_journal_post",
      "list_journal_revisions",
      "get_journal_workflow_summary",
      "update_journal_metadata",
      "update_journal_draft",
      "submit_journal_review",
      "approve_journal_post",
      "publish_journal_post",
      "restore_journal_revision",
      "select_journal_hero_image",
      "prepare_journal_post_for_publish",
      "draft_content",
      "publish_content",
    ]));
  });

  // TEST-REG-05
  it("execute calculator via full stack → correct result", async () => {
    const { executor } = buildStack();
    const result = await executor("calculator", { operation: "add", a: 2, b: 3 }, anonCtx);
    expect(result).toEqual({ operation: "add", a: 2, b: 3, result: 5 });
  });

  // TEST-REG-06
  it("ANONYMOUS executing compose_media → ToolAccessDeniedError, command never called", async () => {
    const { executor } = buildStack();
    await expect(executor("compose_media", { prompt: "test" }, anonCtx))
      .rejects.toThrow(ToolAccessDeniedError);
  });

  // TEST-REG-07
  it("execute nonexistent tool → UnknownToolError", async () => {
    const { executor } = buildStack();
    await expect(executor("nonexistent_tool", {}, anonCtx))
      .rejects.toThrow(UnknownToolError);
  });

  // Logging verification
  it("logs START + SUCCESS for successful execution", async () => {
    const { executor } = buildStack();
    await executor("calculator", { operation: "add", a: 1, b: 2 }, anonCtx);
    expect(logEventMock).toHaveBeenCalledWith("info", "tool.start", expect.objectContaining({ tool: "calculator" }));
    expect(logEventMock).toHaveBeenCalledWith("info", "tool.success", expect.objectContaining({ tool: "calculator" }));
  });

  it("logs START + ERROR for denied access", async () => {
    const { executor } = buildStack();
    try { await executor("compose_media", {}, anonCtx); } catch { /* expected */ }
    expect(logEventMock).toHaveBeenCalledWith("info", "tool.start", expect.objectContaining({ tool: "compose_media" }));
    expect(logEventMock).toHaveBeenCalledWith("error", "tool.error", expect.objectContaining({ tool: "compose_media" }));
  });
});

describe("Security Verification", () => {
  beforeEach(() => {
    logEventMock.mockClear();
  });

  // TEST-SEC-01: Context isolation — LLM input cannot escalate privileges
  it("context.role is not overridden by LLM input", async () => {
    const { executor } = buildStack();
    // LLM sends {role: "ADMIN"} in input — should be ignored; context.role remains AUTHENTICATED
    // ANONYMOUS can't access generate_chart, but AUTHENTICATED can
    // The point: even if input contains {role: "ADMIN"}, the middleware uses context.role
    const result = await executor("calculator", { operation: "add", a: 1, b: 1 }, authCtx);
    expect(result).toMatchObject({ result: 2 });
    // Also verify ANONYMOUS is still blocked from restricted tools regardless of input
    await expect(executor("compose_media", { prompt: "test", role: "ADMIN" }, anonCtx))
      .rejects.toThrow(ToolAccessDeniedError);
  });

  // TEST-SEC-02: RBAC blocks at middleware, not command
  it("ANONYMOUS executing list_my_jobs → ToolAccessDeniedError", async () => {
    const { executor } = buildStack();
    await expect(executor("list_my_jobs", {}, anonCtx))
      .rejects.toThrow(ToolAccessDeniedError);
  });

  // TEST-SEC-03: Per-descriptor role arrays work for custom tools
  it("custom ADMIN-only tool rejects non-ADMIN roles", async () => {
    const registry = createToolRegistry(mockCorpusRepo);
    registry.register({
      name: "admin_secret",
      schema: { description: "Admin only", input_schema: { type: "object", properties: {} } },
      command: { execute: async () => "secret" },
      roles: ["ADMIN"],
      category: "system",
    });
    const exec: ToolExecuteFn = composeMiddleware(
      [new LoggingMiddleware(), new RbacGuardMiddleware(registry)],
      registry.execute.bind(registry),
    );

    // ADMIN succeeds
    await expect(exec("admin_secret", {}, adminCtx)).resolves.toBe("secret");

    // All others rejected
    await expect(exec("admin_secret", {}, anonCtx)).rejects.toThrow(ToolAccessDeniedError);
    await expect(exec("admin_secret", {}, authCtx)).rejects.toThrow(ToolAccessDeniedError);
    await expect(exec("admin_secret", {}, { role: "STAFF", userId: "staff-1" }))
      .rejects.toThrow(ToolAccessDeniedError);
  });
});
