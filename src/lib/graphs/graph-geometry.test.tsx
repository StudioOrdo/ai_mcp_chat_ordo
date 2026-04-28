import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { GraphSpec } from "@/core/entities/rich-content";

import { GraphSvg } from "./GraphSvg";
import { computeGraphGeometry } from "./graph-geometry";
import { getGraphSvgMarkup } from "./graph-svg-markup";

const GRAPH_SNAPSHOT_CASES: ReadonlyArray<{ name: string; graph: GraphSpec }> = [
  {
    name: "bar",
    graph: {
      kind: "bar",
      data: [
        { month: "Jan", revenue: 10 },
        { month: "Feb", revenue: 25 },
        { month: "Mar", revenue: 18 },
      ],
      x: { field: "month", type: "ordinal", label: "Month" },
      y: { field: "revenue", type: "quantitative", label: "Revenue" },
    },
  },
  {
    name: "grouped-bar",
    graph: {
      kind: "grouped-bar",
      data: [
        { week: "W1", leads: 4, team: "North" },
        { week: "W1", leads: 3, team: "South" },
        { week: "W2", leads: 7, team: "North" },
        { week: "W2", leads: 2, team: "South" },
      ],
      x: { field: "week", type: "ordinal", label: "Week" },
      y: { field: "leads", type: "quantitative", label: "Leads" },
      series: { field: "team", type: "nominal", label: "Team" },
    },
  },
  {
    name: "stacked-bar",
    graph: {
      kind: "stacked-bar",
      data: [
        { week: "W1", leads: 4, team: "North" },
        { week: "W1", leads: 3, team: "South" },
        { week: "W2", leads: 7, team: "North" },
        { week: "W2", leads: 2, team: "South" },
      ],
      x: { field: "week", type: "ordinal", label: "Week" },
      y: { field: "leads", type: "quantitative", label: "Leads" },
      series: { field: "team", type: "nominal", label: "Team" },
    },
  },
  {
    name: "line",
    graph: {
      kind: "line",
      data: [
        { day: "2026-04-01", leads: 4 },
        { day: "2026-04-02", leads: 6 },
        { day: "2026-04-03", leads: 9 },
      ],
      x: { field: "day", type: "temporal", label: "Day" },
      y: { field: "leads", type: "quantitative", label: "Leads" },
    },
  },
  {
    name: "area",
    graph: {
      kind: "area",
      data: [
        { day: "2026-04-01", sessions: 18 },
        { day: "2026-04-02", sessions: 24 },
        { day: "2026-04-03", sessions: 20 },
      ],
      x: { field: "day", type: "temporal", label: "Day" },
      y: { field: "sessions", type: "quantitative", label: "Sessions" },
    },
  },
  {
    name: "scatter",
    graph: {
      kind: "scatter",
      data: [
        { conversion: 1.8, velocity: 14 },
        { conversion: 2.5, velocity: 18 },
        { conversion: 3.1, velocity: 11 },
      ],
      x: { field: "conversion", type: "quantitative", label: "Conversion" },
      y: { field: "velocity", type: "quantitative", label: "Velocity" },
    },
  },
  {
    name: "bubble",
    graph: {
      kind: "bubble",
      data: [
        { month: "Jan", revenue: 10, size: 1 },
        { month: "Feb", revenue: 20, size: 9 },
        { month: "Mar", revenue: 16, size: 4 },
      ],
      x: { field: "month", type: "ordinal", label: "Month" },
      y: { field: "revenue", type: "quantitative", label: "Revenue" },
      size: { field: "size", type: "quantitative", label: "Share" },
    },
  },
  {
    name: "heatmap",
    graph: {
      kind: "heatmap",
      data: [
        { lane: "ops", urgency: "high", count: 5 },
        { lane: "ops", urgency: "medium", count: 2 },
        { lane: "advisory", urgency: "high", count: 1 },
      ],
      x: { field: "lane", type: "ordinal", label: "Lane" },
      y: { field: "urgency", type: "ordinal", label: "Urgency" },
      color: { field: "count", type: "quantitative", label: "Count" },
    },
  },
  {
    name: "table",
    graph: {
      kind: "table",
      columns: ["company", "stage"],
      data: [
        { company: "Acme", stage: "new" },
        { company: "Northwind", stage: "qualified" },
        { company: "Contoso", stage: "proposal" },
      ],
    },
  },
];

describe("computeGraphGeometry", () => {
  it("builds categorical bar domains and default y ticks", () => {
    const geometry = computeGraphGeometry({
      kind: "bar",
      data: [
        { month: "Jan", revenue: 10 },
        { month: "Feb", revenue: 25 },
      ],
      x: { field: "month", type: "ordinal" },
      y: { field: "revenue", type: "quantitative" },
    });

    expect(geometry.categoricalDomain).toEqual(["Jan", "Feb"]);
    expect(geometry.yTicks).toHaveLength(5);
  });

  it("orders temporal line points chronologically", () => {
    const geometry = computeGraphGeometry({
      kind: "line",
      data: [
        { day: "2026-04-03", leads: 9 },
        { day: "2026-04-01", leads: 4 },
        { day: "2026-04-02", leads: 6 },
      ],
      x: { field: "day", type: "temporal" },
      y: { field: "leads", type: "quantitative" },
    });

    expect(geometry.orderedGroupedPoints[0]?.points.map((point) => point.xValue)).toEqual([
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
    ]);
  });

  it("builds stable bubble radius lookups", () => {
    const geometry = computeGraphGeometry({
      kind: "bubble",
      data: [
        { month: "Jan", revenue: 10, size: 1 },
        { month: "Feb", revenue: 20, size: 9 },
      ],
      x: { field: "month", type: "ordinal" },
      y: { field: "revenue", type: "quantitative" },
      size: { field: "size", type: "quantitative" },
    });

    const [firstPoint, secondPoint] = geometry.points;
    expect(firstPoint).toBeDefined();
    expect(secondPoint).toBeDefined();
    expect(geometry.bubbleRadiusForPoint(secondPoint!)).toBeGreaterThan(geometry.bubbleRadiusForPoint(firstPoint!));
    expect(geometry.bubbleRadiusForPoint(secondPoint!)).toBe(geometry.bubbleRadiusForPoint(secondPoint!));
  });

  it("avoids linear scans when resolving bubble radii", () => {
    const findSpy = vi.spyOn(Array.prototype, "find");
    const filterSpy = vi.spyOn(Array.prototype, "filter");
    const geometry = computeGraphGeometry({
      kind: "bubble",
      data: Array.from({ length: 1_000 }, (_, index) => ({
        month: `M${index}`,
        revenue: index + 1,
        size: (index % 10) + 1,
      })),
      x: { field: "month", type: "ordinal" },
      y: { field: "revenue", type: "quantitative" },
      size: { field: "size", type: "quantitative" },
    });

    findSpy.mockClear();
    filterSpy.mockClear();

    for (const point of geometry.points) {
      geometry.bubbleRadiusForPoint(point);
    }

    expect(findSpy).not.toHaveBeenCalled();
    expect(filterSpy).not.toHaveBeenCalled();
  });

  it("uses the last duplicate bubble row when identities collide", () => {
    const geometry = computeGraphGeometry({
      kind: "bubble",
      data: [
        { month: "Jan", revenue: 10, size: 1 },
        { month: "Jan", revenue: 10, size: 9 },
      ],
      x: { field: "month", type: "ordinal" },
      y: { field: "revenue", type: "quantitative" },
      size: { field: "size", type: "quantitative" },
    });

    expect(geometry.points).toHaveLength(2);
    expect(geometry.bubbleRadiusForPoint(geometry.points[0]!)).toBe(16);
    expect(geometry.bubbleRadiusForPoint(geometry.points[1]!)).toBe(16);
  });

  it("builds heatmap cells with normalized opacity colors", () => {
    const geometry = computeGraphGeometry({
      kind: "heatmap",
      data: [
        { lane: "ops", urgency: "high", count: 5 },
        { lane: "ops", urgency: "medium", count: 2 },
        { lane: "advisory", urgency: "high", count: 1 },
      ],
      x: { field: "lane", type: "ordinal" },
      y: { field: "urgency", type: "ordinal" },
      color: { field: "count", type: "quantitative" },
    });

    expect(geometry.heatmapCells).toHaveLength(3);
    expect(geometry.heatmapColorForValue(5)).toMatch(/^rgba\(15, 118, 110, /);
  });

  it("truncates table rows to the existing display cap", () => {
    const geometry = computeGraphGeometry({
      kind: "table",
      data: Array.from({ length: 20 }, (_, index) => ({ label: `Row ${index + 1}`, value: index + 1 })),
      columns: ["label", "value"],
    });

    expect(geometry.table?.rows).toHaveLength(6);
    expect(geometry.table?.truncated).toBe(true);
  });

  it("respects explicit dimensions", () => {
    const geometry = computeGraphGeometry({
      kind: "line",
      data: [
        { week: "W1", leads: 4 },
        { week: "W2", leads: 7 },
      ],
      x: { field: "week", type: "ordinal" },
      y: { field: "leads", type: "quantitative" },
    }, 1920, 1080);

    expect(geometry.dimensions).toEqual({ width: 1920, height: 1080 });
    expect(geometry.innerWidth).toBe(1920 - 64 - 24);
    expect(geometry.innerHeight).toBe(1080 - 24 - 72);
  });

  it("keeps table graphs non-throwing without x/y encodings", () => {
    expect(() => computeGraphGeometry({
      kind: "table",
      data: [{ label: "W1", value: 4 }],
      columns: ["label", "value"],
    })).not.toThrow();
  });
});

describe("graph renderers", () => {
  for (const { name, graph } of GRAPH_SNAPSHOT_CASES) {
    it(`preserves React renderer output for ${name}`, () => {
      expect(renderToStaticMarkup(<GraphSvg graph={graph} />)).toMatchSnapshot();
    });

    it(`preserves string renderer output for ${name}`, async () => {
      await expect(getGraphSvgMarkup(graph)).resolves.toMatchSnapshot();
    });
  }
});