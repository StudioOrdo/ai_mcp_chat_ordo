import { DEFAULT_WORKER_RESTART_POLICY } from "./worker-restart-policy.mjs";

export const MAX_WORKER_RESTARTS = DEFAULT_WORKER_RESTART_POLICY.maxRestarts;
export const RESTART_WINDOW_MS = DEFAULT_WORKER_RESTART_POLICY.restartWindowMs;

export interface WorkerSupervisorOptions {
  maxRestarts?: number;
  windowMs?: number;
  onRestart: (restartCount: number, maxRestarts: number) => void;
  onShutdown: (restartCount: number) => void;
  now?: () => number;
}

export interface WorkerSupervisor {
  handleExit(shuttingDown: boolean): void;
  isHealthy(): boolean;
  resetState(): void;
}

export function createWorkerSupervisor(options: WorkerSupervisorOptions): WorkerSupervisor {
  const maxRestarts = options.maxRestarts ?? MAX_WORKER_RESTARTS;
  const windowMs = options.windowMs ?? RESTART_WINDOW_MS;
  const getNow = options.now ?? (() => Date.now());

  let restartTimestamps: number[] = [];
  let healthy = true;

  return {
    handleExit(shuttingDown: boolean): void {
      if (shuttingDown) return;

      healthy = false;

      const now = getNow();
      restartTimestamps = restartTimestamps.filter((t) => now - t < windowMs);
      restartTimestamps.push(now);

      if (restartTimestamps.length > maxRestarts) {
        options.onShutdown(restartTimestamps.length);
        return;
      }

      options.onRestart(restartTimestamps.length, maxRestarts);
      healthy = true;
    },

    isHealthy(): boolean {
      return healthy;
    },

    resetState(): void {
      restartTimestamps = [];
      healthy = true;
    },
  };
}
