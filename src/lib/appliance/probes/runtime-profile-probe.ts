import {
  createProbeResult,
  type ApplianceHealthProbe,
} from "@/lib/appliance/health-types";

export function createRuntimeProfileProbe(): ApplianceHealthProbe {
  return {
    component: "runtime",
    run(context) {
      const profile = context.profile;
      const knownProfile = profile.profileId !== "unknown";
      const status = !knownProfile
        ? "unknown"
        : profile.warnings.length > 0
          ? "degraded"
          : "healthy";

      return createProbeResult({
        component: "runtime",
        impact: "required",
        status,
        checkedAt: context.generatedAt,
        summary: knownProfile
          ? `Runtime profile is ${profile.profileId}.`
          : "Runtime profile could not be classified.",
        remediation: status === "healthy"
          ? null
          : "Review runtime environment variables and container startup configuration.",
        metadata: {
          profileId: profile.profileId,
          processRole: profile.processRole,
          nodeEnv: profile.nodeEnv,
          isDocker: profile.isDocker,
          isCompose: profile.isCompose,
          mediaWorkerMode: profile.mediaWorker.mode,
          deferredWorkerMode: profile.deferredWorker.mode,
        },
        warnings: profile.warnings,
      });
    },
  };
}

