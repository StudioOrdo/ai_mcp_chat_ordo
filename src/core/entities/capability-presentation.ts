export type CapabilityFamily =
  | "editorial"
  | "search"
  | "artifact"
  | "theme"
  | "profile"
  | "journal"
  | "media"
  | "system";

export type CapabilityCardKind =
  | "editorial_workflow"
  | "search_result"
  | "artifact_viewer"
  | "theme_inspection"
  | "profile_summary"
  | "journal_workflow"
  | "media_render"
  | "lifecycle"
  | "fallback";

export type CapabilityExecutionMode = "inline" | "deferred" | "browser" | "hybrid";

export type CapabilityProgressMode = "none" | "single" | "phased";

export type CapabilityDefaultSurface = "conversation" | "jobs" | "admin" | "global_strip";

export type CapabilityHistoryMode = "payload_snapshot";

export type CapabilityRetrySupport = "none" | "whole_job";

export interface CapabilityPresentationDescriptor {
  toolName: string;
  family: CapabilityFamily;
  label: string;
  cardKind: CapabilityCardKind;
  executionMode: CapabilityExecutionMode;
  progressMode: CapabilityProgressMode;
  historyMode: CapabilityHistoryMode;
  defaultSurface: CapabilityDefaultSurface;
  artifactKinds: readonly string[];
  supportsRetry: CapabilityRetrySupport;
}