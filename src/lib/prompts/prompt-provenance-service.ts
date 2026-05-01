import { getPromptBindingRepository, getPromptProvenanceDataMapper } from "@/adapters/RepositoryFactory";
import {
  getPromptRuntime,
  replayPromptRuntime,
  type PromptRuntime,
  type PromptRuntimeReplayContext,
  type PromptRuntimeResult,
} from "@/lib/chat/prompt-runtime";
import { logEvent } from "@/lib/observability/logger";
import {
  compactProvenance,
  diffPromptProvenance,
  getPromptProvenanceStore,
  type PromptProvenance,
  type PromptProvenanceDiff,
  type PromptTurnProvenanceRecord,
} from "./prompt-provenance-store";

export interface PromptTurnReplayResult {
  rebuilt: Omit<PromptProvenance, "recordedAt">;
  diff: PromptProvenanceDiff;
  matches: boolean;
}

export interface PromptTurnAuditEntry {
  record: PromptTurnProvenanceRecord;
  replay: PromptTurnReplayResult;
  affectedTargets: Array<{
    id: string;
    surface: string;
    targetKind: string;
    targetId: string;
    sourcePromptBindingId: string | null;
  }>;
}

async function listAffectedPromptBindingTargets(
  conversationId: string,
  promptProvenanceRecordId: string,
): Promise<PromptTurnAuditEntry["affectedTargets"]> {
  const promptBindingRepository = getPromptBindingRepository();
  const conversationBindings = await promptBindingRepository.listByConversation(conversationId, { limit: 200 });
  const rootBinding = conversationBindings.find((binding) => binding.decisionSourceRefs.some(
    (ref) => ref.sourceKind === "prompt_provenance" && ref.sourceId === promptProvenanceRecordId,
  ));

  if (!rootBinding) {
    return [];
  }

  const derivedBindings = await promptBindingRepository.listBySourcePromptBinding(rootBinding.id, { limit: 200 });

  return [rootBinding, ...derivedBindings].map((binding) => ({
    id: binding.id,
    surface: binding.surface,
    targetKind: binding.targetKind,
    targetId: binding.targetId,
    sourcePromptBindingId: binding.sourcePromptBindingId,
  }));
}

interface RecordPromptTurnProvenanceInput {
  conversationId: string;
  userMessageId: string;
  promptRuntime: PromptRuntimeResult;
  replayContext: PromptRuntimeReplayContext;
}

export async function recordPromptTurnProvenance(
  input: RecordPromptTurnProvenanceInput,
): Promise<PromptTurnProvenanceRecord> {
  const compact = compactProvenance(input.promptRuntime);

  logEvent("info", "PROMPT_PROVENANCE", {
    conversationId: input.conversationId,
    userMessageId: input.userMessageId,
    surface: compact.surface,
    effectiveHash: compact.effectiveHash,
    slotRefs: compact.slotRefs.map((slotRef) => `${slotRef.role}/${slotRef.promptType}:${slotRef.source}`),
    sections: compact.sections.map((section) => `${section.key}(${section.sourceKind})`),
    warnings: compact.warnings.map((warning) => warning.code),
  });

  getPromptProvenanceStore().record(input.conversationId, input.promptRuntime);

  return getPromptProvenanceDataMapper().create({
    conversationId: input.conversationId,
    userMessageId: input.userMessageId,
    surface: compact.surface,
    effectiveHash: compact.effectiveHash,
    slotRefs: compact.slotRefs,
    sections: compact.sections,
    warnings: compact.warnings,
    replayContext: input.replayContext,
  });
}

export async function attachAssistantMessageToPromptTurn(
  recordId: string,
  assistantMessageId: string,
): Promise<void> {
  await getPromptProvenanceDataMapper().attachAssistantMessage(recordId, assistantMessageId);
}

export async function findPromptTurnProvenance(args: {
  conversationId: string;
  turnId?: string | null;
}): Promise<PromptTurnProvenanceRecord | null> {
  const mapper = getPromptProvenanceDataMapper();

  if (args.turnId) {
    return mapper.findByConversationAndTurnId(args.conversationId, args.turnId);
  }

  return mapper.findLatestByConversation(args.conversationId);
}

export async function replayPromptTurnProvenanceRecord(
  record: PromptTurnProvenanceRecord,
  runtime: PromptRuntime = getPromptRuntime(),
): Promise<PromptTurnReplayResult> {
  const rebuiltResult = await replayPromptRuntime(record.replayContext, runtime);
  const rebuilt = compactProvenance(rebuiltResult);
  const diff = diffPromptProvenance(record, rebuilt);

  return {
    rebuilt,
    diff,
    matches: diff.driftWarnings.length === 0,
  };
}

export async function listPromptTurnAudits(
  conversationId: string,
): Promise<PromptTurnAuditEntry[]> {
  const records = await getPromptProvenanceDataMapper().listByConversation(conversationId);

  return Promise.all(records.map(async (record) => {
    try {
      const affectedTargets = await listAffectedPromptBindingTargets(conversationId, record.id);

      return {
        record,
        replay: await replayPromptTurnProvenanceRecord(record),
        affectedTargets,
      };
    } catch (error) {
      const affectedTargets = await listAffectedPromptBindingTargets(conversationId, record.id);

      return {
        record,
        replay: {
          rebuilt: {
            surface: record.surface,
            effectiveHash: record.effectiveHash,
            slotRefs: record.slotRefs,
            sections: record.sections,
            warnings: record.warnings,
          },
          diff: {
            surfaceChanged: false,
            effectiveHashChanged: false,
            slotRefChanges: [],
            sectionChanges: [],
            warningChanges: [],
            driftWarnings: [error instanceof Error ? error.message : String(error)],
          },
          matches: false,
        },
        affectedTargets,
      };
    }
  }));
}