import { describe, expect, it, vi } from "vitest";

const { appendRuntimeAuditLogMock } = vi.hoisted(() => ({
  appendRuntimeAuditLogMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/observability/runtime-audit-log", () => ({
  appendRuntimeAuditLog: appendRuntimeAuditLogMock,
}));

import {
  createComposeBackedMcpContainerExecutionTargetAdapter,
} from "./mcp-stdio-adapter";
import {
  extractMcpToolCallAuditContext,
  McpProcessSessionPool,
  type McpProcessLaunchOptions,
  type McpProcessSession,
  type McpProcessSessionFactory,
} from "./mcp-process-runtime";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("mcp-process-runtime", () => {
  it("extracts bridged tool invocation audit context from MCP call arguments", () => {
    expect(extractMcpToolCallAuditContext({
      name: "admin_web_search",
      arguments: {
        query: "latest referral guidance",
        __executionContext: {
          userId: "admin-1",
          role: "ADMIN",
          conversationId: "conv-1",
          toolInvocationId: "toolu_mcp_1",
        },
      },
    })).toEqual({
      userId: "admin-1",
      role: "ADMIN",
      conversationId: "conv-1",
      toolInvocationId: "toolu_mcp_1",
    });
  });

  it("reuses an existing sidecar session for identical launch configs", async () => {
    const callTool = vi.fn(async () => ({ ok: true }));
    const close = vi.fn(async () => undefined);
    const factory: McpProcessSessionFactory = {
      createSession: vi.fn(async (_options: McpProcessLaunchOptions): Promise<McpProcessSession> => ({
        callTool,
        close,
      })),
    };
    const pool = new McpProcessSessionPool(factory);
    const launch: McpProcessLaunchOptions = {
      targetId: "mcp_stdio:admin-web-search",
      command: "tsx",
      args: ["mcp/admin-web-search-server.ts"],
      idleTimeoutMs: 60_000,
    };

    await pool.callTool(launch, { name: "admin_web_search", arguments: { query: "first" } });
    await pool.callTool(launch, { name: "admin_web_search", arguments: { query: "second" } });
    await pool.closeAll();

    expect(factory.createSession).toHaveBeenCalledTimes(1);
    expect(callTool).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("runs launch preparation only once for a reused managed session", async () => {
    const prepareLaunch = vi.fn(async () => undefined);
    const factory: McpProcessSessionFactory = {
      createSession: vi.fn(async () => ({
        callTool: vi.fn(async () => ({ ok: true })),
        close: vi.fn(async () => undefined),
      })),
    };
    const pool = new McpProcessSessionPool(factory);
    const launch: McpProcessLaunchOptions = {
      targetId: "mcp_container:admin-web-search",
      command: "docker",
      args: ["compose", "exec", "-T", "admin-web-search-mcp"],
      prepareLaunch,
      idleTimeoutMs: 60_000,
    };

    await pool.callTool(launch, { name: "admin_web_search", arguments: { query: "first" } });
    await pool.callTool(launch, { name: "admin_web_search", arguments: { query: "second" } });
    await pool.closeAll();

    expect(prepareLaunch).toHaveBeenCalledTimes(1);
    expect(factory.createSession).toHaveBeenCalledTimes(1);
  });

  it("audits managed sidecar launch failures with launch context", async () => {
    const factory: McpProcessSessionFactory = {
      createSession: vi.fn(async () => {
        throw new Error("spawn /ROOT/node_modules/.bin/tsx ENOENT");
      }),
    };
    const pool = new McpProcessSessionPool(factory);
    const launch: McpProcessLaunchOptions = {
      targetId: "mcp_stdio:admin_search:mcp/operations-server.ts",
      command: "/ROOT/node_modules/.bin/tsx",
      args: ["mcp/operations-server.ts"],
      cwd: "/ROOT",
      idleTimeoutMs: 60_000,
    };

    await expect(
      pool.callTool(launch, { name: "admin_search", arguments: { query: "*" } }),
    ).rejects.toThrow("tsx ENOENT");

    expect(factory.createSession).toHaveBeenCalledWith(launch);
    expect(appendRuntimeAuditLogMock).toHaveBeenCalledWith(
      "mcp_process",
      "session_launch_failed",
      expect.objectContaining({
        targetId: "mcp_stdio:admin_search:mcp/operations-server.ts",
        command: "/ROOT/node_modules/.bin/tsx",
        cwd: "/ROOT",
      }),
    );
  });

  it("resolves local MCP stdio launch paths from the runtime project root", async () => {
    const previousProjectRoot = process.env.ORDO_PROJECT_ROOT;
    process.env.ORDO_PROJECT_ROOT = process.cwd();
    const callTool = vi.fn(async () => ({
      content: [{ type: "text", text: JSON.stringify({ ok: true }) }],
    }));
    const pool = {
      callTool,
    } as unknown as McpProcessSessionPool;
    const { createLocalMcpStdioExecutionTargetAdapter } = await import("./mcp-stdio-adapter");

    try {
      const adapter = createLocalMcpStdioExecutionTargetAdapter({
        entrypoint: "mcp/operations-server.ts",
        toolName: "admin_search",
        sessionPool: pool,
      });

      await adapter.invoke({
        capability: {} as never,
        input: { query: "*" },
        context: {
          userId: "admin-1",
          role: "ADMIN",
        },
        plan: {} as never,
        target: {
          kind: "mcp_stdio",
        } as never,
      });

      expect(callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          command: expect.stringContaining("node_modules/.bin/tsx"),
          cwd: process.cwd(),
        }),
        expect.objectContaining({
          name: "admin_search",
        }),
      );
    } finally {
      if (previousProjectRoot === undefined) {
        delete process.env.ORDO_PROJECT_ROOT;
      } else {
        process.env.ORDO_PROJECT_ROOT = previousProjectRoot;
      }
    }
  });

  it("drops a failed managed session so the next call relaunches cleanly", async () => {
    const firstCallTool = vi.fn(async () => {
      throw new Error("session_closed");
    });
    const secondCallTool = vi.fn(async () => ({ ok: true }));
    const closeFirst = vi.fn(async () => undefined);
    const closeSecond = vi.fn(async () => undefined);
    const factory: McpProcessSessionFactory = {
      createSession: vi.fn()
        .mockResolvedValueOnce({
          callTool: firstCallTool,
          close: closeFirst,
        } satisfies McpProcessSession)
        .mockResolvedValueOnce({
          callTool: secondCallTool,
          close: closeSecond,
        } satisfies McpProcessSession),
    };
    const pool = new McpProcessSessionPool(factory);
    const launch: McpProcessLaunchOptions = {
      targetId: "mcp_stdio:admin-web-search",
      command: "tsx",
      args: ["mcp/admin-web-search-server.ts"],
      idleTimeoutMs: 60_000,
    };

    await expect(
      pool.callTool(launch, { name: "admin_web_search", arguments: { query: "first" } }),
    ).rejects.toThrow("session_closed");

    await expect(
      pool.callTool(launch, { name: "admin_web_search", arguments: { query: "second" } }),
    ).resolves.toEqual({ ok: true });

    await pool.closeAll();

    expect(factory.createSession).toHaveBeenCalledTimes(2);
    expect(closeFirst).toHaveBeenCalledTimes(1);
    expect(closeSecond).toHaveBeenCalledTimes(1);
  });

  it("does not idle-close a session while startup and the first tool call are still in flight", async () => {
    const callTool = vi.fn(async () => {
      await wait(80);
      return { ok: true };
    });
    const close = vi.fn(async () => undefined);
    const factory: McpProcessSessionFactory = {
      createSession: vi.fn(async () => {
        await wait(80);
        return {
          callTool,
          close,
        } satisfies McpProcessSession;
      }),
    };
    const pool = new McpProcessSessionPool(factory);
    const launch: McpProcessLaunchOptions = {
      targetId: "mcp_stdio:admin-web-search",
      command: "tsx",
      args: ["mcp/admin-web-search-server.ts"],
      idleTimeoutMs: 10,
    };

    await expect(
      pool.callTool(launch, { name: "admin_web_search", arguments: { query: "first" } }),
    ).resolves.toEqual({ ok: true });

    expect(factory.createSession).toHaveBeenCalledTimes(1);
    expect(callTool).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();

    await pool.closeAll();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("builds compose-backed container adapters via the same managed sidecar pool", async () => {
    const callTool = vi.fn(async () => ({
      content: [{ type: "text", text: JSON.stringify({ ok: true, target: "container" }) }],
    }));
    const pool = {
      callTool,
    } as unknown as McpProcessSessionPool;
    const adapter = createComposeBackedMcpContainerExecutionTargetAdapter({
      serviceName: "admin-web-search-mcp",
      entrypoint: "mcp/admin-web-search-server.ts",
      toolName: "admin_web_search",
      sessionPool: pool,
    });

    const result = await adapter.invoke({
      capability: {} as never,
      input: { query: "latest referral guidance" },
      context: {
        userId: "admin-1",
        role: "ADMIN",
        conversationId: "conv-1",
        toolInvocationId: "toolu_mcp_1",
      },
      plan: {} as never,
      target: {
        kind: "mcp_container",
      } as never,
    });

    expect(callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: "mcp_container:admin-web-search-mcp:admin_web_search",
        command: "docker",
        args: [
          "compose",
          "exec",
          "-T",
          "admin-web-search-mcp",
          "/app/node_modules/.bin/tsx",
          "/app/mcp/admin-web-search-server.ts",
        ],
        prepareLaunch: expect.any(Function),
      }),
      {
        name: "admin_web_search",
        arguments: {
          query: "latest referral guidance",
          __executionContext: {
            userId: "admin-1",
            role: "ADMIN",
            conversationId: "conv-1",
            toolInvocationId: "toolu_mcp_1",
          },
        },
      },
    );
    expect(result).toEqual({ ok: true, target: "container" });
  });
});
