import type { BrowserRuntimeToolName } from "./browser-capability-registry";

export type PersistedBrowserRuntimeStatus = "queued" | "running";

export interface PersistedBrowserRuntimeEntry {
  jobId: string;
  toolName: BrowserRuntimeToolName;
  conversationId: string | null;
  status: PersistedBrowserRuntimeStatus;
  updatedAt: string;
}

const STORAGE_KEY = "studioordo.browser-runtime.v1";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

function readStorageEntries(storage: StorageLike | null): PersistedBrowserRuntimeEntry[] {
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is PersistedBrowserRuntimeEntry => {
      return typeof entry === "object"
        && entry !== null
        && typeof (entry as { jobId?: unknown }).jobId === "string"
        && typeof (entry as { toolName?: unknown }).toolName === "string"
        && (((entry as { conversationId?: unknown }).conversationId === null)
          || typeof (entry as { conversationId?: unknown }).conversationId === "string")
        && (((entry as { status?: unknown }).status === "queued")
          || (entry as { status?: unknown }).status === "running")
        && typeof (entry as { updatedAt?: unknown }).updatedAt === "string";
    });
  } catch {
    return [];
  }
}

function writeStorageEntries(storage: StorageLike | null, entries: PersistedBrowserRuntimeEntry[]): void {
  if (!storage) {
    return;
  }

  if (entries.length === 0) {
    storage.removeItem(STORAGE_KEY);
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function readPersistedBrowserRuntimeEntries(): PersistedBrowserRuntimeEntry[] {
  return readStorageEntries(getStorage());
}

export function upsertPersistedBrowserRuntimeEntry(entry: PersistedBrowserRuntimeEntry): void {
  const storage = getStorage();
  const entries = readStorageEntries(storage);
  const nextEntries = entries.filter((existing) => existing.jobId !== entry.jobId);
  nextEntries.push(entry);
  writeStorageEntries(storage, nextEntries);
}

export function removePersistedBrowserRuntimeEntry(jobId: string): void {
  const storage = getStorage();
  const entries = readStorageEntries(storage);
  const nextEntries = entries.filter((entry) => entry.jobId !== jobId);
  writeStorageEntries(storage, nextEntries);
}

export function clearPersistedBrowserRuntimeEntries(): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(STORAGE_KEY);
  }
}

export function clearPersistedBrowserRuntimeEntriesForConversation(
  conversationId: string | null,
): void {
  const storage = getStorage();
  const entries = readStorageEntries(storage);
  const nextEntries = entries.filter((entry) => entry.conversationId !== conversationId);
  writeStorageEntries(storage, nextEntries);
}

export function restorePersistedBrowserRuntimeEntry(
  jobId: string,
): PersistedBrowserRuntimeEntry | null {
  const entries = readStorageEntries(getStorage());
  return entries.find((entry) => entry.jobId === jobId) ?? null;
}