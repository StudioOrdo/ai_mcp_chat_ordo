import fs from "node:fs/promises";
import path from "node:path";
import { CAPABILITY_CATALOG } from "@/core/capability-catalog/catalog";
import { buildCatalogBoundToolDescriptor } from "@/core/capability-catalog/runtime-tool-projection";

interface InspectRuntimeLogsInput {
  log_file: "deferred_job" | "mcp_process" | "native_process" | "remote_service";
  limit?: number;
  level?: "info" | "warn" | "error";
  grep?: string;
}

interface InspectRuntimeLogsOutput {
  lines: Array<Record<string, unknown>>;
  total_scanned: number;
  matched: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeInspectRuntimeLogsInput(value: unknown): InspectRuntimeLogsInput {
  if (!isRecord(value)) {
    throw new Error("Invalid input: must be an object");
  }

  const validLogFiles = ["deferred_job", "mcp_process", "native_process", "remote_service"];
  if (typeof value.log_file !== "string" || !validLogFiles.includes(value.log_file)) {
    throw new Error(`Invalid log_file. Must be one of: ${validLogFiles.join(", ")}`);
  }

  const input: InspectRuntimeLogsInput = {
    log_file: value.log_file as InspectRuntimeLogsInput["log_file"],
  };

  if (typeof value.limit === "number") {
    input.limit = Math.min(Math.max(1, value.limit), 200);
  }

  if (typeof value.level === "string" && ["info", "warn", "error"].includes(value.level)) {
    input.level = value.level as InspectRuntimeLogsInput["level"];
  }

  if (typeof value.grep === "string" && value.grep.trim().length > 0) {
    input.grep = value.grep.trim();
  }

  return input;
}

export async function executeInspectRuntimeLogs(input: InspectRuntimeLogsInput): Promise<InspectRuntimeLogsOutput> {
  const logsDir = path.join(process.cwd(), ".runtime-logs");
  const filePath = path.join(logsDir, `${input.log_file}.jsonl`);

  let content = "";
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { lines: [], total_scanned: 0, matched: 0 };
    }
    throw new Error(`Failed to read log file: ${input.log_file}.jsonl`);
  }

  const rawLines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  const total_scanned = rawLines.length;
  
  // Reverse to get newest first
  rawLines.reverse();

  const matchedLines: Array<Record<string, unknown>> = [];
  const limit = input.limit ?? 50;

  for (const rawLine of rawLines) {
    if (matchedLines.length >= limit) break;

    // Fast grep before parsing JSON if grep is provided
    if (input.grep && !rawLine.includes(input.grep)) {
      continue;
    }

    try {
      const parsed = JSON.parse(rawLine) as Record<string, unknown>;

      // Filter by level if provided
      if (input.level) {
        // Some logs use 'level' property, others might not have it explicitly but we can check if it exists
        // E.g. {"level":"error"} or inside context
        const lineLevel = (parsed.level as string) || "info"; // default to info if not present
        if (lineLevel !== input.level) {
          // If filtering for error, also check if event is 'error' or 'failed'
          const event = parsed.event as string | undefined;
          const isErrorEvent = event && (event.includes("error") || event.includes("fail") || event === "error");
          
          if (input.level === "error" && isErrorEvent) {
            // Keep it if it's an error event even if level property is missing
          } else {
            continue;
          }
        }
      }

      matchedLines.push(parsed);
    } catch {
      // If a line is somehow invalid JSON, just skip it
      continue;
    }
  }

  return {
    lines: matchedLines,
    total_scanned,
    matched: matchedLines.length,
  };
}

export const inspectRuntimeLogsTool = buildCatalogBoundToolDescriptor(CAPABILITY_CATALOG.inspect_runtime_logs, {
  parse: sanitizeInspectRuntimeLogsInput,
  execute: (input) => executeInspectRuntimeLogs(input),
});
