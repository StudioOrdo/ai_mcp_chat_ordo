import {
  getWorkerRestartPolicyFromEnv,
} from "../../../../scripts/worker-restart-policy.mjs";

export interface WorkerRestartPolicy {
  maxRestarts: number;
  restartWindowMs: number;
}

export function getWorkerRestartPolicy(): WorkerRestartPolicy {
  return getWorkerRestartPolicyFromEnv(process.env);
}
