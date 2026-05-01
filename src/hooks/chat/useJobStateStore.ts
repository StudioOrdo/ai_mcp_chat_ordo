import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import { mergeJobSnapshots } from "@/lib/jobs/job-snapshot-state";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";

export type JobStateEntry = CanonicalJobSnapshot;
export type WorkflowStateEntry = CanonicalMediaWorkflowSnapshot;

function mergeWorkflowSnapshots(
  current: readonly CanonicalMediaWorkflowSnapshot[],
  incoming: readonly CanonicalMediaWorkflowSnapshot[],
): CanonicalMediaWorkflowSnapshot[] {
  const byId = new Map<string, CanonicalMediaWorkflowSnapshot>();

  for (const workflow of current) {
    byId.set(workflow.workflowId, workflow);
  }

  for (const workflow of incoming) {
    byId.set(workflow.workflowId, workflow);
  }

  return [...byId.values()].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function useJobStateStore(
  conversationId: string | null,
  seededSnapshots: readonly CanonicalJobSnapshot[] = [],
) {
  const [liveSnapshots, setLiveSnapshots] = useState<CanonicalJobSnapshot[]>([]);
  const previousConversationIdRef = useRef<string | null>(conversationId);

  useEffect(() => {
    const conversationChanged = previousConversationIdRef.current !== conversationId;
    previousConversationIdRef.current = conversationId;

    setLiveSnapshots((current) => {
      if (!conversationId) {
        return current.length === 0 ? current : [];
      }

      if (conversationChanged) {
        return [];
      }

      return current;
    });
  }, [conversationId]);

  const upsertJobStateEntries = useCallback((incomingSnapshots: readonly CanonicalJobSnapshot[]) => {
    setLiveSnapshots((current) => {
      if (!conversationId) {
        return [];
      }

      return mergeJobSnapshots(current, incomingSnapshots);
    });
  }, [conversationId]);

  const jobStateEntries = useMemo(() => {
    return mergeJobSnapshots(seededSnapshots, liveSnapshots);
  }, [liveSnapshots, seededSnapshots]);

  return {
    jobStateEntries,
    upsertJobStateEntries,
  };
}

export function useWorkflowStateStore(
  conversationId: string | null,
  seededSnapshots: readonly CanonicalMediaWorkflowSnapshot[] = [],
) {
  const [liveSnapshots, setLiveSnapshots] = useState<CanonicalMediaWorkflowSnapshot[]>([]);
  const previousConversationIdRef = useRef<string | null>(conversationId);

  useEffect(() => {
    const conversationChanged = previousConversationIdRef.current !== conversationId;
    previousConversationIdRef.current = conversationId;

    setLiveSnapshots((current) => {
      if (!conversationId) {
        return current.length === 0 ? current : [];
      }

      if (conversationChanged) {
        return [];
      }

      return current;
    });
  }, [conversationId]);

  const upsertWorkflowStateEntries = useCallback((incomingSnapshots: readonly CanonicalMediaWorkflowSnapshot[]) => {
    setLiveSnapshots((current) => {
      if (!conversationId) {
        return [];
      }

      return mergeWorkflowSnapshots(current, incomingSnapshots);
    });
  }, [conversationId]);

  const workflowStateEntries = useMemo(() => {
    return mergeWorkflowSnapshots(seededSnapshots, liveSnapshots);
  }, [liveSnapshots, seededSnapshots]);

  return {
    workflowStateEntries,
    upsertWorkflowStateEntries,
  };
}
