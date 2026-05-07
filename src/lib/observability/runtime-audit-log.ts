import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { redactSecrets } from "@/lib/observability/secret-redaction";

export type RuntimeAuditCategory = "deferred_job" | "native_process" | "remote_service" | "mcp_process";

interface RuntimeAuditRecord {
  timestamp: string;
  category: RuntimeAuditCategory;
  event: string;
  context: Record<string, unknown>;
}

let logDirPromise: Promise<string> | null = null;

export function resolveRuntimeAuditLogDir(baseDir = process.cwd()): string {
  return process.env.ORDO_RUNTIME_AUDIT_LOG_DIR?.trim() || path.join(baseDir, ".runtime-logs");
}

function getRuntimeAuditLogDir(): Promise<string> {
  if (!logDirPromise) {
    const logDir = resolveRuntimeAuditLogDir();
    logDirPromise = mkdir(logDir, { recursive: true }).then(() => logDir);
  }

  return logDirPromise;
}

export function resolveRuntimeAuditLogFilePath(category: RuntimeAuditCategory, baseDir = process.cwd()): string {
  return path.join(resolveRuntimeAuditLogDir(baseDir), `${category}.jsonl`);
}

function getLogFilePath(logDir: string, category: RuntimeAuditCategory): string {
  return path.join(logDir, `${category}.jsonl`);
}

function normalizeValue(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {}),
    };
  }

  if (Array.isArray(value)) {
    if (depth >= 4) {
      return `[array(${value.length})]`;
    }

    return value.slice(0, 25).map((entry) => normalizeValue(entry, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= 4) {
      return "[object]";
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).slice(0, 50).map(([key, entry]) => [key, normalizeValue(entry, depth + 1)]),
    );
  }

  return String(value);
}

export async function appendRuntimeAuditLog(
  category: RuntimeAuditCategory,
  event: string,
  context: Record<string, unknown>,
): Promise<void> {
  try {
    const logDir = await getRuntimeAuditLogDir();
    const record: RuntimeAuditRecord = {
      timestamp: new Date().toISOString(),
      category,
      event,
      context: redactSecrets(normalizeValue(context)).value as Record<string, unknown>,
    };

    await appendFile(getLogFilePath(logDir, category), `${JSON.stringify(record)}\n`, "utf8");
  } catch {
    // Audit logging is best-effort and must never break the runtime path.
  }
}
