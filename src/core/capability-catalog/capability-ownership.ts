import type { CapabilityDefinition } from "./capability-definition";
import { CAPABILITY_CATALOG } from "./catalog";
import type {
  ExecutionPlanningContext,
  ExecutionTargetKind,
} from "@/core/platform/execution/ExecutionPlanner";
import {
  ADMIN_OPERATIONS_CAPABILITIES,
  ADMIN_PILOT_CAPABILITIES,
} from "./families/admin-capabilities";
import { AFFILIATE_CAPABILITIES } from "./families/affiliate-capabilities";
import {
  BLOG_JOURNAL_CAPABILITIES,
  BLOG_PILOT_CAPABILITIES,
  BLOG_PRODUCTION_CAPABILITIES,
} from "./families/blog-capabilities";
import { CALCULATOR_CAPABILITIES } from "./families/calculator-capabilities";
import { CONVERSATION_CAPABILITIES } from "./families/conversation-capabilities";
import { CORPUS_CAPABILITIES } from "./families/corpus-capabilities";
import { JOB_CAPABILITIES } from "./families/job-capabilities";
import { MEDIA_CAPABILITIES } from "./families/media-capabilities";
import { NAVIGATION_CAPABILITIES } from "./families/navigation-capabilities";
import { PROFILE_CAPABILITIES } from "./families/profile-capabilities";
import { THEME_CAPABILITIES } from "./families/theme-capabilities";

export type ExtensionPackId =
  | "publishing"
  | "media"
  | "referrals"
  | "admin_intelligence";

export interface ExtensionPackRuntimeOwnership {
  packId: ExtensionPackId;
  defaultTargetKinds: readonly ExecutionTargetKind[];
  preferredTargetKinds: readonly ExecutionTargetKind[];
  deliveryModel:
    | "host_plus_jobs"
    | "browser_plus_worker"
    | "host_queries"
    | "mcp_sidecar";
  status: "current" | "next";
}

export type CapabilityOwnership =
  | { kind: "core" }
  | { kind: "pack"; packId: ExtensionPackId };

const CORE_TOOL_NAMES = Object.freeze([
  ...Object.keys(CALCULATOR_CAPABILITIES).filter(
    (toolName) => !["generate_chart", "generate_graph"].includes(toolName),
  ),
  ...Object.keys(THEME_CAPABILITIES),
  ...Object.keys(NAVIGATION_CAPABILITIES).filter((toolName) => toolName !== "admin_search"),
  ...Object.keys(CORPUS_CAPABILITIES),
  ...Object.keys(CONVERSATION_CAPABILITIES),
  ...Object.keys(PROFILE_CAPABILITIES),
  ...Object.keys(JOB_CAPABILITIES),
  "configure_tool_availability",
]);

export const STANDARD_HOST_CORE_TOOL_NAMES = CORE_TOOL_NAMES;

export const EXTENSION_PACK_TOOL_NAMES = Object.freeze({
  publishing: Object.freeze([
    ...Object.keys(BLOG_PILOT_CAPABILITIES),
    ...Object.keys(BLOG_JOURNAL_CAPABILITIES),
    ...Object.keys(BLOG_PRODUCTION_CAPABILITIES),
  ]),
  media: Object.freeze([
    ...Object.keys(MEDIA_CAPABILITIES),
    "generate_chart",
    "generate_graph",
  ]),
  referrals: Object.freeze(Object.keys(AFFILIATE_CAPABILITIES)),
  admin_intelligence: Object.freeze([
    ...Object.keys(ADMIN_PILOT_CAPABILITIES),
    ...Object.keys(ADMIN_OPERATIONS_CAPABILITIES),
    "admin_search",
  ]),
} satisfies Record<ExtensionPackId, readonly string[]>);

export const EXTENSION_PACK_RUNTIME_OWNERSHIP = Object.freeze({
  publishing: {
    packId: "publishing",
    defaultTargetKinds: ["host_ts", "deferred_job"],
    preferredTargetKinds: ["deferred_job", "host_ts"],
    deliveryModel: "host_plus_jobs",
    status: "current",
  },
  media: {
    packId: "media",
    defaultTargetKinds: ["browser_wasm", "native_process", "deferred_job", "host_ts"],
    preferredTargetKinds: ["browser_wasm", "native_process", "deferred_job", "host_ts"],
    deliveryModel: "browser_plus_worker",
    status: "next",
  },
  referrals: {
    packId: "referrals",
    defaultTargetKinds: ["host_ts"],
    preferredTargetKinds: ["host_ts"],
    deliveryModel: "host_queries",
    status: "current",
  },
  admin_intelligence: {
    packId: "admin_intelligence",
    defaultTargetKinds: ["host_ts", "mcp_stdio"],
    preferredTargetKinds: ["mcp_stdio", "host_ts"],
    deliveryModel: "mcp_sidecar",
    status: "current",
  },
} satisfies Record<ExtensionPackId, ExtensionPackRuntimeOwnership>);

export const NEXT_CONCRETE_EXTENSION_PACK_RUNTIME =
  EXTENSION_PACK_RUNTIME_OWNERSHIP.media;

export const NEXT_PRODUCTION_WORKLOAD_AFTER_COMPOSE_MEDIA = Object.freeze({
  capabilityName: "generate_audio",
  packId: "media" as const,
  targetKind: "remote_service" as const,
  rationale:
    "Audio generation already crosses provider-network boundaries and persists governed user_files artifacts, so it is the clearest next remote-service promotion after compose_media.",
});

const OWNERSHIP_BY_TOOL_NAME = new Map<string, CapabilityOwnership>();

for (const toolName of STANDARD_HOST_CORE_TOOL_NAMES) {
  OWNERSHIP_BY_TOOL_NAME.set(toolName, { kind: "core" });
}

for (const [packId, toolNames] of Object.entries(EXTENSION_PACK_TOOL_NAMES) as Array<
  [ExtensionPackId, readonly string[]]
>) {
  for (const toolName of toolNames) {
    OWNERSHIP_BY_TOOL_NAME.set(toolName, { kind: "pack", packId });
  }
}

for (const toolName of Object.keys(CAPABILITY_CATALOG)) {
  if (!OWNERSHIP_BY_TOOL_NAME.has(toolName)) {
    throw new Error(`Missing capability ownership for \"${toolName}\".`);
  }
}

export function getCapabilityOwnership(toolName: string): CapabilityOwnership | undefined {
  return OWNERSHIP_BY_TOOL_NAME.get(toolName);
}

export function isHostCoreCapability(toolName: string): boolean {
  return OWNERSHIP_BY_TOOL_NAME.get(toolName)?.kind === "core";
}

export function getExtensionPackCapabilities(packId: ExtensionPackId): readonly CapabilityDefinition[] {
  return EXTENSION_PACK_TOOL_NAMES[packId].map(
    (toolName) => CAPABILITY_CATALOG[toolName as keyof typeof CAPABILITY_CATALOG],
  );
}

export function getExtensionPackRuntimeOwnership(
  packId: ExtensionPackId,
): ExtensionPackRuntimeOwnership {
  return EXTENSION_PACK_RUNTIME_OWNERSHIP[packId];
}

export function getDefaultExecutionPlanningForCapability(
  toolName: string,
): ExecutionPlanningContext | null {
  const ownership = getCapabilityOwnership(toolName);
  if (!ownership || ownership.kind !== "pack") {
    return null;
  }

  if (toolName === "compose_media") {
    return {
      enabledTargetKinds: ["deferred_job", "host_ts"],
      preferredTargetKinds: ["deferred_job", "host_ts"],
      browserRuntimeAvailable: false,
    };
  }

  if (toolName === "generate_audio") {
    return {
      enabledTargetKinds: ["deferred_job"],
      preferredTargetKinds: ["deferred_job"],
      browserRuntimeAvailable: false,
    };
  }

  if (ownership.packId === "media") {
    return {
      enabledTargetKinds: EXTENSION_PACK_RUNTIME_OWNERSHIP.media.defaultTargetKinds,
      preferredTargetKinds: EXTENSION_PACK_RUNTIME_OWNERSHIP.media.preferredTargetKinds,
    };
  }

  if (
    toolName === "admin_web_search"
    || toolName === "admin_search"
    || toolName === "admin_prioritize_leads"
    || toolName === "admin_prioritize_offer"
    || toolName === "admin_triage_routing_risk"
  ) {
    return {
      enabledTargetKinds: EXTENSION_PACK_RUNTIME_OWNERSHIP.admin_intelligence.defaultTargetKinds,
      preferredTargetKinds: EXTENSION_PACK_RUNTIME_OWNERSHIP.admin_intelligence.preferredTargetKinds,
    };
  }

  return null;
}
