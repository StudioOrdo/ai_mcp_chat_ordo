import { describe, expect, it } from "vitest";

import type { PresentedMessage } from "@/adapters/ChatPresenter";
import type { WorkspaceRestorePayload } from "@/core/platform/conversation-restore/WorkspaceRestore";

import { resolveProductExperienceFacade } from "./product-experience-facade";

function createPresentedHeroMessage(): PresentedMessage {
  return {
    id: "msg_hero",
    role: "assistant",
    content: { blocks: [] },
    rawContent: "Hey",
    responseState: "open",
    commands: [],
    suggestions: ["Clarify my next move"],
    actions: [],
    attachments: [],
    status: "confirmed",
    timestamp: "2026-04-29T16:00:00.000Z",
    toolRenderEntries: [],
  };
}

function createRestorePayload(overrides: Partial<WorkspaceRestorePayload> = {}): WorkspaceRestorePayload {
  return {
    workspace: {
      id: "workspace_conv_1",
      userId: "usr_1",
      conversationId: "conv_1",
      status: "active",
      title: "Launch workspace",
      currentObjective: "Review the launch workflow",
      recommendedNextStep: "Open the jobs workspace",
      openLoops: [],
      activeJobRefs: [],
      importantAssetRefs: [],
      workflowContextRef: "bwc_conv_1",
      operatorTransitionRef: null,
      trustDistributionRef: null,
      relatedBusinessRefs: [],
      latestMemoryRef: null,
      latestPromptBindingRef: null,
      updatedAt: "2026-04-29T16:00:00.000Z",
    },
    activeJobs: [],
    attentionNeededJobs: [],
    assets: [],
    reusableMediaAssets: [],
    workflow: {
      id: "bwc_conv_1",
      userId: "usr_1",
      conversationId: "conv_1",
      primaryMode: "revenue",
      origin: null,
      relatedRefs: [],
      lifecycleRefs: [],
      notificationRefs: [],
      interruptedTurnRefs: [],
      healthRefs: [],
      recommendedAction: null,
      updatedAt: "2026-04-29T16:00:00.000Z",
    },
    operatorTransition: null,
    trustDistribution: null,
    memory: null,
    recentTranscript: [],
    migration: null,
    restoreMeta: {
      schemaVersion: 1,
      restoredAt: "2026-04-29T16:00:00.000Z",
      source: "durable_read_model",
    },
    ...overrides,
  };
}

describe("resolveProductExperienceFacade", () => {
  it("routes anonymous embedded first-run state to the hero surface", () => {
    const facade = resolveProductExperienceFacade({
      isEmbedded: true,
      viewerRole: "ANONYMOUS",
      sessionSearchQuery: "",
      presentedMessages: [createPresentedHeroMessage()],
      workspaceRestore: null,
      jobStateEntries: [],
      currentConversationTitle: null,
    });

    expect(facade.kind).toBe("anonymous-hero");
    expect(facade.isHeroState).toBe(true);
    expect(facade.summary).toBeNull();
  });

  it("classifies signed-in users without active restore as returning idle", () => {
    const facade = resolveProductExperienceFacade({
      isEmbedded: true,
      viewerRole: "AUTHENTICATED",
      sessionSearchQuery: "",
      presentedMessages: [],
      workspaceRestore: null,
      jobStateEntries: [],
      currentConversationTitle: null,
    });

    expect(facade.kind).toBe("returning-idle");
    expect(facade.isHeroState).toBe(false);
    expect(facade.summary?.objective).toBe("No active work in progress");
  });

  it("classifies interrupted restore context separately from general active work", () => {
    const base = createRestorePayload();
    const facade = resolveProductExperienceFacade({
      isEmbedded: true,
      viewerRole: "AUTHENTICATED",
      sessionSearchQuery: "",
      presentedMessages: [],
      workspaceRestore: {
        ...base,
        workflow: {
          ...base.workflow!,
          interruptedTurnRefs: [
            {
              turnId: "turn_1",
              conversationId: "conv_1",
              recoveredAt: null,
              evidenceRefs: [],
            },
          ],
        },
      },
      jobStateEntries: [],
      currentConversationTitle: null,
    });

    expect(facade.kind).toBe("interrupted-recovery");
  });

  it("classifies blocking workflow state separately from general active work", () => {
    const base = createRestorePayload();
    const facade = resolveProductExperienceFacade({
      isEmbedded: true,
      viewerRole: "AUTHENTICATED",
      sessionSearchQuery: "",
      presentedMessages: [],
      workspaceRestore: {
        ...base,
        workflow: {
          ...base.workflow!,
          healthRefs: [
            {
              id: "health_1",
              severity: "blocking",
              label: "Resolve setup blocker",
              source: {
                sourceKind: "conversation",
                sourceId: "conv_1",
                userId: "usr_1",
                conversationId: "conv_1",
              },
            },
          ],
        },
      },
      jobStateEntries: [],
      currentConversationTitle: null,
    });

    expect(facade.kind).toBe("returning-blocked");
    expect(facade.summary?.workflow?.blockerLabel).toBe("Resolve setup blocker");
  });
});
