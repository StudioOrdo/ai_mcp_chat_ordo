import { resolvePublicOrigin } from "@/lib/appliance/network/public-origin";
import { resolveInternalRuntimeServiceTokenState } from "@/lib/config/env";
import { createProbeResult, type ApplianceHealthProbe } from "../health-types";

export function createSecurityProbe(): ApplianceHealthProbe {
  return {
    component: "security",
    run(context) {
      const token = resolveInternalRuntimeServiceTokenState();
      const network = resolvePublicOrigin();
      const unsafeHostedDefault = network.mode === "reverse_proxy" && token.unsafeDefault;

      return createProbeResult({
        component: "security",
        status: unsafeHostedDefault ? "blocked" : token.unsafeDefault ? "degraded" : "healthy",
        impact: "required",
        summary: unsafeHostedDefault
          ? "Hosted runtime is using an unsafe default internal service token."
          : token.unsafeDefault
            ? "Local runtime is using the development internal service token."
            : "Runtime secrets are configured.",
        remediation: unsafeHostedDefault
          ? "Set ORDO_INTERNAL_RUNTIME_SERVICE_TOKEN or ORDO_INTERNAL_RUNTIME_SERVICE_TOKEN_FILE."
          : null,
        metadata: {
          internalRuntimeServiceToken: {
            configured: token.configured,
            source: token.source,
            unsafeDefault: token.unsafeDefault,
          },
        },
        checkedAt: context.generatedAt,
        warnings: token.unsafeDefault ? ["Internal runtime service token is using the development default."] : [],
      });
    },
  };
}
