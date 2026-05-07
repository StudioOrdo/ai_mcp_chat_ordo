import type { BackupInterval } from "./types";

const INTERVAL_MS: Record<Exclude<BackupInterval, "disabled">, number> = {
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

export function intervalToMs(interval: BackupInterval): number | null {
  return interval === "disabled" ? null : INTERVAL_MS[interval];
}

export function addBackupInterval(from: Date, interval: BackupInterval): Date | null {
  const ms = intervalToMs(interval);
  return ms === null ? null : new Date(from.getTime() + ms);
}

export function getBackupFreshnessGraceMs(interval: BackupInterval): number {
  const ms = intervalToMs(interval);
  return ms === null ? 0 : Math.max(15 * 60 * 1000, Math.floor(ms * 0.1));
}

export function isBackupPolicySchedulingEnabled(input: {
  enabled: boolean;
  interval: BackupInterval;
}): boolean {
  return input.enabled && input.interval !== "disabled";
}

export function normalizeBackupPolicySchedule(input: {
  enabled: boolean;
  interval: BackupInterval;
}): { enabled: boolean; interval: BackupInterval } {
  if (!input.enabled || input.interval === "disabled") {
    return { enabled: false, interval: "disabled" };
  }
  return input;
}
