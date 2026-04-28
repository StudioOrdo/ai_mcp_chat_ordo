import { describe, expect, it } from "vitest";

import {
  parseStoredChartSource,
  parseStoredGraphSource,
} from "./compose-media-source-rehydration";

describe("compose-media-source-rehydration", () => {
  it("rehydrates stored Mermaid chart sources into typed payloads", () => {
    expect(parseStoredChartSource({
      assetId: "uf_chart_1",
      content: "flowchart TD\nA-->B",
      mimeType: "text/vnd.mermaid",
    })).toEqual({
      assetId: "uf_chart_1",
      mimeType: "text/vnd.mermaid",
      code: "flowchart TD\nA-->B",
    });
  });

  it("rehydrates stored graph JSON that already matches the resolved payload shape", () => {
    const result = parseStoredGraphSource({
      assetId: "uf_graph_1",
      mimeType: "application/vnd.studioordo.graph+json",
      content: JSON.stringify({
        graph: {
          kind: "table",
          data: [{ label: "A", value: 1 }],
          columns: ["label", "value"],
        },
        title: "Pipeline Mix",
      }),
    });

    expect(result).toEqual({
      assetId: "uf_graph_1",
      mimeType: "application/vnd.studioordo.graph+json",
      graph: {
        kind: "table",
        data: [{ label: "A", value: 1 }],
        columns: ["label", "value"],
      },
      title: "Pipeline Mix",
    });
  });
});