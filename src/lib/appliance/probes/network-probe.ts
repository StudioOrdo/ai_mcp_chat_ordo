import { resolvePublicOrigin } from "@/lib/appliance/network/public-origin";
import {
  createProbeResult,
  type ApplianceHealthProbe,
} from "@/lib/appliance/health-types";

export function createNetworkProbe(): ApplianceHealthProbe {
  return {
    component: "network",
    run(context) {
      const resolution = resolvePublicOrigin();
      const blocked = resolution.mode === "reverse_proxy" && resolution.errors.length > 0;
      const degraded = !blocked && (resolution.errors.length > 0 || resolution.warnings.length > 0);

      return createProbeResult({
        component: "network",
        impact: "required",
        status: blocked ? "blocked" : degraded ? "degraded" : "healthy",
        checkedAt: context.generatedAt,
        summary: blocked
          ? "Hosted network public origin is not configured correctly."
          : `Network mode is ${resolution.mode}.`,
        remediation: blocked
          ? "Set ORDO_PUBLIC_ORIGIN to the HTTPS browser-facing origin for this appliance."
          : degraded
            ? "Review public origin and proxy header environment values."
            : null,
        metadata: {
          mode: resolution.mode,
          origin: resolution.origin,
          source: resolution.source,
          trustProxyHeaders: resolution.trustProxyHeaders,
          allowedOriginCount: resolution.allowedOrigins.length,
        },
        warnings: [...resolution.errors, ...resolution.warnings],
      });
    },
  };
}
