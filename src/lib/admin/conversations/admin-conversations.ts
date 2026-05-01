/**
 * D4.6 — Conversation admin loaders.
 *
 * Provides list and detail view models for the conversations admin surface.
 * Uses the admin extension methods added to ConversationDataMapper (D4.7).
 */

import { getConversationDataMapper, getMessageDataMapper, getUserDataMapper, getConversationEventDataMapper, getIdentityMigrationRepository } from "@/adapters/RepositoryFactory";
import type { IdentityMigrationEvent } from "@/core/entities/identity-migration";
import type { Message } from "@/core/entities/conversation";
import type { ConversationEventData } from "@/core/use-cases/ConversationEventRecorder";
import { getAdminConversationDetailPath } from "./admin-conversations-routes";
import { getReferralLedgerService } from "@/lib/referrals/referral-ledger";
import { getConversationPurgeEligibility } from "@/lib/chat/conversation-portability";
import { buildTranscriptFromMessages, type TranscriptEntry } from "@/lib/chat/transcript-store";
import { listPromptTurnAudits, type PromptTurnAuditEntry } from "@/lib/prompts/prompt-provenance-service";

// ── View-model types ───────────────────────────────────────────────────

export interface AdminConversationListEntry {
  id: string;
  userId: string;
  userName: string;
  title: string;
  status: string;
  lane: string;
  laneConfidence: number | null;
  messageCount: number;
  lastToolUsed: string | null;
  sessionSource: string;
  conversationMode: string;
  createdAt: string;
  updatedAt: string;
  detailHref: string;
  deletedAt: string | null;
  deletedByUserId: string | null;
  deleteReason: string | null;
  purgeAfter: string | null;
  restoredAt: string | null;
}

export interface AdminConversationDetailViewModel {
  conversation: AdminConversationListEntry & {
    detectedNeedSummary: string | null;
    recommendedNextStep: string | null;
    promptVersion: number | null;
    referralId: string | null;
    referralSource: string | null;
    trustedReferrerName: string | null;
    trustedReferrerCredential: string | null;
    convertedFrom: string | null;
    importedAt: string | null;
    importSourceConversationId: string | null;
    importedFromExportedAt: string | null;
    purgeEligible: boolean;
    purgeBlockedReason: string | null;
  };
  messages: Array<{
    id: string;
    role: string;
    content: string;
    parts: unknown[];
    tokenEstimate: number;
    createdAt: string;
  }>;
  transcript: {
    entries: TranscriptEntry[];
    entryCount: number;
    inContextCount: number;
    toolResultCount: number;
    compactionMarkerCount: number;
  };
  events: ConversationEventData[];
  promptProvenance: PromptTurnAuditEntry[];
  migration: IdentityMigrationEvent | null;
  totalTokens: number;
}

export interface ConversationFilters {
  status?: string;
  lane?: string;
  sessionSource?: string;
}

export interface AdminConversationsPipelineData {
  entries: AdminConversationListEntry[];
  total: number;
  statusCounts: Record<string, number>;
  laneCounts: Record<string, number>;
  filters: ConversationFilters;
}

// ── Loaders ────────────────────────────────────────────────────────────

export async function loadAdminConversations(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<AdminConversationsPipelineData> {
  const convMapper = getConversationDataMapper();
  const userMapper = getUserDataMapper();

  const filters: ConversationFilters = {
    status: typeof searchParams.status === "string" ? searchParams.status : undefined,
    lane: typeof searchParams.lane === "string" ? searchParams.lane : undefined,
    sessionSource: typeof searchParams.sessionSource === "string" ? searchParams.sessionSource : undefined,
  };

  const [rows, total, statusCounts, laneCounts] = await Promise.all([
    convMapper.listForAdmin(filters),
    convMapper.countForAdmin(filters),
    convMapper.countByStatus(),
    convMapper.countByLane(),
  ]);

  // Build a map of user IDs → names
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const userNames = new Map<string, string>();
  for (const uid of userIds) {
    const user = await userMapper.findById(uid);
    userNames.set(uid, user?.name ?? user?.email ?? uid);
  }

  const entries: AdminConversationListEntry[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: userNames.get(r.userId) ?? r.userId,
    title: r.title,
    status: r.deletedAt ? "deleted" : r.status,
    lane: r.routingSnapshot.lane,
    laneConfidence: r.routingSnapshot.confidence,
    messageCount: r.messageCount,
    lastToolUsed: r.lastToolUsed,
    sessionSource: r.sessionSource,
    conversationMode: (r as unknown as Record<string, unknown>).conversationMode as string ?? "ai",
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    detailHref: getAdminConversationDetailPath(r.id),
    deletedAt: r.deletedAt ?? null,
    deletedByUserId: r.deletedByUserId ?? null,
    deleteReason: r.deleteReason ?? null,
    purgeAfter: r.purgeAfter ?? null,
    restoredAt: r.restoredAt ?? null,
  }));

  return { entries, total, statusCounts, laneCounts, filters };
}

export async function loadAdminConversationDetail(
  id: string,
): Promise<AdminConversationDetailViewModel> {
  const convMapper = getConversationDataMapper();
  const msgMapper = getMessageDataMapper();
  const userMapper = getUserDataMapper();
  const eventMapper = getConversationEventDataMapper();

  const conv = await convMapper.findById(id);
  if (!conv) {
    throw new Error(`Conversation not found: ${id}`);
  }

  const user = await userMapper.findById(conv.userId);
  const userName = user?.name ?? user?.email ?? conv.userId;
  const trustedReferral = await getReferralLedgerService().getTrustedReferrerContext(id);
  const { eligible: purgeEligible, blockedReason: purgeBlockedReason } = getConversationPurgeEligibility(conv);

  const messages = await msgMapper.listByConversation(id);
  const totalTokens = messages.reduce((sum: number, m: Message) => sum + m.tokenEstimate, 0);
  const transcriptEntries = buildTranscriptFromMessages(messages);
  const events = await eventMapper.listByConversation(id);
  const promptProvenance = await listPromptTurnAudits(id);
  const latestMigration = await getIdentityMigrationRepository().findLatestForTargetIdentity(conv.userId);
  const migration = latestMigration?.migratedConversationIds.includes(conv.id) ? latestMigration : null;

  const entry: AdminConversationDetailViewModel["conversation"] = {
    id: conv.id,
    userId: conv.userId,
    userName,
    title: conv.title,
    status: conv.status,
    lane: conv.routingSnapshot.lane,
    laneConfidence: conv.routingSnapshot.confidence,
    messageCount: conv.messageCount,
    lastToolUsed: conv.lastToolUsed,
    sessionSource: conv.sessionSource,
    conversationMode: (conv as unknown as Record<string, unknown>).conversationMode as string ?? "ai",
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    detailHref: getAdminConversationDetailPath(conv.id),
    detectedNeedSummary: conv.routingSnapshot.detectedNeedSummary,
    recommendedNextStep: conv.routingSnapshot.recommendedNextStep,
    promptVersion: conv.promptVersion,
    referralId: conv.referralId ?? trustedReferral?.referralId ?? null,
    referralSource: conv.referralSource,
    trustedReferrerName: trustedReferral?.referrerName ?? null,
    trustedReferrerCredential: trustedReferral?.referrerCredential ?? null,
    convertedFrom: conv.convertedFrom,
    deletedAt: conv.deletedAt ?? null,
    deletedByUserId: conv.deletedByUserId ?? null,
    deleteReason: conv.deleteReason ?? null,
    purgeAfter: conv.purgeAfter ?? null,
    restoredAt: conv.restoredAt ?? null,
    importedAt: conv.importedAt ?? null,
    importSourceConversationId: conv.importSourceConversationId ?? null,
    importedFromExportedAt: conv.importedFromExportedAt ?? null,
    purgeEligible,
    purgeBlockedReason,
  };

  return {
    conversation: entry,
    messages: messages.map((m: Message) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      parts: m.parts,
      tokenEstimate: m.tokenEstimate,
      createdAt: m.createdAt,
    })),
    transcript: {
      entries: transcriptEntries,
      entryCount: transcriptEntries.length,
      inContextCount: transcriptEntries.filter((entry) => entry.inContextWindow).length,
      toolResultCount: transcriptEntries.filter((entry) => entry.role === "tool_result").length,
      compactionMarkerCount: transcriptEntries.filter((entry) => entry.role === "compaction_marker").length,
    },
    events,
    promptProvenance,
    migration,
    totalTokens,
  };
}
