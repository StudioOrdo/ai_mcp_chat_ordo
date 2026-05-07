import type { RoleName } from "@/core/entities/user";
import type {
  ProviderCapabilityAvailabilityState,
} from "@/lib/ai/providers/provider-capability-availability";
import type {
  CapabilityProviderId,
  CapabilitySlotId,
} from "@/lib/ai/providers/types";

export type ToolAvailabilityState =
  | "enabled"
  | "disabled_by_install_profile"
  | "disabled_by_static_config"
  | "disabled_by_admin"
  | "missing_provider_key"
  | "provider_disabled"
  | "role_denied"
  | "request_filtered"
  | "system_reserved"
  | "unknown_tool";

export type ToolAvailabilityReason =
  | "catalog_declared"
  | "install_profile_default"
  | "install_profile_disabled"
  | "protected_recovery_tool"
  | "static_enabled_whitelist"
  | "static_disabled"
  | "admin_enabled"
  | "admin_disabled"
  | "missing_openai_key"
  | "provider_capability_disabled"
  | "role_not_allowed"
  | "request_allowed_tool_filter"
  | "unknown_tool_name";

export type ToolPolicyLayer =
  | "catalog"
  | "protected"
  | "install_profile"
  | "static_config"
  | "admin_runtime"
  | "provider_capability"
  | "role"
  | "request";

export type ToolInstallGroup =
  | "core_default"
  | "default_optional"
  | "provider_gated_optional"
  | "business_feature_optional";

export interface ToolAvailabilityOverride {
  enabled?: readonly string[];
  disabled?: readonly string[];
}

export interface ToolAvailabilityWarning {
  code:
    | "unknown_tool"
    | "protected_tool_not_disabled"
    | "static_config_locked"
    | "settings_unavailable"
    | "invalid_settings";
  toolName?: string;
  message: string;
}

export interface EffectiveToolAvailability {
  name: string;
  label: string;
  description: string;
  category: string;
  bundleId: string | null;
  roles: readonly RoleName[] | "ALL";
  installGroup: ToolInstallGroup;
  protected: boolean;
  state: ToolAvailabilityState;
  reason: ToolAvailabilityReason;
  layer: ToolPolicyLayer;
  providerCapabilitySlot: CapabilitySlotId | null;
  providerCapabilityState: ProviderCapabilityAvailabilityState | null;
  providerCapabilityProvider: CapabilityProviderId | null;
  toggleable: boolean;
  staticLocked: boolean;
}

export interface EffectiveToolManifest {
  tools: EffectiveToolAvailability[];
  warnings: ToolAvailabilityWarning[];
  version: string;
}

export interface RoleFilteredToolAvailability extends EffectiveToolAvailability {
  roleState: ToolAvailabilityState;
  roleReason: ToolAvailabilityReason;
}
