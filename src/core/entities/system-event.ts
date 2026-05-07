export const SYSTEM_EVENT_VISIBILITIES = ["public", "owner", "admin"] as const;
export type SystemEventVisibility = typeof SYSTEM_EVENT_VISIBILITIES[number];

export interface SystemEventObjectRef {
  kind: string;
  id: string;
  label?: string;
}

export interface SystemEventSourceRef {
  sourceKind: string;
  sourceId: string;
  label?: string;
  href?: string;
}

export interface SystemEvent {
  id: string;
  sequence: number;
  type: string;
  occurredAt: string;
  actorUserId: string | null;
  ownerUserId: string | null;
  objectRef: SystemEventObjectRef | null;
  sectionIds: string[];
  visibility: SystemEventVisibility;
  summary: string;
  sourceRefs: SystemEventSourceRef[];
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CreateSystemEventInput {
  id?: string;
  type: string;
  occurredAt?: string;
  actorUserId?: string | null;
  ownerUserId?: string | null;
  objectRef?: SystemEventObjectRef | null;
  sectionIds: string[];
  visibility: SystemEventVisibility;
  summary: string;
  sourceRefs?: SystemEventSourceRef[];
  payload?: Record<string, unknown>;
}

export interface SystemEventViewer {
  userId?: string | null;
  role?: string | null;
}

export function isSystemEventVisibility(value: string): value is SystemEventVisibility {
  return (SYSTEM_EVENT_VISIBILITIES as readonly string[]).includes(value);
}
