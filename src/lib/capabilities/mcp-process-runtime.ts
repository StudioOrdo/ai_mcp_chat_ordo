import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { appendRuntimeAuditLog } from "@/lib/observability/runtime-audit-log";

export interface McpProcessLaunchOptions {
  targetId: string;
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stderr?: "pipe" | "inherit" | "ignore";
  idleTimeoutMs?: number;
  prepareLaunch?: () => Promise<void>;
}

export interface McpToolCallRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

interface McpToolCallAuditContext {
  userId?: string;
  role?: string;
  conversationId?: string;
  toolInvocationId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractMcpToolCallAuditContext(request: McpToolCallRequest): McpToolCallAuditContext {
  const executionContext = request.arguments?.__executionContext;
  if (!isRecord(executionContext)) {
    return {};
  }

  return {
    ...(typeof executionContext.userId === "string" ? { userId: executionContext.userId } : {}),
    ...(typeof executionContext.role === "string" ? { role: executionContext.role } : {}),
    ...(typeof executionContext.conversationId === "string" ? { conversationId: executionContext.conversationId } : {}),
    ...(typeof executionContext.toolInvocationId === "string" ? { toolInvocationId: executionContext.toolInvocationId } : {}),
  };
}

export interface McpProcessSession {
  callTool(request: McpToolCallRequest): Promise<unknown>;
  close(): Promise<void>;
}

export interface McpProcessSessionFactory {
  createSession(options: McpProcessLaunchOptions): Promise<McpProcessSession>;
}

interface SessionEntry {
  sessionPromise: Promise<McpProcessSession>;
  idleTimer: NodeJS.Timeout | null;
  activeCalls: number;
}

function toEnvRecord(env: NodeJS.ProcessEnv | undefined): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function buildLaunchCacheKey(options: McpProcessLaunchOptions): string {
  return JSON.stringify({
    targetId: options.targetId,
    command: options.command,
    args: options.args,
    cwd: options.cwd ?? null,
    env: Object.entries(toEnvRecord(options.env)).sort(([left], [right]) => left.localeCompare(right)),
  });
}

function getDefaultIdleTimeoutMs(): number {
  if (process.env.ORDO_MCP_SESSION_IDLE_MS) {
    const parsed = Number.parseInt(process.env.ORDO_MCP_SESSION_IDLE_MS, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return process.env.NODE_ENV === "test" ? 50 : 30_000;
}

class DefaultMcpProcessSession implements McpProcessSession {
  private readonly stderrChunks: string[] = [];
  private readonly client: Client;
  private readonly transport: StdioClientTransport;
  private readonly options: McpProcessLaunchOptions;

  constructor(options: McpProcessLaunchOptions) {
    this.options = options;
    this.transport = new StdioClientTransport({
      command: options.command,
      args: options.args,
      cwd: options.cwd,
      env: toEnvRecord(options.env),
      stderr: options.stderr ?? "pipe",
    });

    this.transport.stderr?.on("data", (chunk) => {
      this.stderrChunks.push(String(chunk));
    });

    this.client = new Client(
      { name: "studio-ordo-execution-target", version: "1.0.0" },
      { capabilities: {} },
    );
  }

  async initialize(): Promise<void> {
    await appendRuntimeAuditLog("mcp_process", "session_initialize_started", {
      targetId: this.options.targetId,
      command: this.options.command,
      args: this.options.args,
      cwd: this.options.cwd ?? null,
    });
    await this.client.connect(this.transport);
    await appendRuntimeAuditLog("mcp_process", "session_initialize_succeeded", {
      targetId: this.options.targetId,
      command: this.options.command,
      args: this.options.args,
      cwd: this.options.cwd ?? null,
    });
  }

  async callTool(request: McpToolCallRequest): Promise<unknown> {
    const auditContext = extractMcpToolCallAuditContext(request);

    try {
      await appendRuntimeAuditLog("mcp_process", "tool_call_started", {
        targetId: this.options.targetId,
        toolName: request.name,
        arguments: request.arguments,
        ...auditContext,
      });

      const result = await this.client.callTool(request);
      await appendRuntimeAuditLog("mcp_process", "tool_call_succeeded", {
        targetId: this.options.targetId,
        toolName: request.name,
        result,
        ...auditContext,
      });
      return result;
    } catch (error) {
      const stderrOutput = this.stderrChunks.join("").trim();
      await appendRuntimeAuditLog("mcp_process", "tool_call_failed", {
        targetId: this.options.targetId,
        toolName: request.name,
        arguments: request.arguments,
        stderrOutput: stderrOutput || null,
        ...auditContext,
        error,
      });
      if (stderrOutput.length > 0) {
        throw new Error(`Managed MCP sidecar call for "${request.name}" failed: ${stderrOutput}`);
      }

      throw error;
    }
  }

  async close(): Promise<void> {
    await appendRuntimeAuditLog("mcp_process", "session_close_started", {
      targetId: this.options.targetId,
    });
    await this.client.close().catch(() => undefined);
    await appendRuntimeAuditLog("mcp_process", "session_close_completed", {
      targetId: this.options.targetId,
    });
  }
}

class DefaultMcpProcessSessionFactory implements McpProcessSessionFactory {
  async createSession(options: McpProcessLaunchOptions): Promise<McpProcessSession> {
    const session = new DefaultMcpProcessSession(options);
    await session.initialize();
    return session;
  }
}

export class McpProcessSessionPool {
  private readonly sessions = new Map<string, SessionEntry>();

  constructor(
    private readonly factory: McpProcessSessionFactory = new DefaultMcpProcessSessionFactory(),
  ) {}

  private clearIdleTimer(entry: SessionEntry): void {
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = null;
    }
  }

  private scheduleIdleClose(cacheKey: string, entry: SessionEntry, idleTimeoutMs: number): void {
    this.clearIdleTimer(entry);

    if (entry.activeCalls > 0) {
      return;
    }

    if (idleTimeoutMs <= 0) {
      return;
    }

    entry.idleTimer = setTimeout(() => {
      void this.closeCacheEntry(cacheKey, entry);
    }, idleTimeoutMs);
    entry.idleTimer.unref?.();
  }

  private getOrCreateEntry(options: McpProcessLaunchOptions): { cacheKey: string; entry: SessionEntry } {
    const cacheKey = buildLaunchCacheKey(options);
    const existing = this.sessions.get(cacheKey);

    if (existing) {
      this.clearIdleTimer(existing);
      return { cacheKey, entry: existing };
    }

    const entry: SessionEntry = {
      sessionPromise: Promise.resolve()
        .then(() => options.prepareLaunch?.())
        .then(() => this.factory.createSession(options)),
      idleTimer: null,
      activeCalls: 0,
    };

    this.sessions.set(cacheKey, entry);
    return { cacheKey, entry };
  }

  private async closeCacheEntry(cacheKey: string, entry: SessionEntry): Promise<void> {
    const current = this.sessions.get(cacheKey);
    if (current !== entry) {
      return;
    }

    this.sessions.delete(cacheKey);

    this.clearIdleTimer(entry);

    const session = await entry.sessionPromise.catch(() => null);
    await session?.close().catch(() => undefined);
  }

  async callTool(options: McpProcessLaunchOptions, request: McpToolCallRequest): Promise<unknown> {
    const { cacheKey, entry } = this.getOrCreateEntry(options);
    entry.activeCalls += 1;

    try {
      const session = await entry.sessionPromise;
      const result = await session.callTool(request);
      return result;
    } catch (error) {
      await this.closeCacheEntry(cacheKey, entry);
      throw error;
    } finally {
      entry.activeCalls = Math.max(0, entry.activeCalls - 1);
      this.scheduleIdleClose(cacheKey, entry, options.idleTimeoutMs ?? getDefaultIdleTimeoutMs());
    }
  }

  async closeAll(): Promise<void> {
    const entries = [...this.sessions.entries()];
    this.sessions.clear();

    await Promise.allSettled(entries.map(async ([cacheKey, entry]) => {
      this.clearIdleTimer(entry);

      const session = await entry.sessionPromise.catch(() => null);
      await session?.close().catch(() => undefined);
      void cacheKey;
    }));
  }
}

export const globalMcpProcessSessionPool = new McpProcessSessionPool();

export async function closeGlobalMcpProcessSessions(): Promise<void> {
  await globalMcpProcessSessionPool.closeAll();
}