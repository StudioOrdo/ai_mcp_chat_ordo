import { createHash } from "node:crypto";

import { getPromptBindingRepository } from "@/adapters/RepositoryFactory";
import type {
  PromptBinding,
  PromptOverlayRef,
  PromptRequestRef,
  PromptSlotVersionRef,
} from "@/core/entities/prompt-binding";
import type {
  CanonicalEvidenceRef,
  ContinuitySourceRef,
} from "@/core/entities/conversation-continuity";
import type { PromptBindingRepository } from "@/core/use-cases/PromptBindingRepository";
import type { PromptRuntimeResult } from "@/lib/chat/prompt-runtime";
import { contentHash } from "@/lib/user-files";

export interface RecordPromptBindingInput {
  userId: string;
  conversationId: string | null;
  surface: PromptBinding["surface"];
  target: {
    targetKind: PromptBinding["targetKind"];
    targetId: string;
  };
  sourcePromptBindingId?: string | null;
  promptRuntime: Pick<PromptRuntimeResult, "effectiveHash" | "slotRefs" | "sections">;
  decisionSourceRefs?: readonly ContinuitySourceRef[];
  evidenceRefs?: readonly CanonicalEvidenceRef[];
  createdAt?: string;
}

export interface RecordPromptBindingFromSourceInput {
  userId: string;
  conversationId: string | null;
  surface: PromptBinding["surface"];
  target: {
    targetKind: PromptBinding["targetKind"];
    targetId: string;
  };
  sourcePromptBindingId: string;
  decisionSourceRefs?: readonly ContinuitySourceRef[];
  evidenceRefs?: readonly CanonicalEvidenceRef[];
  createdAt?: string;
}

function buildPromptBindingId(
  surface: PromptBinding["surface"],
  targetKind: PromptBinding["targetKind"],
  targetId: string,
  effectiveHash: string,
  createdAt: string,
): string {
  const digest = createHash("sha1")
    .update(`${surface}:${targetKind}:${targetId}:${effectiveHash}:${createdAt}`)
    .digest("hex")
    .slice(0, 16);
  return `pb_${digest}`;
}

function dedupeDecisionSourceRefs(refs: readonly ContinuitySourceRef[]): ContinuitySourceRef[] {
  const seen = new Set<string>();
  const deduped: ContinuitySourceRef[] = [];

  for (const ref of refs) {
    const key = `${ref.sourceKind}:${ref.sourceId}:${ref.userId ?? ""}:${ref.conversationId ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(ref);
  }

  return deduped;
}

function buildSourceBindingEvidenceRef(binding: PromptBinding, observedAt: string): CanonicalEvidenceRef {
  return {
    source: {
      sourceKind: "prompt_binding",
      sourceId: binding.id,
      userId: binding.userId,
      conversationId: binding.conversationId,
    },
    observedAt,
    summary: `Derived from ${binding.surface} prompt binding ${binding.id}.`,
  };
}

function toPromptSlotVersionRefs(input: RecordPromptBindingInput["promptRuntime"]): PromptSlotVersionRef[] {
  const slotSectionsByKey = new Map(
    input.sections
      .filter((section) => section.sourceKind === "slot" && section.slotKey)
      .map((section) => [section.slotKey, section.content]),
  );

  return input.slotRefs.map((slotRef) => ({
    slotId: slotRef.promptId ?? `${slotRef.role}/${slotRef.promptType}:${slotRef.source}`,
    version: slotRef.version,
    effectiveHash: slotSectionsByKey.has(`${slotRef.role}/${slotRef.promptType}`)
      ? contentHash(slotSectionsByKey.get(`${slotRef.role}/${slotRef.promptType}`) ?? "")
      : null,
  }));
}

function toPromptOverlayRefs(input: RecordPromptBindingInput["promptRuntime"]): PromptOverlayRef[] {
  return input.sections
    .filter((section) => section.sourceKind === "overlay")
    .map((section) => ({
      overlayId: section.key,
      label: section.key,
      effectiveHash: contentHash(section.content),
    }));
}

function toPromptRequestRefs(input: RecordPromptBindingInput["promptRuntime"]): PromptRequestRef[] {
  return input.sections
    .filter((section): section is typeof section & { sourceKind: "request" | "override" } =>
      (section.sourceKind === "request" || section.sourceKind === "override") && section.includedInText)
    .map((section) => ({
      requestId: section.key,
      label: section.key,
      sourceKind: section.sourceKind,
      effectiveHash: contentHash(section.content),
    }));
}

export async function recordPromptBinding(
  input: RecordPromptBindingInput,
  repository: PromptBindingRepository = getPromptBindingRepository(),
): Promise<PromptBinding> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const binding: PromptBinding = {
    id: buildPromptBindingId(
      input.surface,
      input.target.targetKind,
      input.target.targetId,
      input.promptRuntime.effectiveHash,
      createdAt,
    ),
    userId: input.userId,
    conversationId: input.conversationId,
    surface: input.surface,
    targetKind: input.target.targetKind,
    targetId: input.target.targetId,
    sourcePromptBindingId: input.sourcePromptBindingId ?? null,
    effectiveHash: input.promptRuntime.effectiveHash,
    slotRefs: toPromptSlotVersionRefs(input.promptRuntime),
    overlayRefs: toPromptOverlayRefs(input.promptRuntime),
    requestRefs: toPromptRequestRefs(input.promptRuntime),
    decisionSourceRefs: [...(input.decisionSourceRefs ?? [])],
    evidenceRefs: [...(input.evidenceRefs ?? [])],
    createdAt,
  };

  return repository.record(binding);
}

export async function recordPromptBindingFromSource(
  input: RecordPromptBindingFromSourceInput,
  repository: PromptBindingRepository = getPromptBindingRepository(),
): Promise<PromptBinding | null> {
  const sourceBinding = await repository.findById(input.sourcePromptBindingId);
  if (!sourceBinding) {
    return null;
  }

  const createdAt = input.createdAt ?? new Date().toISOString();

  return repository.record({
    id: buildPromptBindingId(
      input.surface,
      input.target.targetKind,
      input.target.targetId,
      sourceBinding.effectiveHash,
      createdAt,
    ),
    userId: input.userId,
    conversationId: input.conversationId,
    surface: input.surface,
    targetKind: input.target.targetKind,
    targetId: input.target.targetId,
    sourcePromptBindingId: sourceBinding.id,
    effectiveHash: sourceBinding.effectiveHash,
    slotRefs: [...sourceBinding.slotRefs],
    overlayRefs: [...sourceBinding.overlayRefs],
    requestRefs: [...(sourceBinding.requestRefs ?? [])],
    decisionSourceRefs: dedupeDecisionSourceRefs([
      ...sourceBinding.decisionSourceRefs,
      ...(input.decisionSourceRefs ?? []),
    ]),
    evidenceRefs: [
      buildSourceBindingEvidenceRef(sourceBinding, createdAt),
      ...(input.evidenceRefs ?? []),
    ],
    createdAt,
  });
}
