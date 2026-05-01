import { useEffect } from "react";
import type { Dispatch } from "react";
import {
  ConversationIdParser,
  EventParser,
  ErrorParser,
  JobCompletedParser,
  JobCanceledParser,
  JobFailedParser,
  JobProgressParser,
  JobQueuedParser,
  JobStartedParser,
} from "@/adapters/chat/EventParserStrategy";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import { buildJobSnapshotFromStreamEvent } from "@/lib/jobs/job-snapshot-state";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";
import { createChatStreamProcessor } from "./chatStreamProcessor";
import type { ChatAction } from "./chatState";
import type { StreamEvent } from "@/core/entities/chat-stream";
import type { JobStateEntry } from "./useJobStateStore";

const parser = new EventParser([
  new ConversationIdParser(),
  new JobQueuedParser(),
  new JobStartedParser(),
  new JobProgressParser(),
  new JobCompletedParser(),
  new JobCanceledParser(),
  new JobFailedParser(),
  new ErrorParser(),
]);

const processor = createChatStreamProcessor();
const MISSING_CONVERSATION_RETRY_DELAY_MS = 5_000;
const CHAT_JOB_REHYDRATE_LIMIT = 50;
export const CHAT_JOB_RECONCILE_INTERVAL_MS = 15_000;

interface UseChatJobEventsOptions {
  conversationId: string | null;
  dispatch: Dispatch<ChatAction>;
  upsertJobStateEntries?: (entries: readonly JobStateEntry[]) => void;
  upsertWorkflowStateEntries?: (entries: readonly CanonicalMediaWorkflowSnapshot[]) => void;
}

interface JobSnapshotResponse {
  jobs?: CanonicalJobSnapshot[];
  workflows?: CanonicalMediaWorkflowSnapshot[];
}

type JobStreamEvent = Extract<StreamEvent, { sequence: number; jobId: string }>;

type ReconcileResult =
  | { status: "ok"; maxSequence: number }
  | { status: "missing" | "error"; maxSequence?: undefined };

function isJobStreamEvent(event: StreamEvent): event is JobStreamEvent {
  return event.type === "job_queued"
    || event.type === "job_started"
    || event.type === "job_progress"
    || event.type === "job_completed"
    || event.type === "job_canceled"
    || event.type === "job_failed";
}

function getMaxSnapshotSequence(jobs: readonly CanonicalJobSnapshot[]): number {
  return jobs.reduce((maxSequence, job) => {
    const sequence = job.sequence;
    return typeof sequence === "number" ? Math.max(maxSequence, sequence) : maxSequence;
  }, 0);
}

async function reconcileDeferredJobs(
  conversationId: string,
  dispatch: Dispatch<ChatAction>,
  upsertJobStateEntries?: (entries: readonly JobStateEntry[]) => void,
  upsertWorkflowStateEntries?: (entries: readonly CanonicalMediaWorkflowSnapshot[]) => void,
): Promise<ReconcileResult> {
  try {
    const response = await fetch(
      `/api/chat/jobs?conversationId=${encodeURIComponent(conversationId)}&limit=${CHAT_JOB_REHYDRATE_LIMIT}`,
      { credentials: "same-origin" },
    );

    if (response.status === 404) {
      return { status: "missing" };
    }

    if (!response.ok) {
      return { status: "error" };
    }

    const payload = await response.json() as JobSnapshotResponse;
    const jobs = payload.jobs ?? [];
    const workflows = payload.workflows ?? [];
    upsertJobStateEntries?.(jobs);
    upsertWorkflowStateEntries?.(workflows);
    void dispatch;
    return { status: "ok", maxSequence: getMaxSnapshotSequence(jobs) };
  } catch {
    // Reconciliation is best-effort and should not interrupt chat.
    return { status: "error" };
  }
}

export function useChatJobEvents({ conversationId, dispatch, upsertJobStateEntries, upsertWorkflowStateEntries }: UseChatJobEventsOptions): void {
  useEffect(() => {
    if (!conversationId) {
      return;
    }

    let missingConversationBackoffUntil = 0;
    let lastSequence = 0;
    let disposed = false;
    let source: EventSource | null = null;

    const reconcile = async () => {
      if (Date.now() < missingConversationBackoffUntil) {
        return;
      }

      const result = await reconcileDeferredJobs(conversationId, dispatch, upsertJobStateEntries, upsertWorkflowStateEntries);
      if (result.status === "missing") {
        missingConversationBackoffUntil = Date.now() + MISSING_CONVERSATION_RETRY_DELAY_MS;
        return;
      }

      if (result.status === "ok") {
        missingConversationBackoffUntil = 0;
        lastSequence = Math.max(lastSequence, result.maxSequence);
      }
    };

    const handleMessage = (message: MessageEvent<string>) => {
      try {
        const raw = JSON.parse(message.data) as Record<string, unknown>;
        const event = parser.parse(raw);
        if (!event) {
          return;
        }

        if (isJobStreamEvent(event)) {
          if (event.sequence <= lastSequence) {
            return;
          }

          lastSequence = event.sequence;

          upsertJobStateEntries?.([buildJobSnapshotFromStreamEvent(event)]);
        }

        processor.process(event, {
          dispatch,
          assistantIndex: -1,
        });
      } catch {
        console.warn("Invalid job event payload", message.data);
      }
    };

    const openSource = () => {
      if (typeof EventSource === "undefined") {
        return;
      }

      source?.close();
      source = new EventSource(
        `/api/chat/events?conversationId=${encodeURIComponent(conversationId)}&afterSequence=${lastSequence}`,
      );
      source.onmessage = handleMessage;
      source.onerror = reconcileOnError;
    };

    const reconcileAndReopen = async () => {
      await reconcile();
      if (!disposed) {
        openSource();
      }
    };

    function reconcileOnError() {
      void reconcileAndReopen();
    }

    const reconcileOnFocus = () => {
      void reconcile();
    };

    const reconcileOnVisibility = () => {
      if (document.visibilityState === "visible") {
        void reconcile();
      }
    };

    const periodicReconcileId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void reconcile();
      }
    }, CHAT_JOB_RECONCILE_INTERVAL_MS);

    window.addEventListener("focus", reconcileOnFocus);
    document.addEventListener("visibilitychange", reconcileOnVisibility);

    const start = async () => {
      await reconcile();
      if (disposed) {
        return;
      }

      openSource();
    };

    void start();

    return () => {
      disposed = true;
      window.removeEventListener("focus", reconcileOnFocus);
      document.removeEventListener("visibilitychange", reconcileOnVisibility);
      window.clearInterval(periodicReconcileId);
      source?.close();
    };
  }, [conversationId, dispatch, upsertJobStateEntries, upsertWorkflowStateEntries]);
}
