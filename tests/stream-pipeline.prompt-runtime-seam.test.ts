import { describe, expect, it, vi } from "vitest";

import type { Message } from "@/core/entities/conversation";
import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import { createSystemPromptBuilder } from "@/lib/chat/policy";
import { ChatStreamPipeline } from "@/lib/chat/stream-pipeline";

vi.mock("@/adapters/SystemPromptDataMapper", () => ({
  SystemPromptDataMapper: class SystemPromptDataMapper {
    async getActive() {
      return null;
    }
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({})),
}));

function createConversationMessage(options: {
  id: string;
  role: Message["role"];
  content: string;
  type?: "text" | "summary";
}): Message {
  return {
    id: options.id,
    conversationId: "conv_prompt_runtime",
    role: options.role,
    content: options.content,
    parts: [
      options.type === "summary"
        ? { type: "summary", text: options.content, coversUpToMessageId: options.id }
        : { type: "text", text: options.content },
    ],
    createdAt: "2026-04-02T10:00:00.000Z",
    tokenEstimate: 1,
  };
}

describe("ChatStreamPipeline prompt-runtime seam", () => {
  it("returns a real prompt-runtime result for gathered request-time sections", async () => {
    const pipeline = new ChatStreamPipeline([]);
    const latestUserText = "Help my company scope the next workflow step.";
    const builder = await createSystemPromptBuilder("ADMIN", {
      surface: "chat_stream",
      currentPathname: "/admin/leads",
      currentPageSnapshot: {
        pathname: "/admin/leads",
        title: "Leads | Admin",
        mainHeading: "Leads",
        sectionHeadings: ["Pipeline"],
        selectedText: null,
        contentExcerpt: "Review qualified leads and next follow-ups.",
      },
    });

    builder.withTrustedReferralContext({
      referralId: "ref_1",
      referralCode: "mentor-42",
      referrerUserId: "usr_affiliate",
      referrerName: "Ada Lovelace",
      referrerCredential: "Founder",
      referredUserId: null,
      conversationId: "conv_prompt_runtime",
      status: "visited",
      creditStatus: "tracked",
    });

    const history: Message[] = [
      createConversationMessage({
        id: "msg_summary",
        role: "system",
        content: "Earlier summary of the lead triage thread.",
        type: "summary",
      }),
      ...Array.from({ length: 33 }, (_, index) => {
        const isLast = index === 32;
        const role = index % 2 === 0 ? "user" : "assistant";
        return createConversationMessage({
          id: `msg_${index}`,
          role: isLast ? "user" : role,
          content: isLast ? latestUserText : `Context turn ${index + 1}`,
        });
      }),
    ];

    const interactor = {
      getForStreamingContext: vi.fn(async () => ({
        conversation: {
          routingSnapshot: createConversationRoutingSnapshot(),
        },
        messages: history,
      })),
      updateRoutingSnapshot: vi.fn(async () => undefined),
    };
    const routingAnalyzer = {
      analyze: vi.fn(async () =>
        createConversationRoutingSnapshot({
          lane: "organization",
          confidence: 0.92,
          detectedNeedSummary: "Signals point to an organizational workflow need.",
          recommendedNextStep: "Prioritize the next founder lead action.",
          lastAnalyzedAt: "2026-04-02T10:10:00.000Z",
        }),
      ),
    };
    const relationshipMemoryReader = {
      listActiveByConversation: vi.fn(async () => []),
    };

    const preparedContext = await pipeline.prepareStreamContext(
      builder,
      interactor as never,
      routingAnalyzer as never,
      relationshipMemoryReader as never,
      "conv_prompt_runtime",
      "usr_admin",
      [{ role: "user", content: latestUserText }],
      latestUserText,
      latestUserText,
      {
        sourceBlockId: "lead_queue",
        sourceContextId: "lead-queue:header",
      },
      null,
    );

    const result = await pipeline.finalizePreparedPrompt({
      builder,
      preparedContext,
      incomingMessages: [{ role: "user", content: latestUserText }],
      latestUserText,
      latestUserContent: latestUserText,
      taskOriginHandoff: {
        sourceBlockId: "lead_queue",
        sourceContextId: "lead-queue:header",
      },
      mediaContinuityHandoff: null,
      conversationId: "conv_prompt_runtime",
      userId: "usr_admin",
    });

    expect(result.guard.status).toBe("warn");
    expect(result.promptRuntimeResult).toEqual(
      expect.objectContaining({
        surface: "chat_stream",
        effectiveHash: expect.any(String),
        text: result.systemPrompt,
      }),
    );
    expect(result.promptRuntimeResult?.slotRefs).toEqual([
      expect.objectContaining({ role: "ALL", promptType: "base", source: "fallback" }),
      expect.objectContaining({ role: "ADMIN", promptType: "role_directive", source: "fallback" }),
    ]);
    expect(result.promptRuntimeResult?.sections.map((section) => section.key)).toEqual(
      expect.arrayContaining([
        "identity",
        "role_directive",
        "page_context",
        "summary",
        "context_window_guard",
        "trusted_referral",
        "routing",
        "task_origin_handoff",
      ]),
    );
    expect(result.promptRuntimeResult?.text).toContain("[Authoritative current page snapshot]");
    expect(result.promptRuntimeResult?.text).toContain("[Server referral attribution]");
    expect(result.promptRuntimeResult?.text).toContain("Ada Lovelace");
    expect(result.promptRuntimeResult?.text).toContain("[Server routing metadata]");
    expect(result.promptRuntimeResult?.text).toContain("[Server task-origin handoff]");
    expect(result.promptRuntimeResult?.text).toContain("source_context_id=lead-queue:header");
    expect(result.promptRuntimeResult?.text).toContain("[Context window guard]");
  });
});
