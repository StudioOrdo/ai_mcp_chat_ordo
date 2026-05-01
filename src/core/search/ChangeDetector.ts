import type { VectorStore } from "./ports/VectorStore";

/**
 * Content-hash and model-version comparison service (UB-2).
 * Lives in Core — depends only on the VectorStore port interface.
 */
export class ChangeDetector {
  constructor(private vectorStore: VectorStore) {}

  hasChanged(sourceId: string, contentHash: string): boolean {
    const storedHash = this.vectorStore.getContentHash(sourceId);
    return storedHash !== contentHash;
  }

  hasModelChanged(sourceId: string, currentModelVersion: string): boolean {
    const storedVersion = this.vectorStore.getModelVersion(sourceId);
    return storedVersion !== null && storedVersion !== currentModelVersion;
  }

  findOrphaned(sourceType: string, activeSourceIds: Set<string>): string[] {
    const storedIds = new Set(this.vectorStore.listSourceIds(sourceType));
    return [...storedIds].filter((id) => !activeSourceIds.has(id));
  }
}
