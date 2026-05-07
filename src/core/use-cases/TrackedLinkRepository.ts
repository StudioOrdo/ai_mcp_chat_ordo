import type {
  TrackedLink,
  TrackedLinkEvent,
  TrackedLinkEventAppendResult,
  TrackedLinkEventSeed,
  TrackedLinkPatch,
  TrackedLinkSeed,
  TrackedLinkTargetKind,
  TrackedLinkWithPerformance,
} from "@/core/entities/tracked-link";

export interface TrackedLinkRepository {
  create(seed: TrackedLinkSeed): Promise<TrackedLink>;
  findById(id: string): Promise<TrackedLink | null>;
  findByCode(code: string): Promise<TrackedLink | null>;
  listByOwnerUserId(ownerUserId: string): Promise<TrackedLink[]>;
  listByTarget(input: {
    ownerUserId: string;
    targetKind: TrackedLinkTargetKind;
    targetId: string;
  }): Promise<TrackedLink[]>;
  listWithPerformanceByOwnerUserId(ownerUserId: string): Promise<TrackedLinkWithPerformance[]>;
  update(id: string, patch: TrackedLinkPatch): Promise<TrackedLink | null>;
  appendEvent(seed: TrackedLinkEventSeed): Promise<TrackedLinkEventAppendResult>;
  listEventsByTrackedLinkId(trackedLinkId: string): Promise<TrackedLinkEvent[]>;
  listEventsByConversationIds(conversationIds: readonly string[]): Promise<TrackedLinkEvent[]>;
}
