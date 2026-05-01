import type { PresentedMessage } from "@/adapters/ChatPresenter";
import type { RoleName } from "@/core/entities/user";
import type { WorkspaceRestorePayload } from "@/core/platform/conversation-restore/WorkspaceRestore";
import type { JobStateEntry } from "@/hooks/chat/useJobStateStore";

import {
  buildProductExperienceSummary,
  type ProductExperienceSummaryModel,
} from "./product-experience-summary";

export type ProductExperienceStateKind =
  | "anonymous-hero"
  | "conversation-history"
  | "returning-idle"
  | "returning-active"
  | "returning-blocked"
  | "interrupted-recovery";

export interface ProductExperienceFacadeModel {
  kind: ProductExperienceStateKind;
  isHeroState: boolean;
  summary: ProductExperienceSummaryModel | null;
}

interface ResolveProductExperienceFacadeOptions {
  isEmbedded: boolean;
  viewerRole: RoleName;
  sessionSearchQuery: string;
  presentedMessages: readonly PresentedMessage[];
  workspaceRestore: WorkspaceRestorePayload | null;
  jobStateEntries: readonly JobStateEntry[];
  currentConversationTitle: string | null;
}

function isAnonymousHeroStateCandidate(
  isEmbedded: boolean,
  viewerRole: RoleName,
  sessionSearchQuery: string,
  presentedMessages: readonly PresentedMessage[],
): boolean {
  return Boolean(
    isEmbedded
    && viewerRole === "ANONYMOUS"
    && !sessionSearchQuery
    && presentedMessages.length === 1
    && presentedMessages[0]?.role === "assistant"
    && presentedMessages[0]?.responseState === "open"
    && presentedMessages[0]?.suggestions.length > 0,
  );
}

function resolveSummaryStateKind(
  summary: ProductExperienceSummaryModel,
  workspaceRestore: WorkspaceRestorePayload | null,
): ProductExperienceStateKind {
  if ((workspaceRestore?.workflow?.interruptedTurnRefs.length ?? 0) > 0) {
    return "interrupted-recovery";
  }

  if (summary.workflow?.blockerLabel || (summary.jobs?.attentionCount ?? 0) > 0) {
    return "returning-blocked";
  }

  if ((summary.jobs?.activeCount ?? 0) > 0 || summary.assets || summary.memory || summary.workflow || summary.transition) {
    return "returning-active";
  }

  return "returning-idle";
}

export function resolveProductExperienceFacade({
  isEmbedded,
  viewerRole,
  sessionSearchQuery,
  presentedMessages,
  workspaceRestore,
  jobStateEntries,
  currentConversationTitle,
}: ResolveProductExperienceFacadeOptions): ProductExperienceFacadeModel {
  if (isAnonymousHeroStateCandidate(isEmbedded, viewerRole, sessionSearchQuery, presentedMessages)) {
    return {
      kind: "anonymous-hero",
      isHeroState: true,
      summary: null,
    };
  }

  if (sessionSearchQuery) {
    return {
      kind: "conversation-history",
      isHeroState: false,
      summary: null,
    };
  }

  const summary = buildProductExperienceSummary({
    workspaceRestore,
    jobStateEntries,
    currentConversationTitle,
    viewerRole,
  });

  if (!summary) {
    return {
      kind: "conversation-history",
      isHeroState: false,
      summary: null,
    };
  }

  return {
    kind: resolveSummaryStateKind(summary, workspaceRestore),
    isHeroState: false,
    summary,
  };
}