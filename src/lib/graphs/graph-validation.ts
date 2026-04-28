import type { GraphSpec } from "@/core/entities/rich-content";

export function getGraphValidationIssue(graph: GraphSpec): string | undefined {
  switch (graph.kind) {
    case "table":
      return undefined;
    case "histogram":
      return graph.x ? undefined : "Histogram graphs require an x encoding before they can render.";
    case "heatmap":
      if (!graph.x || !graph.y) {
        return "Heatmaps require both x and y encodings before they can render.";
      }
      return undefined;
    case "bubble":
      if (!graph.x || !graph.y) {
        return "Bubble graphs require both x and y encodings before they can render.";
      }
      if (!graph.size) {
        return "Bubble graphs require a size encoding before they can render.";
      }
      return undefined;
    default:
      return graph.x && graph.y
        ? undefined
        : `${graph.kind} graphs require both x and y encodings before they can render.`;
  }
}