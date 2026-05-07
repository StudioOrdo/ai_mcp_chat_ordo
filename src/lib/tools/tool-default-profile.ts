import { CAPABILITY_CATALOG } from "@/core/capability-catalog/catalog";
import {
  EXTENSION_PACK_TOOL_NAMES,
  STANDARD_HOST_CORE_TOOL_NAMES,
  getCapabilityOwnership,
} from "@/core/capability-catalog/capability-ownership";
import {
  getProviderBackedToolNames,
  isProviderBackedToolName,
} from "./tool-provider-capability-policy";
import type { ToolInstallGroup } from "./tool-policy-types";

export const PROTECTED_TOOL_NAMES = Object.freeze([
  "inspect_runtime_context",
  "inspect_runtime_logs",
  "inspect_theme",
  "set_theme",
  "adjust_ui",
  "configure_tool_availability",
] as const);

const DEFAULT_OPTIONAL_TOOL_NAMES = Object.freeze([
  "search_relationship_memory",
  "search_my_conversations",
  "get_my_referral_qr",
  "get_my_affiliate_summary",
  "list_my_referral_activity",
  "list_conversation_media_assets",
  "generate_chart",
  "generate_graph",
  "compose_media",
] as const);

const BUSINESS_FEATURE_OPTIONAL_TOOL_NAMES = Object.freeze([
  ...EXTENSION_PACK_TOOL_NAMES.publishing,
  "admin_prioritize_leads",
  "admin_prioritize_offer",
  "admin_triage_routing_risk",
  "get_admin_affiliate_summary",
  "list_admin_referral_exceptions",
  "produce_product",
] as const);

const protectedSet = new Set<string>(PROTECTED_TOOL_NAMES);
const defaultOptionalSet = new Set<string>(DEFAULT_OPTIONAL_TOOL_NAMES);
const businessFeatureSet = new Set<string>(BUSINESS_FEATURE_OPTIONAL_TOOL_NAMES);
const coreSet = new Set<string>(STANDARD_HOST_CORE_TOOL_NAMES);

export function isProtectedTool(toolName: string): boolean {
  return protectedSet.has(toolName);
}

export function getToolInstallGroup(toolName: string): ToolInstallGroup {
  if (isProviderBackedToolName(toolName)) {
    return "provider_gated_optional";
  }

  if (businessFeatureSet.has(toolName)) {
    return "business_feature_optional";
  }

  if (defaultOptionalSet.has(toolName)) {
    return "default_optional";
  }

  if (coreSet.has(toolName) || isProtectedTool(toolName)) {
    return "core_default";
  }

  const ownership = getCapabilityOwnership(toolName);
  if (ownership?.kind === "pack") {
    return "business_feature_optional";
  }

  return toolName in CAPABILITY_CATALOG ? "core_default" : "business_feature_optional";
}

export function isKnownToolName(toolName: string): boolean {
  return toolName in CAPABILITY_CATALOG;
}

export function getDefaultEnabledToolNames(): readonly string[] {
  return Object.keys(CAPABILITY_CATALOG);
}

export { getProviderBackedToolNames };
