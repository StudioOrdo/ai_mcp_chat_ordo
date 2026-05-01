import { describe, expect, it } from "vitest";

import type { Message } from "@/core/entities/conversation";

import {
  buildRelationshipMemoryRecordId,
  projectRelationshipMemoryRecords,
} from "./RelationshipMemoryProjector";

function makeMessage(overrides: Partial<Message> & Pick<Message, "id" | "content" | "role">): Message {
  return {
    id: overrides.id,
    conversationId: overrides.conversationId ?? "conv_1",
    role: overrides.role,
    content: overrides.content,
    parts: overrides.parts ?? [],
    createdAt: overrides.createdAt ?? "2026-04-29T10:00:00.000Z",
    tokenEstimate: overrides.tokenEstimate ?? 10,
  };
}

describe("projectRelationshipMemoryRecords", () => {
  it("extracts the latest active relationship memory from user turns", () => {
    const records = projectRelationshipMemoryRecords({
      userId: "usr_1",
      conversationId: "conv_1",
      messages: [
        makeMessage({
          id: "msg_1",
          role: "user",
          content: "I want to launch the new offer. I prefer short videos. Can you review the outline?",
          createdAt: "2026-04-29T10:00:00.000Z",
        }),
        makeMessage({
          id: "msg_2",
          role: "system",
          content: "I want to be ignored because this is a summary.",
          createdAt: "2026-04-29T10:01:00.000Z",
        }),
        makeMessage({
          id: "msg_3",
          role: "user",
          content: "I've decided to start with a worksheet.",
          createdAt: "2026-04-29T10:02:00.000Z",
        }),
      ],
    });

    expect(records).toEqual([
      expect.objectContaining({
        id: buildRelationshipMemoryRecordId("conv_1", "decision", "msg_3", "active"),
        memoryType: "decision",
        summary: "Decision: start with a worksheet",
        status: "active",
      }),
      expect.objectContaining({
        id: buildRelationshipMemoryRecordId("conv_1", "goal", "msg_1", "active"),
        memoryType: "goal",
        summary: "Goal: launch the new offer",
        status: "active",
      }),
      expect.objectContaining({
        id: buildRelationshipMemoryRecordId("conv_1", "preference", "msg_1", "active"),
        memoryType: "preference",
        summary: "Preference: short videos",
        status: "active",
      }),
      expect.objectContaining({
        id: buildRelationshipMemoryRecordId("conv_1", "open_question", "msg_1", "active"),
        memoryType: "open_question",
        summary: "Open question: Can you review the outline?",
        status: "active",
      }),
    ]);
  });

  it("replaces an older preference with an explicit retraction", () => {
    const records = projectRelationshipMemoryRecords({
      userId: "usr_1",
      conversationId: "conv_1",
      messages: [
        makeMessage({
          id: "msg_1",
          role: "user",
          content: "I prefer short videos.",
          createdAt: "2026-04-29T10:00:00.000Z",
        }),
        makeMessage({
          id: "msg_2",
          role: "user",
          content: "I don't care about short videos anymore.",
          createdAt: "2026-04-29T10:05:00.000Z",
        }),
      ],
    });

    expect(records).toEqual([
      expect.objectContaining({
        id: buildRelationshipMemoryRecordId("conv_1", "preference", "msg_2", "retracted"),
        memoryType: "preference",
        summary: "Retracted Preference: short videos anymore",
        status: "retracted",
      }),
    ]);
  });

  it("extracts milestone and asset context from assistant job and asset parts", () => {
    const records = projectRelationshipMemoryRecords({
      userId: "usr_1",
      conversationId: "conv_1",
      messages: [
        makeMessage({
          id: "msg_job_1",
          role: "assistant",
          content: "Your media is ready.",
          createdAt: "2026-04-29T10:10:00.000Z",
          parts: [
            {
              type: "job_status",
              jobId: "job_1",
              toolName: "compose_media",
              label: "Compose media",
              status: "succeeded",
              summary: "Final promo video ready",
              updatedAt: "2026-04-29T10:10:00.000Z",
              resultPayload: {
                assetId: "file_video_1",
                title: "Final promo video",
                assetKind: "video",
              },
            },
            {
              type: "attachment",
              assetId: "file_video_1",
              fileName: "promo-final.mp4",
              mimeType: "video/mp4",
              fileSize: 1200,
              assetKind: "video",
            },
            {
              type: "tool_result",
              name: "generate_audio",
              result: {
                assetId: "file_audio_1",
                title: "Voiceover take 1",
                assetKind: "audio",
              },
            },
          ],
        }),
      ],
    });

    expect(records).toEqual([
      expect.objectContaining({
        id: buildRelationshipMemoryRecordId("conv_1", "milestone", "msg_job_1_job_1", "active"),
        memoryType: "milestone",
        summary: "Milestone: compose_media succeeded - Final promo video ready",
        status: "active",
      }),
      expect.objectContaining({
        id: buildRelationshipMemoryRecordId("conv_1", "asset_context", "msg_job_1_file_audio_1", "active"),
        memoryType: "asset_context",
        summary: "Asset context: Voiceover take 1 (audio asset file_audio_1)",
        status: "active",
      }),
    ]);
  });
});