import { getUserDataMapper } from "@/adapters/RepositoryFactory";
import { ensureDbSchema } from "@/lib/db";
import { resolvePublicOrigin, type ApplianceNetworkMode } from "@/lib/appliance/network/public-origin";
import { resolveRuntimeSecret } from "@/lib/config/secret-source";

export type InstallState = "uninitialized" | "token_required" | "ready_for_setup" | "initialized_locked" | "blocked";

export interface InstallStateView {
  ready: boolean;
  state: InstallState;
  hostedMode: ApplianceNetworkMode;
  ownerConfigured: boolean;
  setupAllowed: boolean;
  installTokenRequired: boolean;
  message?: string;
}

export function resolveInstallState(): InstallStateView {
  const network = resolvePublicOrigin();
  try {
    ensureDbSchema();
    const ownerConfigured = getUserDataMapper().hasCredentialedAdminOwner();
    if (ownerConfigured) {
      return {
        ready: true,
        state: "initialized_locked",
        hostedMode: network.mode,
        ownerConfigured: true,
        setupAllowed: false,
        installTokenRequired: false,
        message: "System is already initialized.",
      };
    }

    const installTokenRequired = network.mode === "reverse_proxy";
    return {
      ready: true,
      state: installTokenRequired ? "token_required" : "ready_for_setup",
      hostedMode: network.mode,
      ownerConfigured: false,
      setupAllowed: !installTokenRequired,
      installTokenRequired,
      ...(installTokenRequired ? { message: "Hosted setup requires an install token." } : {}),
    };
  } catch (error) {
    return {
      ready: false,
      state: "blocked",
      hostedMode: network.mode,
      ownerConfigured: false,
      setupAllowed: false,
      installTokenRequired: network.mode === "reverse_proxy",
      message: error instanceof Error ? error.message : "Environment check failed.",
    };
  }
}

export function isInstallTokenConfigured(): boolean {
  return resolveRuntimeSecret("ORDO_INSTALL_TOKEN").configured;
}
