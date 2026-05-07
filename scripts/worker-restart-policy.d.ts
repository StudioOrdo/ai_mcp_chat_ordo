export interface WorkerRestartPolicy {
  maxRestarts: number;
  restartWindowMs: number;
}

export const DEFAULT_WORKER_RESTART_POLICY: WorkerRestartPolicy;

export function parsePositiveInt(value: string | undefined, fallback: number): number;

export function getWorkerRestartPolicyFromEnv(env?: Record<string, string | undefined>): WorkerRestartPolicy;
