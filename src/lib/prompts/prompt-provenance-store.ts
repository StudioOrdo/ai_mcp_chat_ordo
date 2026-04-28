/**
 * Sprint 19 — Prompt Provenance Store
 *
 * In-memory store for the latest PromptRuntimeResult metadata per conversation.
 * Strips full content from sections to keep only structural provenance
 * (slot sources, section keys, warnings).
 *
 * This store enables the `prompt_get_provenance` MCP tool to inspect
 * "what prompt was actually built?" for any active conversation.
 */
import type {
  PromptRuntimeResult,
  PromptRuntimeReplayContext,
  PromptSlotRef,
  PromptRuntimeWarning,
  PromptSurface,
} from "@/lib/chat/prompt-runtime";

/** Compact section entry — no full content */
export interface CompactSectionEntry {
  key: string;
  sourceKind: "slot" | "overlay" | "request" | "override";
  priority: number;
  includedInText: boolean;
  parentKey?: string;
  slotKey?: string;
  payload?: unknown;
}

/** Compact provenance record stored per conversation */
export interface PromptProvenance {
  surface: PromptSurface;
  effectiveHash: string;
  slotRefs: PromptSlotRef[];
  sections: CompactSectionEntry[];
  warnings: PromptRuntimeWarning[];
  recordedAt: string;
}

export interface PromptTurnProvenanceRecord extends PromptProvenance {
  id: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string | null;
  replayContext: PromptRuntimeReplayContext;
}

export interface PromptProvenanceDiffChange<T> {
  key: string;
  kind: "added" | "removed" | "changed";
  stored?: T;
  rebuilt?: T;
}

export interface PromptProvenanceDiff {
  surfaceChanged: boolean;
  effectiveHashChanged: boolean;
  slotRefChanges: PromptProvenanceDiffChange<PromptSlotRef>[];
  sectionChanges: PromptProvenanceDiffChange<CompactSectionEntry>[];
  warningChanges: PromptProvenanceDiffChange<PromptRuntimeWarning>[];
  driftWarnings: string[];
}

/** Default TTL: 30 minutes */
const DEFAULT_TTL_MS = 30 * 60 * 1000;

/**
 * Extracts compact provenance from a full PromptRuntimeResult.
 * Strips `content` from each section to avoid storing prompt text.
 */
export function compactProvenance(result: PromptRuntimeResult): Omit<PromptProvenance, "recordedAt"> {
  return {
    surface: result.surface,
    effectiveHash: result.effectiveHash,
    slotRefs: result.slotRefs,
    sections: result.sections.map((s) => ({
      key: s.key,
      sourceKind: s.sourceKind,
      priority: s.priority,
      includedInText: s.includedInText,
      ...(s.parentKey ? { parentKey: s.parentKey } : {}),
      ...(s.slotKey ? { slotKey: s.slotKey } : {}),
      ...(s.payload !== undefined ? { payload: s.payload } : {}),
    })),
    warnings: result.warnings,
  };
}

function compareEntries<T>(
  stored: readonly T[],
  rebuilt: readonly T[],
  getKey: (entry: T) => string,
): PromptProvenanceDiffChange<T>[] {
  const storedMap = new Map(stored.map((entry) => [getKey(entry), entry]));
  const rebuiltMap = new Map(rebuilt.map((entry) => [getKey(entry), entry]));
  const allKeys = [...new Set([...storedMap.keys(), ...rebuiltMap.keys()])].sort((left, right) => left.localeCompare(right));
  const changes: PromptProvenanceDiffChange<T>[] = [];

  for (const key of allKeys) {
    const storedEntry = storedMap.get(key);
    const rebuiltEntry = rebuiltMap.get(key);

    if (!storedEntry && rebuiltEntry) {
      changes.push({ key, kind: "added", rebuilt: rebuiltEntry });
      continue;
    }

    if (storedEntry && !rebuiltEntry) {
      changes.push({ key, kind: "removed", stored: storedEntry });
      continue;
    }

    if (storedEntry && rebuiltEntry && JSON.stringify(storedEntry) !== JSON.stringify(rebuiltEntry)) {
      changes.push({ key, kind: "changed", stored: storedEntry, rebuilt: rebuiltEntry });
    }
  }

  return changes;
}

export function diffPromptProvenance(
  stored: Pick<PromptProvenance, "surface" | "effectiveHash" | "slotRefs" | "sections" | "warnings">,
  rebuilt: Pick<PromptProvenance, "surface" | "effectiveHash" | "slotRefs" | "sections" | "warnings">,
): PromptProvenanceDiff {
  const slotRefChanges = compareEntries(
    stored.slotRefs,
    rebuilt.slotRefs,
    (slotRef) => `${slotRef.role}/${slotRef.promptType}`,
  );
  const sectionChanges = compareEntries(
    stored.sections,
    rebuilt.sections,
    (section) => section.key,
  );
  const warningChanges = compareEntries(
    stored.warnings,
    rebuilt.warnings,
    (warning) => `${warning.code}|${warning.slotKey ?? ""}|${warning.sectionKey ?? ""}|${warning.message}`,
  );
  const surfaceChanged = stored.surface !== rebuilt.surface;
  const effectiveHashChanged = stored.effectiveHash !== rebuilt.effectiveHash;
  const driftWarnings: string[] = [];

  if (surfaceChanged) {
    driftWarnings.push(`Surface drift detected: stored=${stored.surface}, rebuilt=${rebuilt.surface}.`);
  }

  if (effectiveHashChanged) {
    driftWarnings.push(`Effective hash drift detected: stored=${stored.effectiveHash}, rebuilt=${rebuilt.effectiveHash}.`);
  }

  if (slotRefChanges.length > 0) {
    driftWarnings.push(`Slot coverage drift detected (${slotRefChanges.length} change${slotRefChanges.length === 1 ? "" : "s"}).`);
  }

  if (sectionChanges.length > 0) {
    driftWarnings.push(`Prompt section drift detected (${sectionChanges.length} change${sectionChanges.length === 1 ? "" : "s"}).`);
  }

  if (warningChanges.length > 0) {
    driftWarnings.push(`Prompt warning drift detected (${warningChanges.length} change${warningChanges.length === 1 ? "" : "s"}).`);
  }

  return {
    surfaceChanged,
    effectiveHashChanged,
    slotRefChanges,
    sectionChanges,
    warningChanges,
    driftWarnings,
  };
}

interface StoreEntry {
  provenance: PromptProvenance;
  expiresAt: number;
}

/**
 * In-memory prompt provenance store with TTL-based eviction.
 *
 * Keyed by conversationId, stores only the latest turn's provenance.
 * Old entries are lazily evicted on read or on periodic sweeps.
 */
export class PromptProvenanceStore {
  private readonly entries = new Map<string, StoreEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /**
   * Record compact provenance for a conversation.
   * Overwrites any existing entry (only latest turn is stored).
   */
  record(conversationId: string, result: PromptRuntimeResult): void {
    const provenance: PromptProvenance = {
      ...compactProvenance(result),
      recordedAt: new Date().toISOString(),
    };

    this.entries.set(conversationId, {
      provenance,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Retrieve the latest provenance for a conversation.
   * Returns null if not found or expired.
   */
  get(conversationId: string): PromptProvenance | null {
    const entry = this.entries.get(conversationId);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(conversationId);
      return null;
    }

    return entry.provenance;
  }

  /** Remove all expired entries */
  sweep(): number {
    const now = Date.now();
    let swept = 0;
    for (const [key, entry] of this.entries) {
      if (now > entry.expiresAt) {
        this.entries.delete(key);
        swept++;
      }
    }
    return swept;
  }

  /** Current entry count (including expired but not yet swept) */
  get size(): number {
    return this.entries.size;
  }

  /** Clear all entries */
  clear(): void {
    this.entries.clear();
  }
}

// Singleton instance
let defaultStore: PromptProvenanceStore | null = null;

export function getPromptProvenanceStore(): PromptProvenanceStore {
  if (!defaultStore) {
    defaultStore = new PromptProvenanceStore();
  }
  return defaultStore;
}
