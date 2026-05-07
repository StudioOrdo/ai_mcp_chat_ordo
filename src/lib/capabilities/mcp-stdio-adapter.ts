import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type { ExecutionTargetAdapter } from "./executor-dispatch";
import {
  globalMcpProcessSessionPool,
  type McpProcessSessionPool,
} from "./mcp-process-runtime";

const CONTAINER_PROJECT_ROOT = "/app";
const execFileAsync = promisify(execFile);

function resolveProjectRoot(): string {
  const candidates = [
    process.env.ORDO_PROJECT_ROOT,
    process.cwd(),
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (existsSync(path.join(resolved, "package.json"))) {
      return resolved;
    }
  }

  throw new Error(
    "Unable to resolve Ordo project root for local MCP stdio execution. "
    + "Start the app from the repository root or set ORDO_PROJECT_ROOT.",
  );
}

function resolveLocalTsxBinary(projectRoot: string): string {
  return path.join(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsx.cmd" : "tsx",
  );
}

export interface LocalMcpStdioToolConfig<TResult = unknown> {
  entrypoint: string;
  toolName: string;
  targetId?: string;
  idleTimeoutMs?: number;
  sessionPool?: McpProcessSessionPool;
  parseResult?: (value: unknown) => TResult;
}

export interface LocalMcpContainerToolConfig<TResult = unknown> {
  serviceName: string;
  toolName: string;
  command: string;
  args: string[];
  targetId?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  idleTimeoutMs?: number;
  sessionPool?: McpProcessSessionPool;
  parseResult?: (value: unknown) => TResult;
}

export interface ManagedMcpProcessToolConfig<
  TResult = unknown,
  TKind extends "mcp_stdio" | "mcp_container" = "mcp_stdio",
> {
  kind: TKind;
  targetId: string;
  toolName: string;
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  getEnv?: () => NodeJS.ProcessEnv;
  prepareLaunch?: () => Promise<void>;
  idleTimeoutMs?: number;
  sessionPool?: McpProcessSessionPool;
  parseResult?: (value: unknown) => TResult;
}

export interface ComposeBackedMcpContainerToolConfig<TResult = unknown> {
  serviceName: string;
  entrypoint: string;
  toolName: string;
  targetId?: string;
  composeProjectRoot?: string;
  containerProjectRoot?: string;
  idleTimeoutMs?: number;
  sessionPool?: McpProcessSessionPool;
  parseResult?: (value: unknown) => TResult;
}

function createSpawnEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  ) as NodeJS.ProcessEnv;
}

function createMergedSpawnEnv(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...createSpawnEnv(),
    ...env,
  };
}

async function runHostCommand(command: string, args: string[], cwd: string): Promise<void> {
  try {
    await execFileAsync(command, args, {
      cwd,
      env: createSpawnEnv(),
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Execution target host command failed: ${command} ${args.join(" ")} (${details})`,
    );
  }
}

function isTextContentBlock(value: unknown): value is { type: "text"; text: string } {
  return typeof value === "object"
    && value !== null
    && "type" in value
    && value.type === "text"
    && "text" in value
    && typeof value.text === "string";
}

export function parseJsonTextResult<TResult>(value: unknown): TResult {
  const content = (value as { content?: unknown } | null)?.content;

  if (!Array.isArray(content)) {
    throw new Error("Expected MCP tool result content to be an array.");
  }

  const textBlock = content.find(isTextContentBlock);
  if (!textBlock) {
    throw new Error("Expected text content in MCP tool result.");
  }

  return JSON.parse(textBlock.text) as TResult;
}

export function createManagedMcpProcessExecutionTargetAdapter<
  TResult = unknown,
  TKind extends "mcp_stdio" | "mcp_container" = "mcp_stdio",
>(
  config: ManagedMcpProcessToolConfig<TResult, TKind>,
): ExecutionTargetAdapter<TKind, TResult> {
  return {
    kind: config.kind,
    invoke: async (request) => {
      const bridgedArguments = {
        ...(request.input as Record<string, unknown>),
        __executionContext: request.context
          ? {
              userId: request.context.userId,
              role: request.context.role,
              conversationId: request.context.conversationId,
              toolInvocationId: request.context.toolInvocationId,
            }
          : undefined,
      };
      const result = await (config.sessionPool ?? globalMcpProcessSessionPool).callTool(
        {
          targetId: config.targetId,
          command: config.command,
          args: config.args,
          cwd: config.cwd,
          env: config.getEnv ? config.getEnv() : config.env,
          prepareLaunch: config.prepareLaunch,
          idleTimeoutMs: config.idleTimeoutMs,
          stderr: "pipe",
        },
        {
          name: config.toolName,
          arguments: bridgedArguments,
        },
      );

      return config.parseResult ? config.parseResult(result) : parseJsonTextResult<TResult>(result);
    },
  };
}

export function createLocalMcpStdioExecutionTargetAdapter<TResult = unknown>(
  config: LocalMcpStdioToolConfig<TResult>,
): ExecutionTargetAdapter<"mcp_stdio", TResult> {
  const projectRoot = resolveProjectRoot();

  return createManagedMcpProcessExecutionTargetAdapter({
    kind: "mcp_stdio",
    targetId: config.targetId ?? `mcp_stdio:${config.toolName}:${config.entrypoint}`,
    toolName: config.toolName,
    command: resolveLocalTsxBinary(projectRoot),
    args: [config.entrypoint],
    cwd: projectRoot,
    getEnv: createSpawnEnv,
    idleTimeoutMs: config.idleTimeoutMs,
    sessionPool: config.sessionPool,
    parseResult: config.parseResult,
  });
}

export function createLocalMcpContainerExecutionTargetAdapter<TResult = unknown>(
  config: LocalMcpContainerToolConfig<TResult>,
): ExecutionTargetAdapter<"mcp_container", TResult> {
  const projectRoot = resolveProjectRoot();

  return createManagedMcpProcessExecutionTargetAdapter({
    kind: "mcp_container",
    targetId: config.targetId ?? `mcp_container:${config.serviceName}:${config.toolName}`,
    toolName: config.toolName,
    command: config.command,
    args: config.args,
    cwd: config.cwd ?? projectRoot,
    getEnv: () => createMergedSpawnEnv(config.env),
    idleTimeoutMs: config.idleTimeoutMs,
    sessionPool: config.sessionPool,
    parseResult: config.parseResult,
  });
}

export function createComposeBackedMcpContainerExecutionTargetAdapter<TResult = unknown>(
  config: ComposeBackedMcpContainerToolConfig<TResult>,
): ExecutionTargetAdapter<"mcp_container", TResult> {
  const composeProjectRoot = config.composeProjectRoot ?? resolveProjectRoot();
  const containerProjectRoot = config.containerProjectRoot ?? CONTAINER_PROJECT_ROOT;
  const containerTsxBinary = path.posix.join(containerProjectRoot, "node_modules", ".bin", "tsx");
  const containerEntrypoint = path.posix.join(containerProjectRoot, config.entrypoint);

  return createManagedMcpProcessExecutionTargetAdapter({
    kind: "mcp_container",
    targetId: config.targetId ?? `mcp_container:${config.serviceName}:${config.toolName}`,
    toolName: config.toolName,
    command: "docker",
    args: [
      "compose",
      "exec",
      "-T",
      config.serviceName,
      containerTsxBinary,
      containerEntrypoint,
    ],
    cwd: composeProjectRoot,
    getEnv: createSpawnEnv,
    prepareLaunch: async () => {
      await runHostCommand(
        "docker",
        ["compose", "up", "-d", "--build", "--no-deps", config.serviceName],
        composeProjectRoot,
      );
    },
    idleTimeoutMs: config.idleTimeoutMs,
    sessionPool: config.sessionPool,
    parseResult: config.parseResult,
  });
}
