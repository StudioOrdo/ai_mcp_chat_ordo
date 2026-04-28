import type {
  CapabilityCardKind,
  CapabilityExecutionMode,
  CapabilityFamily,
} from "./capability-presentation";
import type {
  MediaAssetRetentionClass,
  MediaAssetSource,
} from "./media-asset";

export type CapabilityProgressPhaseStatus =
  | "pending"
  | "active"
  | "succeeded"
  | "failed"
  | "canceled";

export interface CapabilityProgressPhase {
  key: string;
  label: string;
  status: CapabilityProgressPhaseStatus;
  percent?: number | null;
}

export type CapabilityArtifactRetentionClass = MediaAssetRetentionClass;

export interface CapabilityArtifactRef {
  kind: string;
  label: string;
  mimeType: string;
  assetId?: string;
  uri?: string;
  retentionClass?: CapabilityArtifactRetentionClass;
  width?: number;
  height?: number;
  durationSeconds?: number;
  source?: MediaAssetSource;
  toolInvocationId?: string;
  derivativeOfToolInvocationId?: string | null;
}

export interface CapabilityResultEnvelope<TPayload = unknown> {
  schemaVersion: 1;
  toolName: string;
  family: CapabilityFamily;
  cardKind: CapabilityCardKind;
  executionMode: CapabilityExecutionMode;
  inputSnapshot: Record<string, unknown>;
  summary: {
    title?: string;
    subtitle?: string;
    statusLine?: string;
    message?: string;
  };
  replaySnapshot?: Record<string, unknown> | null;
  progress?: {
    percent?: number | null;
    label?: string | null;
    phases?: CapabilityProgressPhase[];
    activePhaseKey?: string | null;
  };
  artifacts?: CapabilityArtifactRef[];
  payload: TPayload | null;
}