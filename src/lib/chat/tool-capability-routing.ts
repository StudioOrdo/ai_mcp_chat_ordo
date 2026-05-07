import type Anthropic from "@anthropic-ai/sdk";

import type { ConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type { RoleName } from "@/core/entities/user";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import {
  mediaContinuityHasAudioAsset,
  mediaContinuityHasVisualAsset,
  type MediaContinuityHandoff,
} from "@/lib/chat/media-continuity-handoff";

import { isHighConfidenceLane } from "./routing-consumers";

const NAVIGATION_CONTEXT_TOOLS = [
  "get_current_page",
  "inspect_runtime_context",
  "list_available_pages",
  "navigate_to_page",
] as const;

const CORPUS_DISCOVERY_TOOLS = [
  "search_corpus",
  "get_corpus_summary",
  "get_section",
  "get_checklist",
  "list_practitioners",
] as const;

const MEMBER_STATE_TOOLS = [
  "search_relationship_memory",
  "search_my_conversations",
  "get_my_profile",
  "update_my_profile",
  "get_my_referral_qr",
  "get_my_affiliate_summary",
  "list_my_referral_activity",
  "get_my_job_status",
  "list_my_jobs",
  "set_preference",
] as const;

const ADMIN_OPERATIONS_TOOLS = [
  "admin_search",
  "admin_web_search",
  "admin_prioritize_leads",
  "admin_prioritize_offer",
  "admin_triage_routing_risk",
  "get_admin_affiliate_summary",
  "list_admin_referral_exceptions",
] as const;

const ADMIN_QUEUE_TOOLS = [
  "get_deferred_job_status",
  "list_deferred_jobs",
] as const;

const ADMIN_EDITORIAL_READ_TOOLS = [
  "get_journal_workflow_summary",
  "list_journal_posts",
  "get_journal_post",
  "list_journal_revisions",
] as const;

const DEVELOPMENT_OUTPUT_TOOLS = [
  "calculator",
  "generate_audio",
  "generate_chart",
  "generate_graph",
  "list_conversation_media_assets",
  "compose_media",
] as const;

const ADMIN_LANE_ALLOWLISTS = {
  organization: [
    ...NAVIGATION_CONTEXT_TOOLS,
    ...CORPUS_DISCOVERY_TOOLS,
    ...ADMIN_OPERATIONS_TOOLS,
    ...ADMIN_QUEUE_TOOLS,
    ...ADMIN_EDITORIAL_READ_TOOLS,
    "search_my_conversations",
  ],
  individual: [
    ...NAVIGATION_CONTEXT_TOOLS,
    ...CORPUS_DISCOVERY_TOOLS,
    ...MEMBER_STATE_TOOLS,
  ],
  development: [
    ...NAVIGATION_CONTEXT_TOOLS,
    ...CORPUS_DISCOVERY_TOOLS,
    ...MEMBER_STATE_TOOLS,
    ...ADMIN_QUEUE_TOOLS,
    ...ADMIN_EDITORIAL_READ_TOOLS,
    ...DEVELOPMENT_OUTPUT_TOOLS,
  ],
} as const;

export interface RequestScopedToolSelection {
  tools: Anthropic.Tool[];
  allowedToolNames: string[];
  prefiltered: boolean;
}

const VIDEO_INTENT_PATTERN = /\b(video|mp4|clip|reel|short|trailer|b-roll)\b/i;
const IMAGE_INTENT_PATTERN = /\b(image|images|picture|pictures|photo|photos|thumbnail|hero image|illustration)\b/i;
const MEDIA_REUSE_INTENT_PATTERN = /\b(combine|reuse|animate|overlay|sync|use (?:the|that|those|these|previous|earlier)|add audio|with audio|with the audio|turn (?:it|them|that|this) into (?:a )?(?:video|clip|reel|short)|make (?:a )?(?:video|clip|reel|short) from)\b/i;
const VIDEO_FIRST_EXCLUDED_TOOLS = new Set([
  "generate_blog_image",
  "generate_blog_image_prompt",
  "select_journal_hero_image",
]);
const CONTINUITY_GENERATION_EXCLUDED_TOOLS = new Set([
  "generate_audio",
  "generate_chart",
  "generate_graph",
]);

export const OPERATION_BACKED_CHAT_EXCLUDED_TOOLS = new Set([
  "create_appliance_backup",
  "list_appliance_backups",
  "validate_appliance_backup",
  "prepare_appliance_restore",
  "request_pre_restore_backup",
  "confirm_appliance_restore",
  "execute_appliance_restore",
  "cancel_appliance_restore",
  "configure_backup_policy",
  "produce_product",
]);

export function filterOperationBackedPromptTools<T extends { name: string }>(tools: readonly T[]): T[] {
  return tools.filter((tool) => !OPERATION_BACKED_CHAT_EXCLUDED_TOOLS.has(tool.name));
}

function applyVideoFirstToolSelection(
  tools: Anthropic.Tool[],
  latestUserText?: string,
): Anthropic.Tool[] {
  const text = latestUserText?.trim() ?? "";
  if (!text) {
    return tools;
  }

  if (!VIDEO_INTENT_PATTERN.test(text) || IMAGE_INTENT_PATTERN.test(text)) {
    return tools;
  }

  const toolNames = new Set(tools.map((tool) => tool.name));
  if (!toolNames.has("compose_media")) {
    return tools;
  }

  const filtered = tools.filter((tool) => !VIDEO_FIRST_EXCLUDED_TOOLS.has(tool.name));
  return filtered.length > 0 ? filtered : tools;
}

function applyMediaContinuityToolSelection(
  tools: Anthropic.Tool[],
  latestUserText: string | undefined,
  mediaContinuityHandoff: MediaContinuityHandoff | null | undefined,
): Anthropic.Tool[] {
  const text = latestUserText?.trim() ?? "";
  if (!text || !mediaContinuityHandoff || !MEDIA_REUSE_INTENT_PATTERN.test(text)) {
    return tools;
  }

  const toolNames = new Set(tools.map((tool) => tool.name));
  if (!toolNames.has("compose_media")) {
    return tools;
  }

  if (!mediaContinuityHasVisualAsset(mediaContinuityHandoff) || !mediaContinuityHasAudioAsset(mediaContinuityHandoff)) {
    return tools;
  }

  const filtered = tools.filter((tool) => !CONTINUITY_GENERATION_EXCLUDED_TOOLS.has(tool.name));
  return filtered.length > 0 ? filtered : tools;
}

export function getRequestScopedToolSelection(
  registry: ToolRegistry,
  role: RoleName,
  snapshot: ConversationRoutingSnapshot,
  latestUserText?: string,
  mediaContinuityHandoff?: MediaContinuityHandoff | null,
): RequestScopedToolSelection {
  const tools = filterOperationBackedPromptTools(registry.getPromptVisibleSchemasForRole(role, {
    mode: role === "ADMIN" ? "operator_chat" : "default_chat",
  }) as Anthropic.Tool[]);

  const applyRequestFilters = (candidateTools: Anthropic.Tool[]) => {
    const videoFirstTools = applyVideoFirstToolSelection(candidateTools, latestUserText);
    const continuityTools = applyMediaContinuityToolSelection(
      videoFirstTools,
      latestUserText,
      mediaContinuityHandoff,
    );

    return {
      tools: continuityTools,
      prefiltered: continuityTools.length !== tools.length,
    };
  };

  if (role !== "ADMIN" || !isHighConfidenceLane(snapshot) || snapshot.lane === "uncertain") {
    const requestScoped = applyRequestFilters(tools);
    return {
      tools: requestScoped.tools,
      allowedToolNames: requestScoped.tools.map((tool) => tool.name),
      prefiltered: requestScoped.prefiltered,
    };
  }

  const allowlist = new Set<string>(ADMIN_LANE_ALLOWLISTS[snapshot.lane]);
  const filteredTools = tools.filter((tool) => allowlist.has(tool.name));

  if (filteredTools.length === 0 || filteredTools.length === tools.length) {
    const requestScoped = applyRequestFilters(tools);
    return {
      tools: requestScoped.tools,
      allowedToolNames: requestScoped.tools.map((tool) => tool.name),
      prefiltered: requestScoped.prefiltered,
    };
  }

  const laneScopedTools = applyMediaContinuityToolSelection(
    applyVideoFirstToolSelection(filteredTools, latestUserText),
    latestUserText,
    mediaContinuityHandoff,
  );

  return {
    tools: laneScopedTools,
    allowedToolNames: laneScopedTools.map((tool) => tool.name),
    prefiltered: true,
  };
}
