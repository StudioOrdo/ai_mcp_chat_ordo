"use client";

import { useEffect, useRef, useState } from "react";

import type { StreamEvent } from "@/core/entities/chat-stream";
import type { JobHistoryEntry } from "@/lib/jobs/job-event-history";
import type { JobStatusSnapshot } from "@/lib/jobs/job-read-model";
import { extractJobStatusSnapshots } from "@/lib/jobs/job-status-snapshots";

import type { JobsWorkspaceStreamEvent } from "@/components/jobs/job-snapshot-reducer";

const JOBS_RECONCILE_LIMIT = 50;
const JOBS_HISTORY_LIMIT = 50;
const FALLBACK_RECONCILE_INTERVAL_MS = 15_000;

export type JobsSyncState = "live" | "reconnecting" | "fallback";

interface JobsReconcilePayload {
  jobs: JobStatusSnapshot[];
  selectedJobId: string | null;
  selectedJob: JobStatusSnapshot | null;
  selectedJobHistory: JobHistoryEntry[];
}

interface UseJobsEventStreamOptions {
  initialAfterSequence: number;
  selectedJobId: string | null;
  onEvent: (event: JobsWorkspaceStreamEvent) => void;
  onReconciled: (payload: JobsReconcilePayload) => void;
}

function isJobsWorkspaceStreamEvent(value: unknown): value is JobsWorkspaceStreamEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<StreamEvent> & {
    jobId?: unknown;
    conversationId?: unknown;
    sequence?: unknown;
    toolName?: unknown;
    label?: unknown;
  };
  const knownTypes = new Set([
    "job_queued",
    "job_started",
    "job_progress",
    "job_completed",
    "job_failed",
    "job_canceled",
  ]);

  return knownTypes.has(String(record.type))
    && typeof record.jobId === "string"
    && typeof record.conversationId === "string"
    && typeof record.sequence === "number"
    && typeof record.toolName === "string"
    && typeof record.label === "string";
}

async function reconcileJobsWorkspace(selectedJobId: string | null): Promise<JobsReconcilePayload> {
  const jobsResponse = await fetch(`/api/jobs?limit=${JOBS_RECONCILE_LIMIT}`, {
    credentials: "same-origin",
  });

  if (!jobsResponse.ok) {
    throw new Error(`Unable to refresh jobs (${jobsResponse.status})`);
  }

  const jobsPayload = await jobsResponse.json() as { jobs?: unknown };
  let jobs = extractJobStatusSnapshots(jobsPayload);
  let selectedJob = selectedJobId
    ? jobs.find((job) => job.part.jobId === selectedJobId) ?? null
    : null;
  let selectedJobHistory: JobHistoryEntry[] = [];

  if (selectedJobId) {
    const [selectedJobResponse, selectedHistoryResponse] = await Promise.all([
      fetch(`/api/jobs/${encodeURIComponent(selectedJobId)}`, {
        credentials: "same-origin",
      }),
      fetch(`/api/jobs/${encodeURIComponent(selectedJobId)}/events?limit=${JOBS_HISTORY_LIMIT}`, {
        credentials: "same-origin",
      }),
    ]);

    if (selectedJobResponse.ok) {
      const selectedJobPayload = await selectedJobResponse.json() as { job?: unknown };
      const [selectedSnapshot] = extractJobStatusSnapshots(selectedJobPayload);
      if (selectedSnapshot) {
        selectedJob = selectedSnapshot;
        if (!jobs.some((job) => job.part.jobId === selectedSnapshot.part.jobId)) {
          jobs = [selectedSnapshot, ...jobs];
        }
      }
    }

    if (selectedHistoryResponse.ok) {
      const selectedHistoryPayload = await selectedHistoryResponse.json() as { events?: JobHistoryEntry[] };
      selectedJobHistory = Array.isArray(selectedHistoryPayload.events)
        ? [...selectedHistoryPayload.events].sort((left, right) => left.sequence - right.sequence)
        : [];
    }
  }

  return {
    jobs,
    selectedJobId,
    selectedJob,
    selectedJobHistory,
  };
}

export function useJobsEventStream({
  initialAfterSequence,
  selectedJobId,
  onEvent,
  onReconciled,
}: UseJobsEventStreamOptions): JobsSyncState {
  const [syncState, setSyncState] = useState<JobsSyncState>(() => (
    typeof EventSource === "undefined" ? "fallback" : "reconnecting"
  ));
  const selectedJobIdRef = useRef(selectedJobId);
  const onEventRef = useRef(onEvent);
  const onReconciledRef = useRef(onReconciled);
  const lastSequenceRef = useRef(initialAfterSequence);

  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
    onEventRef.current = onEvent;
    onReconciledRef.current = onReconciled;
    lastSequenceRef.current = Math.max(lastSequenceRef.current, initialAfterSequence);
  }, [initialAfterSequence, onEvent, onReconciled, selectedJobId]);

  useEffect(() => {
    let disposed = false;

    const reconcile = async () => {
      try {
        const payload = await reconcileJobsWorkspace(selectedJobIdRef.current);
        if (disposed) {
          return;
        }

        lastSequenceRef.current = Math.max(
          lastSequenceRef.current,
          ...payload.jobs.map((job) => job.part.sequence ?? 0),
          ...payload.selectedJobHistory.map((entry) => entry.sequence),
        );
        onReconciledRef.current(payload);
        if (typeof EventSource === "undefined") {
          setSyncState("fallback");
        }
      } catch (error) {
        void error;
        if (!disposed) {
          setSyncState(typeof EventSource === "undefined" ? "fallback" : "reconnecting");
        }
      }
    };

    const reconcileOnFocus = () => {
      void reconcile();
    };

    const reconcileOnVisibility = () => {
      if (document.visibilityState === "visible") {
        void reconcile();
      }
    };

    window.addEventListener("focus", reconcileOnFocus);
    document.addEventListener("visibilitychange", reconcileOnVisibility);

    if (typeof EventSource === "undefined") {
      void reconcile();

      const timer = window.setInterval(() => {
        void reconcile();
      }, FALLBACK_RECONCILE_INTERVAL_MS);

      return () => {
        disposed = true;
        window.clearInterval(timer);
        window.removeEventListener("focus", reconcileOnFocus);
        document.removeEventListener("visibilitychange", reconcileOnVisibility);
      };
    }

    const source = new EventSource(`/api/jobs/events?afterSequence=${lastSequenceRef.current}`);

    source.onopen = () => {
      if (!disposed) {
        setSyncState("live");
      }
    };

    source.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data) as unknown;
        if (!isJobsWorkspaceStreamEvent(payload)) {
          return;
        }

        if (payload.sequence <= lastSequenceRef.current) {
          return;
        }

        lastSequenceRef.current = payload.sequence;
        onEventRef.current(payload);
        setSyncState("live");
      } catch (error) {
        void error;
        // Ignore malformed event payloads; the next reconcile will catch up if needed.
      }
    };

    source.onerror = () => {
      if (!disposed) {
        setSyncState("reconnecting");
        void reconcile();
      }
    };

    return () => {
      disposed = true;
      source.close();
      window.removeEventListener("focus", reconcileOnFocus);
      document.removeEventListener("visibilitychange", reconcileOnVisibility);
    };
  }, []);

  return syncState;
}