import type { ChatMessage } from "@/core/entities/chat-message";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import type { JobStateEntry } from "@/hooks/chat/useJobStateStore";

export const KEITH_BASELINE_USER_ID = "usr_keith_firehose360";
export const KEITH_BASELINE_CONVERSATION_ID = "conv_keith_april_30";
export const KEITH_BASELINE_JOB_ID = "job_076cf2d0-dc0d-4581-a239-89c892f9ab76";
export const KEITH_BASELINE_TOOL_NAME = "admin_web_search";

export const KEITH_BASELINE_JOB_EVENTS = [
  { eventType: "queued", sequence: 1 },
  { eventType: "started", sequence: 2 },
  { eventType: "result", sequence: 3 },
] as const;

export const KEITH_BASELINE_RUNNING_PART: JobStatusMessagePart = {
  type: "job_status",
  jobId: KEITH_BASELINE_JOB_ID,
  toolName: KEITH_BASELINE_TOOL_NAME,
  label: "Admin Web Search",
  status: "running",
  sequence: 2,
  progressPercent: 40,
  progressLabel: "Searching the web",
  updatedAt: "2026-04-30T15:01:00.000Z",
};

export const KEITH_BASELINE_COMPLETED_PART: JobStatusMessagePart = {
  ...KEITH_BASELINE_RUNNING_PART,
  status: "succeeded",
  sequence: 3,
  progressPercent: 100,
  progressLabel: "Complete",
  summary: "Found current sources for the requested research.",
  resultPayload: {
    action: KEITH_BASELINE_TOOL_NAME,
    answer: "Sourced research summary.",
    citations: [],
    sources: ["https://example.com/source"],
  },
  updatedAt: "2026-04-30T15:04:00.000Z",
};

export function createKeithBaselineStatusRead(index: number): ChatMessage {
  const toolInvocationId = `toolu_status_${index}`;

  return {
    id: `msg_keith_status_${index}`,
    role: "assistant",
    content: "",
    timestamp: new Date(`2026-04-30T15:01:0${index}.000Z`),
    parts: [
      {
        type: "tool_call",
        name: "get_deferred_job_status",
        toolInvocationId,
        args: { job_id: KEITH_BASELINE_JOB_ID },
      },
      {
        type: "tool_result",
        name: "get_deferred_job_status",
        toolInvocationId,
        result: {
          ok: true,
          job: {
            messageId: `jobmsg_${KEITH_BASELINE_JOB_ID}`,
            conversationId: KEITH_BASELINE_CONVERSATION_ID,
            part: KEITH_BASELINE_RUNNING_PART,
          },
        },
      },
    ],
  };
}

export function createKeithBaselineTranscript(): ChatMessage[] {
  return [
    {
      id: "msg_keith_web_search",
      role: "assistant",
      content: "I started the web search.",
      timestamp: new Date("2026-04-30T15:00:00.000Z"),
      parts: [
        {
          type: "tool_call",
          name: KEITH_BASELINE_TOOL_NAME,
          toolInvocationId: "toolu_web_search_1",
          args: { query: "current market evidence" },
        },
        {
          type: "tool_result",
          name: KEITH_BASELINE_TOOL_NAME,
          toolInvocationId: "toolu_web_search_1",
          result: {
            action: KEITH_BASELINE_TOOL_NAME,
            jobId: KEITH_BASELINE_JOB_ID,
            status: "queued",
          },
        },
      ],
    },
    ...Array.from({ length: 5 }, (_, index) => createKeithBaselineStatusRead(index + 1)),
  ];
}

export function countRawStatusToolResults(messages: readonly ChatMessage[]): number {
  return messages.reduce((count, message) => {
    return count + (message.parts ?? []).filter((part) => part.type === "tool_result" && part.name === "get_deferred_job_status").length;
  }, 0);
}

export function createKeithBaselineJobStateEntries(): JobStateEntry[] {
  return [
    ...Array.from({ length: 5 }, () => jobStateEntryFromPart(KEITH_BASELINE_RUNNING_PART)),
    jobStateEntryFromPart(KEITH_BASELINE_COMPLETED_PART),
  ];
}

function jobStateEntryFromPart(part: JobStatusMessagePart): JobStateEntry {
  const updatedAt = part.updatedAt ?? "2026-04-30T15:00:00.000Z";
  return {
    jobId: part.jobId,
    conversationId: KEITH_BASELINE_CONVERSATION_ID,
    userId: KEITH_BASELINE_USER_ID,
    toolName: part.toolName,
    label: part.label,
    title: part.title,
    subtitle: part.subtitle,
    status: part.status,
    sequence: part.sequence ?? 0,
    progressPercent: part.progressPercent,
    progressLabel: part.progressLabel,
    summary: part.summary,
    error: part.error,
    createdAt: "2026-04-30T15:00:00.000Z",
    startedAt: null,
    completedAt: part.status === "succeeded" ? updatedAt : null,
    updatedAt,
    origin: {
      originMessageId: "msg_keith_web_search",
      fallback: "explicit_origin",
    },
    inputSnapshot: {},
    resultPayload: part.resultPayload,
    resultEnvelope: part.resultEnvelope ?? null,
    artifactRefs: part.resultEnvelope?.artifacts ?? [],
    materializationRefs: [],
    ownership: { userId: KEITH_BASELINE_USER_ID, visibility: "owner", initiatorType: "user" },
    failure: {
      failureClass: part.failureClass ?? null,
      recoveryMode: part.recoveryMode ?? null,
      nextRetryAt: part.nextRetryAt ?? null,
      lastCheckpointId: part.lastCheckpointId ?? null,
      replayedFromJobId: part.replayedFromJobId ?? null,
      supersededByJobId: part.supersededByJobId ?? null,
    },
  };
}
