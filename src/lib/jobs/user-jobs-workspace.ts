import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";

export function isActiveUserJobStatus(status: CanonicalJobSnapshot["status"]): boolean {
  return status === "queued" || status === "running";
}

export function getUserJobSnapshotTimestamp(snapshot: CanonicalJobSnapshot): number {
  const value = snapshot.updatedAt;
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortUserJobSnapshots(snapshots: CanonicalJobSnapshot[]): CanonicalJobSnapshot[] {
  return [...snapshots].sort((left, right) => {
    const activeDelta = Number(isActiveUserJobStatus(right.status)) - Number(isActiveUserJobStatus(left.status));
    if (activeDelta !== 0) {
      return activeDelta;
    }

    return getUserJobSnapshotTimestamp(right) - getUserJobSnapshotTimestamp(left);
  });
}
