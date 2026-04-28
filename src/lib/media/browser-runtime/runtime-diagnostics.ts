export type BrowserRuntimeTruncationSurface = "graph_table" | "caption_lines" | "mermaid_nodes";

export interface BrowserRuntimeTruncationDiagnostic {
  surface: BrowserRuntimeTruncationSurface;
  original: number;
  rendered: number;
}

export function sortTruncationDiagnostics<T extends BrowserRuntimeTruncationDiagnostic>(
  diagnostics: readonly T[],
): T[] {
  return [...diagnostics].sort((left, right) => left.surface.localeCompare(right.surface));
}
