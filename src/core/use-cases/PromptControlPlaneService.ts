import type { SystemPrompt } from "@/core/use-cases/SystemPromptRepository";

export type PromptSlotType = "base" | "role_directive" | "coach";
export type PromptRuntimeCoverage = "db" | "fallback" | "missing";

export interface PromptSlotRef {
  role: string;
  promptType: PromptSlotType;
}

export interface PromptVersionChangedEvent {
  type: "prompt_version_changed";
  semantics: "slot_version";
  role: string;
  promptType: PromptSlotType;
  oldVersion: number;
  newVersion: number;
}

export interface PromptControlPlaneSideEffects {
  revalidatePaths: string[];
  promptVersionChanged?: PromptVersionChangedEvent;
}

export interface PromptControlPlaneSlotSummary extends PromptSlotRef {
  activeVersion: number | null;
  totalVersions: number;
  lastUpdated: string;
  updatedBy: string | null;
  runtimeCoverage: PromptRuntimeCoverage;
}

export interface PromptControlPlaneSlotDetail {
  slot: PromptControlPlaneSlotSummary;
  versions: SystemPrompt[];
  activeContent: string;
  storedActiveContent: string | null;
  fallbackContent: string | null;
}

export interface CreatePromptVersionInput extends PromptSlotRef {
  content: string;
  createdBy: string;
  notes: string;
}

export interface PromptControlPlaneCreateResult {
  created: SystemPrompt;
  slot: PromptControlPlaneSlotSummary;
  sideEffects: PromptControlPlaneSideEffects;
}

export interface ActivatePromptVersionInput extends PromptSlotRef {
  version: number;
}

export interface PromptControlPlaneActivationResult {
  slot: PromptControlPlaneSlotSummary;
  activatedVersion: number;
  deactivatedVersion: number | null;
  sideEffects: PromptControlPlaneSideEffects;
}

export interface PromptControlPlaneDiffResult extends PromptSlotRef {
  versionA: number;
  versionB: number;
  diff: string;
}

export interface PromptControlPlaneService {
  listSlots(filter?: Partial<PromptSlotRef>): Promise<PromptControlPlaneSlotSummary[]>;
  getSlotDetail(slot: PromptSlotRef): Promise<PromptControlPlaneSlotDetail>;
  createVersion(input: CreatePromptVersionInput): Promise<PromptControlPlaneCreateResult>;
  activateVersion(input: ActivatePromptVersionInput): Promise<PromptControlPlaneActivationResult>;
  rollback(input: ActivatePromptVersionInput): Promise<PromptControlPlaneActivationResult>;
  diffVersions(input: {
    role: string;
    promptType: PromptSlotType;
    versionA: number;
    versionB: number;
  }): Promise<PromptControlPlaneDiffResult>;
}