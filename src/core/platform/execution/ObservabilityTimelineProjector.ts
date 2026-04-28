import { readFile } from "node:fs/promises";

import type { ExecutionLifecycleState, ExecutionTimeline, ExecutionTimelineEvent } from "@/core/platform/execution/ExecutionTimeline";
import { createUnsupportedExecutionTimeline } from "@/core/platform/execution/ExecutionTimelineProjector";
import { resolveRuntimeAuditLogFilePath, type RuntimeAuditCategory } from "@/lib/observability/runtime-audit-log";

interface RuntimeAuditRecord {
  timestamp: string;
  category: RuntimeAuditCategory;
  event: string;
  context: Record<string, unknown>;
}

const CATEGORY_CONTEXT_KEYS: Record<RuntimeAuditCategory, string> = {
  deferred_job: "jobId",
  native_process: "processId",
  remote_service: "serviceId",
  mcp_process: "targetId",
};

function parseExecutionId(executionId: string): { category: RuntimeAuditCategory; targetId: string } | null {
  const separatorIndex = executionId.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }

  const category = executionId.slice(0, separatorIndex) as RuntimeAuditCategory;
  const targetId = executionId.slice(separatorIndex + 1).trim();
  if (!targetId || !(category in CATEGORY_CONTEXT_KEYS)) {
    return null;
  }

  return { category, targetId };
}

function mapEventState(event: string): ExecutionLifecycleState {
  if (/(failed|handler_missing)/.test(event)) {
    return "failed";
  }

  if (/(succeeded|completed)/.test(event)) {
    return "succeeded";
  }

  if (/(canceled)/.test(event)) {
    return "canceled";
  }

  if (/(retry_scheduled|lease_recovered)/.test(event)) {
    return "queued";
  }

  if (/(started|progress|initialize|call)/.test(event)) {
    return "running";
  }

  return "unknown";
}

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function mapRecordToEvent(record: RuntimeAuditRecord, index: number): ExecutionTimelineEvent {
  return {
    id: `${record.category}_${index}_${record.event}`,
    timestamp: record.timestamp,
    eventType: record.event,
    title: titleCase(record.event),
    state: mapEventState(record.event),
    source: "durable",
    details: record.context,
  };
}

async function readRuntimeAuditRecords(category: RuntimeAuditCategory): Promise<RuntimeAuditRecord[]> {
  try {
    const filePath = resolveRuntimeAuditLogFilePath(category);
    const content = await readFile(filePath, "utf8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as RuntimeAuditRecord)
      .filter((record) => record.category === category);
  } catch {
    return [];
  }
}

export async function projectObservabilityExecutionTimeline(executionId: string): Promise<ExecutionTimeline> {
  const parsed = parseExecutionId(executionId);
  if (!parsed) {
    return createUnsupportedExecutionTimeline({
      executionId,
      executionKind: "observability",
      title: "Observability execution",
      summary: "Observability execution ids must use the <category>:<targetId> format for persisted runtime audit logs.",
    });
  }

  const records = await readRuntimeAuditRecords(parsed.category);
  const contextKey = CATEGORY_CONTEXT_KEYS[parsed.category];
  const matching = records.filter((record) => record.context[contextKey] === parsed.targetId);

  if (matching.length === 0) {
    return createUnsupportedExecutionTimeline({
      executionId,
      executionKind: "observability",
      title: "Observability execution",
      summary: "No persisted runtime audit log records were found for this execution.",
    });
  }

  const events = matching.map(mapRecordToEvent);
  const lastRecord = matching[matching.length - 1];

  return {
    executionId,
    executionKind: "observability",
    supportLevel: "limited",
    state: mapEventState(lastRecord?.event ?? "unknown"),
    title: `${titleCase(parsed.category)} execution ${parsed.targetId}`,
    summary: `Persisted runtime audit trail with ${matching.length} event${matching.length === 1 ? "" : "s"}.`,
    conversationId: typeof lastRecord?.context.conversationId === "string" ? lastRecord.context.conversationId : undefined,
    userId: typeof lastRecord?.context.userId === "string" ? lastRecord.context.userId : null,
    startedAt: matching[0]?.timestamp,
    completedAt: mapEventState(lastRecord?.event ?? "unknown") === "succeeded" ? lastRecord.timestamp : null,
    updatedAt: lastRecord?.timestamp,
    events,
    artifacts: [],
    checkpoints: [],
    nextActions: [],
    metadata: {
      category: parsed.category,
      targetId: parsed.targetId,
      identifierKey: contextKey,
    },
  };
}