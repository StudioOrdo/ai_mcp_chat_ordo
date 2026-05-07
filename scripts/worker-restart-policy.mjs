export const DEFAULT_WORKER_RESTART_POLICY = {
  maxRestarts: 3,
  restartWindowMs: 60_000,
};

export function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getWorkerRestartPolicyFromEnv(env = process.env) {
  return {
    maxRestarts: parsePositiveInt(env.ORDO_WORKER_MAX_RESTARTS, DEFAULT_WORKER_RESTART_POLICY.maxRestarts),
    restartWindowMs: parsePositiveInt(env.ORDO_WORKER_RESTART_WINDOW_MS, DEFAULT_WORKER_RESTART_POLICY.restartWindowMs),
  };
}
