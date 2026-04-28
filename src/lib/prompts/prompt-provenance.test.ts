/**
 * Sprint 19 — Prompt Provenance Store Tests
 *
 * Verifies the PromptProvenanceStore: compact provenance extraction,
 * TTL eviction, slot source attribution, and section key stripping.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PromptProvenanceStore,
  compactProvenance,
  diffPromptProvenance,
} from "./prompt-provenance-store";
import type { PromptRuntimeResult } from "@/lib/chat/prompt-runtime";

function createMockResult(overrides?: Partial<PromptRuntimeResult>): PromptRuntimeResult {
  return {
    surface: "chat_stream",
    text: "You are a helpful assistant named Ordo.\n\nHere is your directive...",
    effectiveHash: "abc123",
    slotRefs: [
      {
        role: "ALL",
        promptType: "base",
        source: "db",
        promptId: "prompt-001",
        version: 3,
      },
      {
        role: "APPRENTICE",
        promptType: "role_directive",
        source: "fallback",
        promptId: "fallback",
        version: 0,
      },
    ],
    sections: [
      {
        key: "identity",
        sourceKind: "slot",
        priority: 10,
        content: "You are Ordo, a helpful knowledge assistant.",
        includedInText: true,
        slotKey: "ALL/base",
      },
      {
        key: "role_directive",
        sourceKind: "slot",
        priority: 20,
        content: "Guide apprentice users through...",
        includedInText: true,
        slotKey: "APPRENTICE/role_directive",
      },
      {
        key: "tool_manifest",
        sourceKind: "request",
        priority: 15,
        content: "TOOLS AVAILABLE: ...",
        includedInText: true,
      },
    ],
    warnings: [
      {
        code: "slot_fallback",
        message: "Using fallback prompt content for APPRENTICE/role_directive.",
        slotKey: "APPRENTICE/role_directive",
      },
    ],
    ...overrides,
  };
}

describe("prompt-provenance-store", () => {
  describe("compactProvenance", () => {
    it("strips content from sections", () => {
      const result = createMockResult();
      const compact = compactProvenance(result);

      for (const section of compact.sections) {
        expect(section).not.toHaveProperty("content");
      }
    });

    it("preserves section keys and sourceKinds", () => {
      const result = createMockResult({
        sections: [
          {
            key: "identity",
            sourceKind: "slot",
            priority: 10,
            content: "You are Ordo, a helpful knowledge assistant.",
            includedInText: true,
            slotKey: "ALL/base",
          },
          {
            key: "role_directive",
            sourceKind: "slot",
            priority: 20,
            content: "Guide apprentice users through...",
            includedInText: true,
            slotKey: "APPRENTICE/role_directive",
          },
          {
            key: "tool_manifest",
            sourceKind: "request",
            priority: 15,
            content: "TOOLS AVAILABLE: ...",
            includedInText: true,
            payload: {
              assets: [
                { assetId: "uf_chart_1", kind: "chart", derivativeOfAssetId: "chart_test_001" },
              ],
            },
          },
        ],
      });
      const compact = compactProvenance(result);

      expect(compact.sections).toHaveLength(3);
      expect(compact.sections[0]).toEqual({
        key: "identity",
        sourceKind: "slot",
        priority: 10,
        includedInText: true,
        slotKey: "ALL/base",
      });
      expect(compact.sections[2]).toEqual({
        key: "tool_manifest",
        sourceKind: "request",
        priority: 15,
        includedInText: true,
        payload: {
          assets: [
            { assetId: "uf_chart_1", kind: "chart", derivativeOfAssetId: "chart_test_001" },
          ],
        },
      });
    });

    it("preserves slotRefs with source attribution", () => {
      const result = createMockResult();
      const compact = compactProvenance(result);

      expect(compact.slotRefs).toHaveLength(2);
      expect(compact.slotRefs[0].source).toBe("db");
      expect(compact.slotRefs[1].source).toBe("fallback");
    });

    it("preserves warnings", () => {
      const result = createMockResult();
      const compact = compactProvenance(result);

      expect(compact.warnings).toHaveLength(1);
      expect(compact.warnings[0].code).toBe("slot_fallback");
    });

    it("preserves surface and effectiveHash", () => {
      const result = createMockResult();
      const compact = compactProvenance(result);

      expect(compact.surface).toBe("chat_stream");
      expect(compact.effectiveHash).toBe("abc123");
    });

    it("strips content from sections but NOT text from the compact result", () => {
      const result = createMockResult();
      const compact = compactProvenance(result);

      // compactProvenance should NOT include the full text
      expect(compact).not.toHaveProperty("text");
    });
  });

  describe("PromptProvenanceStore", () => {
    let store: PromptProvenanceStore;

    beforeEach(() => {
      store = new PromptProvenanceStore(5000); // 5s TTL for tests
    });

    it("records and retrieves provenance by conversation ID", () => {
      const result = createMockResult();
      store.record("conv-1", result);

      const provenance = store.get("conv-1");
      expect(provenance).not.toBeNull();
      expect(provenance!.surface).toBe("chat_stream");
      expect(provenance!.slotRefs).toHaveLength(2);
      expect(provenance!.sections).toHaveLength(3);
      expect(provenance!.recordedAt).toBeTruthy();
    });

    it("returns null for unknown conversation", () => {
      expect(store.get("unknown")).toBeNull();
    });

    it("overwrites previous provenance (only latest turn stored)", () => {
      const result1 = createMockResult({ effectiveHash: "hash-1" });
      const result2 = createMockResult({ effectiveHash: "hash-2" });

      store.record("conv-1", result1);
      store.record("conv-1", result2);

      const provenance = store.get("conv-1");
      expect(provenance!.effectiveHash).toBe("hash-2");
      expect(store.size).toBe(1);
    });

    it("distinguishes db vs fallback vs missing sources", () => {
      const result = createMockResult({
        slotRefs: [
          { role: "ALL", promptType: "base", source: "db", promptId: "p1", version: 3 },
          { role: "APPRENTICE", promptType: "role_directive", source: "fallback", promptId: "fallback", version: 0 },
          { role: "ADMIN", promptType: "role_directive", source: "missing", promptId: null, version: null },
        ],
      });

      store.record("conv-2", result);
      const provenance = store.get("conv-2")!;

      expect(provenance.slotRefs[0].source).toBe("db");
      expect(provenance.slotRefs[1].source).toBe("fallback");
      expect(provenance.slotRefs[2].source).toBe("missing");
    });

    it("evicts expired entries on get()", () => {
      vi.useFakeTimers();

      const shortStore = new PromptProvenanceStore(1000); // 1s TTL
      shortStore.record("conv-ttl", createMockResult());

      expect(shortStore.get("conv-ttl")).not.toBeNull();

      vi.advanceTimersByTime(1500);

      expect(shortStore.get("conv-ttl")).toBeNull();

      vi.useRealTimers();
    });

    it("sweep() removes expired entries", () => {
      vi.useFakeTimers();

      const shortStore = new PromptProvenanceStore(1000);
      shortStore.record("conv-a", createMockResult());
      shortStore.record("conv-b", createMockResult());

      vi.advanceTimersByTime(1500);

      const swept = shortStore.sweep();
      expect(swept).toBe(2);
      expect(shortStore.size).toBe(0);

      vi.useRealTimers();
    });

    it("clear() removes all entries", () => {
      store.record("conv-x", createMockResult());
      store.record("conv-y", createMockResult());
      expect(store.size).toBe(2);

      store.clear();
      expect(store.size).toBe(0);
    });
  });

  describe("diffPromptProvenance", () => {
    it("reports structural drift when replayed provenance no longer matches storage", () => {
      const stored = compactProvenance(createMockResult());
      const rebuilt = compactProvenance(createMockResult({
        effectiveHash: "hash-drifted",
        sections: [
          {
            key: "identity",
            sourceKind: "slot",
            priority: 10,
            content: "You are Ordo, a helpful knowledge assistant.",
            includedInText: true,
            slotKey: "ALL/base",
          },
          {
            key: "routing",
            sourceKind: "request",
            priority: 50,
            content: "Routing context changed",
            includedInText: true,
          },
        ],
      }));

      const diff = diffPromptProvenance(stored, rebuilt);

      expect(diff.effectiveHashChanged).toBe(true);
      expect(diff.sectionChanges).toEqual([
        expect.objectContaining({ key: "role_directive", kind: "removed" }),
        expect.objectContaining({ key: "routing", kind: "added" }),
        expect.objectContaining({ key: "tool_manifest", kind: "removed" }),
      ]);
      expect(diff.driftWarnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Effective hash drift detected"),
          expect.stringContaining("Prompt section drift detected"),
        ]),
      );
    });
  });
});
