import type { CapabilityPresentationDescriptor } from "@/core/entities/capability-presentation";
import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import {
  COACH_TOOL_NAME,
  type CoachEnvelope,
  type CoachPayload,
} from "@/core/entities/coach";

/**
 * Coach envelopes are system-authored multi-step sequences. They are NOT
 * registered in CAPABILITY_CATALOG because they are never invoked by the
 * LLM as tools; they are produced server-side in response to a lifecycle
 * event and rendered via presenter passthrough (contract F7).
 */
export const COACH_DESCRIPTOR: CapabilityPresentationDescriptor = {
  toolName: COACH_TOOL_NAME,
  family: "system",
  label: "Coach Sequence",
  cardKind: "lifecycle",
  executionMode: "inline",
  progressMode: "phased",
  historyMode: "payload_snapshot",
  defaultSurface: "conversation",
  artifactKinds: [],
  supportsRetry: "none",
};

export function createCoachEnvelope(payload: CoachPayload): CoachEnvelope {
  return {
    schemaVersion: 1,
    toolName: COACH_TOOL_NAME,
    family: "system",
    cardKind: "lifecycle",
    executionMode: "inline",
    inputSnapshot: {},
    summary: {
      title: payload.title,
      subtitle: payload.subtitle,
    },
    payload,
  };
}

export function isCoachResultEnvelope(
  envelope: CapabilityResultEnvelope | null | undefined,
): envelope is CoachEnvelope {
  return Boolean(
    envelope
    && envelope.family === "system"
    && envelope.cardKind === "lifecycle"
    && envelope.toolName === COACH_TOOL_NAME,
  );
}
