import { describe, expect, it, vi } from "vitest";

import type { PromptBindingRepository } from "@/core/use-cases/PromptBindingRepository";
import { recordPromptBinding, recordPromptBindingFromSource } from "./prompt-binding-service";

describe("recordPromptBinding", () => {
  it("maps prompt runtime metadata into a durable prompt binding", async () => {
    const record = vi.fn(async (binding) => binding);
    const repository = { record } as unknown as PromptBindingRepository;

    const binding = await recordPromptBinding({
      userId: "usr_1",
      conversationId: "conv_1",
      surface: "chat_stream",
      target: {
        targetKind: "message",
        targetId: "msg_user_1",
      },
      promptRuntime: {
        effectiveHash: "hash_1",
        slotRefs: [
          {
            role: "ALL",
            promptType: "base",
            source: "db",
            promptId: "sp_base_1",
            version: 4,
          },
          {
            role: "ADMIN",
            promptType: "role_directive",
            source: "fallback",
            promptId: null,
            version: null,
          },
        ],
        sections: [
          {
            key: "identity",
            sourceKind: "slot",
            priority: 10,
            content: "Base prompt",
            includedInText: true,
            slotKey: "ALL/base",
          },
          {
            key: "identity_name_overlay",
            sourceKind: "overlay",
            priority: 10,
            content: "Studio Ordo",
            includedInText: true,
          },
          {
            key: "task_origin_handoff",
            sourceKind: "request",
            priority: 90,
            content: "request payload",
            includedInText: true,
          },
        ],
      },
      decisionSourceRefs: [
        {
          sourceKind: "conversation",
          sourceId: "conv_1",
          userId: "usr_1",
          conversationId: "conv_1",
        },
      ],
      evidenceRefs: [
        {
          source: {
            sourceKind: "prompt_provenance",
            sourceId: "pprov_1",
            userId: "usr_1",
            conversationId: "conv_1",
          },
          observedAt: "2026-04-29T12:00:00.000Z",
          summary: "Prompt provenance for the turn.",
        },
      ],
      createdAt: "2026-04-29T12:00:00.000Z",
    }, repository);

    expect(record).toHaveBeenCalledTimes(1);
    expect(binding.id).toMatch(/^pb_/);
    expect(binding.targetKind).toBe("message");
    expect(binding.targetId).toBe("msg_user_1");
    expect(binding.slotRefs).toEqual([
      {
        slotId: "sp_base_1",
        version: 4,
        effectiveHash: expect.any(String),
      },
      {
        slotId: "ADMIN/role_directive:fallback",
        version: null,
        effectiveHash: null,
      },
    ]);
    expect(binding.overlayRefs).toEqual([
      expect.objectContaining({
        overlayId: "identity_name_overlay",
        label: "identity_name_overlay",
      }),
    ]);
    expect(binding.requestRefs).toEqual([
      expect.objectContaining({
        requestId: "task_origin_handoff",
        label: "task_origin_handoff",
        sourceKind: "request",
      }),
    ]);
    expect(binding.effectiveHash).toBe("hash_1");
  });

  it("derives a target binding from an existing source binding", async () => {
    const repository = {
      findById: vi.fn(async () => ({
        id: "pb_root",
        userId: "usr_1",
        conversationId: "conv_1",
        surface: "chat_stream",
        targetKind: "message",
        targetId: "msg_user_1",
        sourcePromptBindingId: null,
        effectiveHash: "hash_1",
        slotRefs: [{ slotId: "sp_base_1", version: 4, effectiveHash: null }],
        overlayRefs: [],
        requestRefs: [{ requestId: "task_origin_handoff", label: "task_origin_handoff", sourceKind: "request", effectiveHash: "req_hash" }],
        decisionSourceRefs: [],
        evidenceRefs: [],
        createdAt: "2026-04-29T12:00:00.000Z",
      })),
      record: vi.fn(async (binding) => binding),
    } as unknown as PromptBindingRepository;

    const binding = await recordPromptBindingFromSource({
      userId: "usr_1",
      conversationId: "conv_1",
      sourcePromptBindingId: "pb_root",
      surface: "job_execution",
      target: {
        targetKind: "job",
        targetId: "job_1",
      },
      decisionSourceRefs: [
        {
          sourceKind: "job",
          sourceId: "job_1",
          userId: "usr_1",
          conversationId: "conv_1",
        },
      ],
      createdAt: "2026-04-29T12:01:00.000Z",
    }, repository);

    expect(binding).toEqual(expect.objectContaining({
      surface: "job_execution",
      targetKind: "job",
      targetId: "job_1",
      sourcePromptBindingId: "pb_root",
      effectiveHash: "hash_1",
      requestRefs: [{ requestId: "task_origin_handoff", label: "task_origin_handoff", sourceKind: "request", effectiveHash: "req_hash" }],
    }));
  });
});
