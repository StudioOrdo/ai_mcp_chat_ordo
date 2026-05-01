import { describe, expect, it } from "vitest";

import { resolveGenerateChartPayload } from "./chart-payload";

describe("resolveGenerateChartPayload", () => {
  it("builds a flowchart with subgraphs and class defs", () => {
    const payload = resolveGenerateChartPayload({
      title: "Routing Risk",
      caption: "Service triage by urgency",
      downloadFileName: "routing_risk",
      spec: {
        chartType: "flowchart",
        direction: "TD",
        nodes: [
          { id: "inbox", label: "New conversations", className: "entry" },
          { id: "risk", label: "Routing risk", shape: "diamond", className: "risk" },
          { id: "owner", label: "Assign owner", shape: "round" },
        ],
        edges: [
          { from: "inbox", to: "risk", label: "triage" },
          { from: "risk", to: "owner", label: "intervene", lineStyle: "thick" },
        ],
        subgraphs: [{ title: "Operator review", nodes: ["risk", "owner"] }],
        classDefs: [
          { name: "entry", styles: ["fill:#e2e8f0", "stroke:#0f172a"] },
          { name: "risk", styles: ["fill:#fee2e2", "stroke:#b91c1c"] },
        ],
      },
    });

    expect(payload.code).toContain("flowchart TD");
    expect(payload.code).toContain('subgraph ["Operator review"]');
    expect(payload.code).toContain("classDef risk fill:#fee2e2,stroke:#b91c1c");
    expect(payload.title).toBe("Routing Risk");
    expect(payload.caption).toBe("Service triage by urgency");
    expect(payload.downloadFileName).toBe("routing_risk");
  });

  it("builds a quadrant chart from points", () => {
    const payload = resolveGenerateChartPayload({
      spec: {
        chartType: "quadrant",
        title: "Founder Focus",
        xAxis: { minLabel: "Low urgency", maxLabel: "High urgency" },
        yAxis: { minLabel: "Low revenue", maxLabel: "High revenue" },
        quadrants: {
          topRight: "Act now",
          topLeft: "Protect outcome",
          bottomLeft: "Monitor",
          bottomRight: "Experiment",
        },
        points: [
          { label: "23 drop-off", x: 0.84, y: 0.88 },
          { label: "1 converted", x: 0.25, y: 0.31 },
        ],
      },
    });

    expect(payload.code).toContain("quadrantChart");
    expect(payload.code).toContain("quadrant-1 Act now");
    expect(payload.code).toContain("23 drop-off: [0.84, 0.88]");
  });

  it("normalizes quadrant point labels and percentage coordinates for Mermaid rendering", () => {
    const payload = resolveGenerateChartPayload({
      spec: {
        chartType: "quadrant",
        title: "The LLM Paradox",
        xAxis: { minLabel: "Low", maxLabel: "High" },
        yAxis: { minLabel: "Low", maxLabel: "High" },
        points: [
          { label: "LLM Today", x: 15, y: 85 },
          { label: "Human Expert", x: 90, y: 90 },
        ],
      },
    });

    expect(payload.code).toContain("LLM Today: [0.15, 0.85]");
    expect(payload.code).toContain("Human Expert: [0.9, 0.9]");
  });

  it("normalizes existing quoted quadrant code before server rendering", () => {
    const payload = resolveGenerateChartPayload({
      code: [
        "quadrantChart",
        "    x-axis Low --> High",
        "    y-axis Low --> High",
        "    \"LLM Today\": [15, 85]",
      ].join("\n"),
    });

    expect(payload.code).toContain("    LLM Today: [0.15, 0.85]");
  });
});
