import { describe, expect, it } from "vitest";

import { renderMermaidChartSvg } from "./compose-media-mermaid-renderer";

describe("compose media Mermaid renderer", () => {
  it("renders charts repeatedly in the same process", async () => {
    const chartCode = "flowchart TD\nA[Motivation] --> B[Trust]\nB --> C[Opportunity]\n";

    const firstSvg = await renderMermaidChartSvg(chartCode);
    const secondSvg = await renderMermaidChartSvg(chartCode);
    const thirdSvg = await renderMermaidChartSvg(chartCode);

    expect(firstSvg).toContain("<svg");
    expect(secondSvg).toContain("<svg");
    expect(thirdSvg).toContain("<svg");
    expect(firstSvg.length).toBeGreaterThan(0);
    expect(secondSvg.length).toBeGreaterThan(0);
    expect(thirdSvg.length).toBeGreaterThan(0);
  }, 30_000);
});