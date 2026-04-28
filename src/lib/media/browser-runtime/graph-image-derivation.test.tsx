// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { getGraphTableTruncationDiagnostic, renderGraphToPngBlob } from "./graph-image-derivation";

describe("renderGraphToPngBlob", () => {
  it("surfaces a descriptive error when the graph payload fails validation", async () => {
    // `bar` requires both x and y encodings. Omitting `y` triggers
    // `getGraphValidationIssue`, which `GraphSvg` throws during render. The
    // previous implementation swallowed that error and surfaced a generic
    // "Graph rendering completed without an SVG output." message, which made
    // compose_media failures undiagnosable from the UI.
    await expect(
      renderGraphToPngBlob({
        graph: {
          kind: "bar",
          data: [{ month: "Jan", revenue: 1 }],
          x: { field: "month", type: "nominal" },
          // y intentionally missing
        },
      }),
    ).rejects.toThrowError(/Graph rendering failed \(kind=bar, rows=1\)/i);
  });

  it("includes the graph kind and row count in the generic no-SVG error", async () => {
    // `table` graphs have no validation guard in `GraphSvg`, but we still
    // want the generic "no SVG output" message to carry diagnostic context
    // when React genuinely does not emit an SVG (e.g. upstream override
    // using a non-default `testId`). We force that path by pointing at an
    // invalid graph kind cast through `unknown` — `GraphSvg` will throw on
    // `graph.kind` not matching any branch and we expect a descriptive wrap.
    await expect(
      renderGraphToPngBlob({
        graph: {
          // Cast through `unknown` to simulate a corrupt payload shape.
          kind: "definitely-not-a-real-kind",
          data: [],
        } as unknown as Parameters<typeof renderGraphToPngBlob>[0]["graph"],
      }),
    ).rejects.toThrowError(/rows=0/);
  });

  it("reports graph table truncation when rows exceed the render cap", () => {
    expect(getGraphTableTruncationDiagnostic({
      graph: {
        kind: "table",
        data: Array.from({ length: 8 }, (_, index) => ({ label: `Row ${index + 1}` })),
      },
    })).toEqual({ surface: "graph_table", original: 8, rendered: 6 });
  });
});
