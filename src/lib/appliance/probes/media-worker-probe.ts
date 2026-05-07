import {
  createProbeResult,
  type ApplianceHealthProbe,
} from "@/lib/appliance/health-types";
import { MediaWorkerClient, type MediaWorkerHealthResult } from "@/lib/media/server/media-worker-client";

export interface MediaWorkerProbeOptions {
  checkHealth?: (url: string, timeoutMs: number) => Promise<MediaWorkerHealthResult>;
}

function resolveHealthUrl(contextUrl: string | null, port: number | null): string | null {
  if (contextUrl) {
    return contextUrl;
  }
  if (port) {
    return `http://127.0.0.1:${port}`;
  }
  return null;
}

export function createMediaWorkerProbe(options: MediaWorkerProbeOptions = {}): ApplianceHealthProbe {
  return {
    component: "media_worker",
    async run(context) {
      const mediaWorker = context.profile.mediaWorker;
      if (mediaWorker.disabled || mediaWorker.mode === "disabled") {
        return createProbeResult({
          component: "media_worker",
          impact: "optional",
          status: "disabled",
          checkedAt: context.generatedAt,
          summary: "Media worker is disabled.",
          metadata: { mode: mediaWorker.mode },
        });
      }

      const url = resolveHealthUrl(mediaWorker.url, mediaWorker.port);
      if (!url || (context.profile.nodeEnv === "test" && !mediaWorker.url)) {
        return createProbeResult({
          component: "media_worker",
          impact: "optional",
          status: "unknown",
          checkedAt: context.generatedAt,
          summary: "Media worker health URL is not available in this runtime.",
          remediation: "Start the app through the managed dev/server entrypoint or configure MEDIA_WORKER_URL.",
          metadata: {
            mode: mediaWorker.mode,
            url,
          },
        });
      }

      const checkHealth = options.checkHealth
        ?? (async (baseUrl: string, timeoutMs: number) => new MediaWorkerClient({ baseUrl }).checkHealth({ timeoutMs }));

      const result = await checkHealth(url, context.timeoutMs);

      if (result.ok) {
        return createProbeResult({
          component: "media_worker",
          impact: "optional",
          status: "healthy",
          checkedAt: context.generatedAt,
          summary: "Media worker health endpoint is reachable.",
          metadata: {
            mode: mediaWorker.mode,
            url,
            statusCode: result.statusCode,
          },
        });
      }

      return createProbeResult({
        component: "media_worker",
        impact: "optional",
        status: "degraded",
        checkedAt: context.generatedAt,
        summary: result.error ?? "Media worker health endpoint is degraded.",
        remediation: "Check media worker process, compose service health, and MEDIA_WORKER_URL.",
        metadata: {
          mode: mediaWorker.mode,
          url,
          statusCode: result.statusCode,
        },
        warnings: [result.error ?? "Media worker health check failed."],
      });
    },
  };
}

