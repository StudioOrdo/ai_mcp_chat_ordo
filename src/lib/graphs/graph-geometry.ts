import type { GraphAxisType, GraphKind, GraphRow, GraphSpec, GraphValue } from "@/core/entities/rich-content";
import {
  GRAPH_BUBBLE_MIN_RADIUS,
  GRAPH_BUBBLE_RADIUS_SPAN,
  GRAPH_HEATMAP_ALPHA_SPAN,
  GRAPH_HEATMAP_MIN_ALPHA,
  GRAPH_MAX_CATEGORICAL_TICKS,
  GRAPH_SVG_HEIGHT,
  GRAPH_SVG_WIDTH,
  GRAPH_TABLE_MAX_COLUMNS,
  GRAPH_TABLE_MAX_ROWS,
} from "./graph-visual-constants";

const GRAPH_COLORS = ["#0f766e", "#1d4ed8", "#b45309", "#be123c", "#7c3aed", "#0f766e"];

export type GraphSeriesPoint = {
  xValue: GraphValue;
  yValue: number;
  seriesKey: string;
};

export type GraphSeriesGroup = {
  key: string;
  points: readonly GraphSeriesPoint[];
};

export type GraphBarGroupEntry = {
  domainValue: GraphValue;
  seriesKey: string;
  total: number;
};

export type GraphStackedBarGroup = {
  domainValue: GraphValue;
  series: ReadonlyArray<{
    seriesKey: string;
    total: number;
  }>;
};

export type GraphHeatmapFields = {
  xField: string;
  yField: string;
  colorField: string;
};

export type GraphHeatmapCell = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
};

export type GraphTableLayout = {
  columns: readonly string[];
  rows: readonly GraphRow[];
  truncated: boolean;
  margin: number;
  headerHeight: number;
  rowHeight: number;
  tableWidth: number;
  columnWidth: number;
};

export interface GraphGeometry {
  readonly graph: GraphSpec;
  readonly kind: GraphKind;
  readonly dimensions: { width: number; height: number };
  readonly margin: { top: number; right: number; bottom: number; left: number };
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly seriesKeys: readonly string[];
  readonly points: readonly GraphSeriesPoint[];
  readonly groupedPoints: readonly GraphSeriesGroup[];
  readonly orderedGroupedPoints: readonly GraphSeriesGroup[];
  readonly isBarLike: boolean;
  readonly useContinuousX: boolean;
  readonly categoricalX: boolean;
  readonly categoricalDomain: readonly GraphValue[];
  readonly xTicks: readonly (GraphValue | number)[];
  readonly yTicks: readonly number[];
  readonly xDomain: readonly [number, number];
  readonly yDomain: readonly [number, number];
  readonly xAxisLabel: string;
  readonly yAxisLabel: string;
  readonly barGroups: ReadonlyArray<ReadonlyArray<GraphBarGroupEntry>>;
  readonly stackedBarGroups: readonly GraphStackedBarGroup[];
  readonly heatmapFields: GraphHeatmapFields | null;
  readonly heatmapXDomain: readonly GraphValue[];
  readonly heatmapYDomain: readonly GraphValue[];
  readonly heatmapCells: readonly GraphHeatmapCell[];
  readonly table: GraphTableLayout | null;
  readonly formatValue: (value: GraphValue, type?: GraphAxisType) => string;
  readonly getSeriesColor: (key: string) => string;
  readonly yScale: (value: number) => number;
  readonly categoricalXScale: (value: GraphValue) => number;
  readonly continuousXScale: (value: number) => number;
  readonly xPositionForTick: (value: GraphValue | number) => number;
  readonly xPositionForPoint: (point: GraphSeriesPoint) => number;
  readonly bubbleRadiusForPoint: (point: GraphSeriesPoint) => number;
  readonly heatmapColorForValue: (value: number) => string;
}

function isSeriesPoint(point: GraphSeriesPoint | null): point is GraphSeriesPoint {
  return point !== null;
}

function toNumber(value: GraphValue, type?: GraphAxisType): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (type === "temporal" && typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (type === "quantitative" && typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function getCategoricalDomain(rows: GraphRow[], field: string, type?: GraphAxisType): GraphValue[] {
  const values = rows
    .map((row) => row[field])
    .filter((value): value is GraphValue => value !== undefined && value !== null);

  if (type === "quantitative" || type === "temporal") {
    const sortable = values
      .map((value) => ({ value, numeric: toNumber(value, type) }))
      .filter((entry): entry is { value: GraphValue; numeric: number } => entry.numeric !== undefined)
      .sort((left, right) => left.numeric - right.numeric);

    return sortable
      .filter((entry, index, list) => list.findIndex((candidate) => candidate.numeric === entry.numeric) === index)
      .map((entry) => entry.value);
  }

  const unique: GraphValue[] = [];
  for (const value of values) {
    if (!unique.some((entry) => entry === value)) unique.push(value);
  }
  return unique;
}

function getContinuousDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  return [min, max];
}

function buildTicks(min: number, max: number, count = 4): number[] {
  if (count <= 1) return [min, max];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, index) => min + step * index);
}

function buildSeriesPoints(graph: GraphSpec): GraphSeriesPoint[] {
  if (!graph.x || !graph.y) return [];

  return graph.data
    .map<GraphSeriesPoint | null>((row) => {
      const xValue = row[graph.x?.field ?? ""];
      const yValue = row[graph.y?.field ?? ""];
      const numericY = typeof yValue === "number" && Number.isFinite(yValue) ? yValue : undefined;
      if (xValue === undefined || xValue === null || numericY === undefined) {
        return null;
      }

      return {
        xValue,
        yValue: numericY,
        seriesKey: graph.series ? String(row[graph.series.field] ?? "Unspecified") : "Series 1",
      };
    })
    .filter(isSeriesPoint);
}

function getSeriesKeys(graph: GraphSpec): string[] {
  if (!graph.series) return ["Series 1"];
  const keys = Array.from(
    new Set(
      graph.data
        .map((row) => row[graph.series?.field ?? ""])
        .filter((value): value is GraphValue => value !== undefined)
        .map((value) => String(value ?? "Unspecified")),
    ),
  );
  return keys.length > 0 ? keys : ["Series 1"];
}

function getColumns(graph: GraphSpec): string[] {
  if (graph.columns && graph.columns.length > 0) return graph.columns;
  const columns: string[] = [];
  for (const row of graph.data) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  return columns;
}

function formatGraphValue(value: GraphValue, type?: GraphAxisType): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  }
  if (type === "temporal" && typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(parsed));
    }
  }
  return String(value);
}

function getSeriesColorFactory(seriesKeys: readonly string[]) {
  return (key: string): string => {
    const index = Math.max(seriesKeys.indexOf(key), 0);
    return GRAPH_COLORS[index % GRAPH_COLORS.length];
  };
}

function serializeGraphValue(value: GraphValue): string {
  if (value === null) return "null:";
  return `${typeof value}:${String(value)}`;
}

function getPointIdentity(point: { xValue: GraphValue; yValue: number; seriesKey: string }): string {
  return `${serializeGraphValue(point.xValue)}|number:${point.yValue}|string:${point.seriesKey}`;
}

export function computeGraphGeometry(
  graph: GraphSpec,
  width = GRAPH_SVG_WIDTH,
  height = GRAPH_SVG_HEIGHT,
): GraphGeometry {
  const margin = { top: 24, right: 24, bottom: 72, left: 64 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const points = buildSeriesPoints(graph);
  const seriesKeys = getSeriesKeys(graph);
  const getSeriesColor = getSeriesColorFactory(seriesKeys);
  const isBarLike = graph.kind === "bar" || graph.kind === "grouped-bar" || graph.kind === "stacked-bar" || graph.kind === "histogram";
  const isXYPlot = graph.kind === "line" || graph.kind === "area" || graph.kind === "scatter" || graph.kind === "bubble";
  const yValues = points.map((point) => point.yValue);
  const [yMinBase, yMaxBase] = getContinuousDomain(yValues);
  const yMin = isBarLike ? Math.min(0, yMinBase) : yMinBase;
  const yMax = isBarLike ? Math.max(0, yMaxBase) : yMaxBase;
  const yTicks = buildTicks(yMin, yMax, 4);

  const useContinuousX = isXYPlot && (graph.x?.type === "quantitative" || graph.x?.type === "temporal");
  const categoricalX = !useContinuousX;
  const categoricalDomain = graph.x ? getCategoricalDomain(graph.data, graph.x.field, graph.x.type) : [];
  const continuousXValues = graph.x
    ? points
        .map((point) => toNumber(point.xValue, graph.x?.type))
        .filter((value): value is number => value !== undefined)
    : [];
  const [xMin, xMax] = getContinuousDomain(continuousXValues);

  const yScale = (value: number) => margin.top + innerHeight - ((value - yMin) / (yMax - yMin || 1)) * innerHeight;
  const categoricalXScale = (value: GraphValue) => {
    const index = Math.max(categoricalDomain.findIndex((entry) => entry === value), 0);
    if (isBarLike) {
      const band = innerWidth / Math.max(categoricalDomain.length, 1);
      return margin.left + index * band;
    }
    if (categoricalDomain.length === 1) return margin.left + innerWidth / 2;
    return margin.left + (index / Math.max(categoricalDomain.length - 1, 1)) * innerWidth;
  };
  const continuousXScale = (value: number) => margin.left + ((value - xMin) / (xMax - xMin || 1)) * innerWidth;

  const groupedPoints = seriesKeys.map((seriesKey) => ({
    key: seriesKey,
    points: points.filter((point) => point.seriesKey === seriesKey),
  }));
  const orderedGroupedPoints = groupedPoints.map((group) => ({
    key: group.key,
    points: group.points.slice().sort((left, right) => {
      if (useContinuousX) {
        const leftValue = toNumber(left.xValue, graph.x?.type) ?? 0;
        const rightValue = toNumber(right.xValue, graph.x?.type) ?? 0;
        return leftValue - rightValue;
      }
      const leftIndex = categoricalDomain.findIndex((entry) => entry === left.xValue);
      const rightIndex = categoricalDomain.findIndex((entry) => entry === right.xValue);
      return leftIndex - rightIndex;
    }),
  }));

  const sizeField = graph.size?.field;
  const sizeValues = sizeField
    ? graph.data.map((row) => row[sizeField]).flatMap((value) => {
        try {
          return [toNumber(value ?? null, graph.size?.type) ?? 0];
        } catch {
          return [0];
        }
      })
    : [];
  const [sizeMin, sizeMax] = getContinuousDomain(sizeValues);
  const bubbleRadiusLookup = new Map<string, number>();
  if (graph.kind === "bubble" && sizeField) {
    for (const row of graph.data) {
      const xValue = row[graph.x?.field ?? ""];
      const yValue = row[graph.y?.field ?? ""];
      const seriesKey = graph.series ? String(row[graph.series.field] ?? "Unspecified") : "Series 1";
      if (xValue === undefined || xValue === null || typeof yValue !== "number" || !Number.isFinite(yValue)) {
        continue;
      }
      const numeric = toNumber(row[sizeField] ?? null, graph.size?.type) ?? sizeMin;
      const normalized = (numeric - sizeMin) / (sizeMax - sizeMin || 1);
      const key = getPointIdentity({ xValue, yValue, seriesKey });
      // Duplicate identity rows are tolerated; the last row wins.
      bubbleRadiusLookup.set(key, GRAPH_BUBBLE_MIN_RADIUS + normalized * GRAPH_BUBBLE_RADIUS_SPAN);
    }
  }
  const bubbleRadiusForPoint = (point: GraphSeriesPoint) => bubbleRadiusLookup.get(getPointIdentity(point)) ?? GRAPH_BUBBLE_MIN_RADIUS;

  const barGroups = (graph.kind === "bar" || graph.kind === "grouped-bar" || graph.kind === "histogram")
    ? categoricalDomain.map((domainValue) => seriesKeys.map((seriesKey) => ({
        domainValue,
        seriesKey,
        total: points
          .filter((point) => point.xValue === domainValue && point.seriesKey === seriesKey)
          .reduce((sum, point) => sum + point.yValue, 0),
      })))
    : [];
  const stackedBarGroups = graph.kind === "stacked-bar"
    ? categoricalDomain.map((domainValue) => ({
        domainValue,
        series: seriesKeys.map((seriesKey) => ({
          seriesKey,
          total: points
            .filter((point) => point.xValue === domainValue && point.seriesKey === seriesKey)
            .reduce((sum, point) => sum + point.yValue, 0),
        })),
      }))
    : [];

  const heatmapFields = graph.kind === "heatmap" && graph.x && graph.y && graph.color
    ? {
        xField: graph.x.field,
        yField: graph.y.field,
        colorField: graph.color.field,
      }
    : null;
  const heatmapXDomain = heatmapFields ? getCategoricalDomain(graph.data, heatmapFields.xField, graph.x?.type) : [];
  const heatmapYDomain = heatmapFields ? getCategoricalDomain(graph.data, heatmapFields.yField, graph.y?.type) : [];
  const heatmapColorValues = heatmapFields
    ? graph.data.map((row) => Number(row[heatmapFields.colorField] ?? 0)).filter((value) => Number.isFinite(value))
    : [];
  const [heatmapMin, heatmapMax] = getContinuousDomain(heatmapColorValues);
  const heatmapColorForValue = (value: number) => {
    const normalized = (value - heatmapMin) / (heatmapMax - heatmapMin || 1);
    return `rgba(15, 118, 110, ${GRAPH_HEATMAP_MIN_ALPHA + normalized * GRAPH_HEATMAP_ALPHA_SPAN})`;
  };
  const heatmapCells = heatmapFields
    ? graph.data.map((row, index) => {
        const xIndex = heatmapXDomain.findIndex((entry) => entry === row[heatmapFields.xField]);
        const yIndex = heatmapYDomain.findIndex((entry) => entry === row[heatmapFields.yField]);
        const cellWidth = innerWidth / Math.max(heatmapXDomain.length, 1);
        const cellHeight = innerHeight / Math.max(heatmapYDomain.length, 1);
        return {
          index,
          x: margin.left + xIndex * cellWidth,
          y: margin.top + yIndex * cellHeight,
          width: Math.max(cellWidth - 2, 2),
          height: Math.max(cellHeight - 2, 2),
          value: Number(row[heatmapFields.colorField] ?? 0),
        };
      })
    : [];
  const xTicks = categoricalX
    ? categoricalDomain.filter(
        (_, index, list) => list.length <= GRAPH_MAX_CATEGORICAL_TICKS || index % Math.ceil(list.length / GRAPH_MAX_CATEGORICAL_TICKS) === 0,
      )
    : buildTicks(xMin, xMax, 4);

  const xPositionForTick = (value: GraphValue | number) => {
    if (!categoricalX && typeof value === "number") {
      return continuousXScale(value);
    }
    const categoricalValue = value as GraphValue;
    return isBarLike
      ? categoricalXScale(categoricalValue) + innerWidth / Math.max(categoricalDomain.length, 1) / 2
      : categoricalXScale(categoricalValue);
  };
  const xPositionForPoint = (point: GraphSeriesPoint) => {
    const numericX = toNumber(point.xValue, graph.x?.type);
    return numericX !== undefined && !categoricalX ? continuousXScale(numericX) : categoricalXScale(point.xValue);
  };

  const tableColumns = getColumns(graph).slice(0, GRAPH_TABLE_MAX_COLUMNS);
  const tableRows = graph.data.slice(0, GRAPH_TABLE_MAX_ROWS);
  const tableMargin = 24;
  const tableHeaderHeight = 34;
  const tableRowHeight = 34;
  const tableWidth = width - tableMargin * 2;
  const tableColumnWidth = tableColumns.length > 0 ? tableWidth / tableColumns.length : tableWidth;
  const table = graph.kind === "table"
    ? {
        columns: tableColumns,
        rows: tableRows,
        truncated: graph.data.length > tableRows.length,
        margin: tableMargin,
        headerHeight: tableHeaderHeight,
        rowHeight: tableRowHeight,
        tableWidth,
        columnWidth: tableColumnWidth,
      }
    : null;

  return {
    graph,
    kind: graph.kind,
    dimensions: { width, height },
    margin,
    innerWidth,
    innerHeight,
    seriesKeys,
    points,
    groupedPoints,
    orderedGroupedPoints,
    isBarLike,
    useContinuousX,
    categoricalX,
    categoricalDomain,
    xTicks,
    yTicks,
    xDomain: [xMin, xMax],
    yDomain: [yMin, yMax],
    xAxisLabel: graph.x?.label ?? graph.x?.field ?? "X",
    yAxisLabel: graph.y?.label ?? graph.y?.field ?? "Value",
    barGroups,
    stackedBarGroups,
    heatmapFields,
    heatmapXDomain,
    heatmapYDomain,
    heatmapCells,
    table,
    formatValue: formatGraphValue,
    getSeriesColor,
    yScale,
    categoricalXScale,
    continuousXScale,
    xPositionForTick,
    xPositionForPoint,
    bubbleRadiusForPoint,
    heatmapColorForValue,
  };
}

export { GRAPH_SVG_HEIGHT, GRAPH_SVG_WIDTH };