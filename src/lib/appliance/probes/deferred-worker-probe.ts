import {
  createProbeResult,
  type ApplianceHealthProbe,
} from "@/lib/appliance/health-types";

export type DeferredWorkerContractChecker = () => void | Promise<void>;

export interface DeferredWorkerProbeOptions {
  checkContracts?: DeferredWorkerContractChecker;
}

async function defaultContractCheck(): Promise<void> {
  const [
    { createDeferredJobHandlers },
    { assertDeferredJobRuntimeContracts },
  ] = await Promise.all([
    import("@/lib/jobs/deferred-job-handlers"),
    import("@/lib/jobs/runtime-contracts"),
  ]);

  assertDeferredJobRuntimeContracts(createDeferredJobHandlers());
}

export function createDeferredWorkerProbe(options: DeferredWorkerProbeOptions = {}): ApplianceHealthProbe {
  const checkContracts = options.checkContracts ?? defaultContractCheck;

  return {
    component: "deferred_worker",
    async run(context) {
      const worker = context.profile.deferredWorker;
      if (worker.disabled || worker.mode === "disabled") {
        return createProbeResult({
          component: "deferred_worker",
          impact: "optional",
          status: "disabled",
          checkedAt: context.generatedAt,
          summary: "Deferred job worker is disabled.",
          metadata: {
            mode: worker.mode,
            workerId: worker.workerId,
            liveHeartbeatAvailable: false,
          },
        });
      }

      try {
        await checkContracts();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Deferred worker contract check failed.";
        return createProbeResult({
          component: "deferred_worker",
          impact: "optional",
          status: "degraded",
          checkedAt: context.generatedAt,
          summary: message,
          remediation: "Fix deferred job handler/registry drift before starting workers.",
          metadata: {
            mode: worker.mode,
            workerId: worker.workerId,
            liveHeartbeatAvailable: false,
          },
          warnings: [message],
        });
      }

      return createProbeResult({
        component: "deferred_worker",
        impact: "optional",
        status: "healthy",
        checkedAt: context.generatedAt,
        summary: "Deferred worker runtime contracts are valid.",
        metadata: {
          mode: worker.mode,
          workerId: worker.workerId,
          liveHeartbeatAvailable: false,
        },
      });
    },
  };
}
