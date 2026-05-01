import { spawn } from "node:child_process";

import type { ExecutionTargetAdapter } from "./executor-dispatch";
import type {
  NativeProcessExecutionTarget,
  RemoteServiceExecutionTarget,
} from "./execution-targets";
import { appendRuntimeAuditLog } from "@/lib/observability/runtime-audit-log";

interface ExternalTargetExecutionContext {
  userId?: string;
  role?: string;
  conversationId?: string;
  toolInvocationId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildExternalTargetInput(
  input: unknown,
  context?: ExternalTargetExecutionContext,
): unknown {
  const bridgedExecutionContext = context
    ? {
        userId: context.userId,
        role: context.role,
        conversationId: context.conversationId,
        toolInvocationId: context.toolInvocationId,
      }
    : undefined;

  if (!bridgedExecutionContext) {
    return input;
  }

  if (isRecord(input)) {
    return {
      ...input,
      __executionContext: bridgedExecutionContext,
    };
  }

  return {
    value: input,
    __executionContext: bridgedExecutionContext,
  };
}

function buildRemoteServiceInput(
  input: unknown,
  context: ExternalTargetExecutionContext | undefined,
  bridgeExecutionContext: boolean,
): unknown {
  if (!bridgeExecutionContext) {
    return input;
  }

  return buildExternalTargetInput(input, context);
}

async function runNativeProcessJson(
  target: NativeProcessExecutionTarget,
  input: unknown,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(target.command, target.args, {
      cwd: target.cwd,
      env: {
        ...process.env,
        ...target.env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let settled = false;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      if (!settled) {
        settled = true;
        reject(new Error(`Native process target "${target.processId}" timed out after ${timeoutMs}ms.`));
      }
    }, timeoutMs);
    timer.unref?.();

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(String(chunk));
    });
    child.stderr.on("data", (chunk) => {
      stderrChunks.push(String(chunk));
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (settled) {
        return;
      }

      settled = true;
      if (code !== 0) {
        reject(new Error(
          `Native process target "${target.processId}" exited with code ${code ?? "unknown"}`
          + `${signal ? ` (signal: ${signal})` : ""}: ${stderrChunks.join("").trim() || stdoutChunks.join("").trim() || "no output"}`,
        ));
        return;
      }

      resolve(stdoutChunks.join("").trim());
    });

    child.stdin.end(JSON.stringify(input));
  });
}

async function parseJsonStdout<TResult>(stdout: string, processId: string): Promise<TResult> {
  try {
    return JSON.parse(stdout) as TResult;
  } catch (error) {
    throw new Error(
      `Native process target "${processId}" returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export interface NativeProcessExecutionTargetAdapterConfig<TResult = unknown> {
  timeoutMs?: number;
  runProcess?: (target: NativeProcessExecutionTarget, input: unknown, timeoutMs: number) => Promise<string>;
  parseStdout?: (stdout: string, target: NativeProcessExecutionTarget) => Promise<TResult> | TResult;
}

export function createNativeProcessExecutionTargetAdapter<TResult = unknown>(
  config: NativeProcessExecutionTargetAdapterConfig<TResult> = {},
): ExecutionTargetAdapter<"native_process", TResult> {
  return {
    kind: "native_process",
    invoke: async (request) => {
      const timeoutMs = request.target.timeoutMs ?? config.timeoutMs ?? 30_000;
      await appendRuntimeAuditLog("native_process", "invoke_started", {
        processId: request.target.processId,
        command: request.target.command,
        args: request.target.args,
        conversationId: request.context?.conversationId,
        userId: request.context?.userId,
        toolInvocationId: request.context?.toolInvocationId,
        timeoutMs,
      });

      let stdout: string;

      try {
        stdout = await (config.runProcess ?? runNativeProcessJson)(
          request.target,
          buildExternalTargetInput(request.input, request.context),
          timeoutMs,
        );
      } catch (error) {
        await appendRuntimeAuditLog("native_process", "invoke_failed", {
          processId: request.target.processId,
          command: request.target.command,
          conversationId: request.context?.conversationId,
          userId: request.context?.userId,
          toolInvocationId: request.context?.toolInvocationId,
          timeoutMs,
          error,
        });
        throw error;
      }

      const result = config.parseStdout
        ? await config.parseStdout(stdout, request.target)
        : await parseJsonStdout<TResult>(stdout, request.target.processId);

      await appendRuntimeAuditLog("native_process", "invoke_succeeded", {
        processId: request.target.processId,
        command: request.target.command,
        conversationId: request.context?.conversationId,
        userId: request.context?.userId,
        toolInvocationId: request.context?.toolInvocationId,
        timeoutMs,
        result,
      });

      return result;
    },
  };
}

export interface RemoteServiceExecutionTargetAdapterConfig<TResult = unknown> {
  fetchImpl?: typeof fetch;
  parseResponse?: (response: Response, target: RemoteServiceExecutionTarget) => Promise<TResult> | TResult;
  timeoutMs?: number;
}

export function createRemoteServiceExecutionTargetAdapter<TResult = unknown>(
  config: RemoteServiceExecutionTargetAdapterConfig<TResult> = {},
): ExecutionTargetAdapter<"remote_service", TResult> {
  return {
    kind: "remote_service",
    invoke: async (request) => {
      const fetchImpl = config.fetchImpl ?? fetch;
      const controller = new AbortController();
      const timeoutMs = request.target.timeoutMs ?? config.timeoutMs ?? 30_000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      timer.unref?.();

      await appendRuntimeAuditLog("remote_service", "invoke_started", {
        serviceId: request.target.serviceId,
        endpoint: request.target.endpoint,
        method: request.target.method,
        conversationId: request.context?.conversationId,
        userId: request.context?.userId,
        toolInvocationId: request.context?.toolInvocationId,
        timeoutMs,
      });

      try {
        const response = await fetchImpl(request.target.endpoint, {
          method: request.target.method,
          headers: {
            "content-type": "application/json",
            ...request.target.headers,
          },
          body: JSON.stringify(buildRemoteServiceInput(
            request.input,
            request.context,
            request.target.bridgeExecutionContext,
          )),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Remote service target "${request.target.serviceId}" responded with ${response.status}: ${await response.text()}`,
          );
        }

        const result = config.parseResponse
          ? await config.parseResponse(response, request.target)
          : await response.json() as TResult;

        await appendRuntimeAuditLog("remote_service", "invoke_succeeded", {
          serviceId: request.target.serviceId,
          endpoint: request.target.endpoint,
          method: request.target.method,
          conversationId: request.context?.conversationId,
          userId: request.context?.userId,
          toolInvocationId: request.context?.toolInvocationId,
          timeoutMs,
          result,
        });

        return result;
      } catch (error) {
        await appendRuntimeAuditLog("remote_service", "invoke_failed", {
          serviceId: request.target.serviceId,
          endpoint: request.target.endpoint,
          method: request.target.method,
          conversationId: request.context?.conversationId,
          userId: request.context?.userId,
          toolInvocationId: request.context?.toolInvocationId,
          timeoutMs,
          error,
        });
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}