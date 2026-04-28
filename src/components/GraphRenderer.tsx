"use client";

import React, { useRef, useState } from "react";
import { PanZoomViewport } from "./PanZoomViewport";
import { ToolCard } from "./ToolCard";
import { downloadBlob } from "../lib/download-browser";
import type { GraphAxisType, GraphRow, GraphSpec, GraphValue } from "@/core/entities/rich-content";

const GRAPH_COLORS = ["#0f766e", "#1d4ed8", "#b45309", "#be123c", "#7c3aed", "#0f766e"];

type SeriesPoint = {
  xValue: GraphValue;
  yValue: number;
  seriesKey: string;
};

function isSeriesPoint(
  point: SeriesPoint | null,
): point is SeriesPoint {
  return point !== null;
}

function toFileStem(value: string | undefined | null): string {
  if (!value) return "graph";
  return (
    value
      .trim()
      .replace(/\.[a-z0-9]+$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "graph"
  );
}

function inferGraphLabel(kind: GraphSpec["kind"]): string {
  switch (kind) {
    case "line":
      return "Line Graph";
    case "area":
      return "Area Graph";
    case "bar":
      return "Bar Graph";
    case "grouped-bar":
      return "Grouped Bar Graph";
    case "stacked-bar":
      return "Stacked Bar Graph";
    case "scatter":
      return "Scatter Plot";
    case "bubble":
      return "Bubble Plot";
    case "histogram":
      return "Histogram";
    case "heatmap":
      return "Heatmap";
    case "table":
      return "Data Table";
  }
}

function formatValue(value: GraphValue, type?: GraphAxisType): string {
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

function getSeriesKeys(graph: GraphSpec): string[] {
  if (!graph.series) return ["Series 1"];
  const seriesField = graph.series.field;
  const keys = Array.from(
    new Set(
      graph.data
        .map((row) => row[seriesField])
        .filter((value): value is GraphValue => value !== undefined)
        .map((value) => String(value ?? "Unspecified")),
    ),
  );
  return keys.length > 0 ? keys : ["Series 1"];
}

function getSeriesColor(seriesKeys: string[], key: string): string {
  const index = Math.max(seriesKeys.indexOf(key), 0);
  return GRAPH_COLORS[index % GRAPH_COLORS.length];
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

function buildYTicks(min: number, max: number, count = 4): number[] {
  if (count <= 1) return [min, max];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, index) => min + step * index);
}

function buildCsv(columns: string[], rows: GraphRow[]): string {
  const escapeCell = (value: GraphValue) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const header = columns.map((column) => escapeCell(column)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCell(row[column] ?? null)).join(",")).join("\n");
  return `${header}\n${body}`;
}

function buildGraphJson(payload: {
  graph: GraphSpec;
  title?: string;
  caption?: string;
  summary?: string;
  downloadFileName?: string;
  dataPreview?: GraphRow[];
}): string {
  return JSON.stringify(payload, null, 2);
}

function getGraphValidationIssue(graph: GraphSpec): string | undefined {
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
        : `${inferGraphLabel(graph.kind)} requires both x and y encodings before it can render.`;
  }
}

function buildSeriesPoints(graph: GraphSpec): SeriesPoint[] {
  if (!graph.x || !graph.y) return [];
  const xField = graph.x.field;
  const yField = graph.y.field;

  return graph.data
    .map<SeriesPoint | null>((row) => {
      const xValue = row[xField];
      const yValue = row[yField];
      const numericY = typeof yValue === "number" && Number.isFinite(yValue) ? yValue : undefined;
      if (xValue === undefined || xValue === null || numericY === undefined) return null;
      return {
        xValue,
        yValue: numericY,
        seriesKey: graph.series ? String(row[graph.series.field] ?? "Unspecified") : "Series 1",
      };
    })
    .filter(isSeriesPoint);
}

export function GraphRenderer({
  graph,
  title,
  caption,
  summary,
  downloadFileName,
  dataPreview,
}: {
  graph: GraphSpec;
  title?: string;
  caption?: string;
  summary?: string;
  downloadFileName?: string;
  dataPreview?: GraphRow[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const inferredKind = inferGraphLabel(graph.kind);
  const headerTitle = title?.trim() || caption?.trim() || inferredKind;
  const headerSubtitle = title?.trim() && caption?.trim() ? caption.trim() : `${inferredKind} · Studio graph`;
  const exportStem = toFileStem(downloadFileName || title || caption || inferredKind);
  const columns = getColumns(graph);
  const hasRows = graph.data.length > 0;
  const validationIssue = getGraphValidationIssue(graph);
  const seriesKeys = getSeriesKeys(graph);
  const previewRows = dataPreview && dataPreview.length > 0 ? dataPreview : graph.data.slice(0, 5);
  const previewColumns = previewRows.length > 0
    ? Array.from(new Set(previewRows.flatMap((row) => Object.keys(row))))
    : columns;
  const sourceLabel = graph.source?.label;

  const handleExportJson = () => {
    const json = buildGraphJson({
      graph,
      title,
      caption,
      summary,
      downloadFileName,
      dataPreview: previewRows,
    });
    // eslint-disable-next-line react-hooks/purity -- event handler, not render-time
    downloadBlob(new Blob([json], { type: "application/json;charset=utf-8" }), `${exportStem}_${Date.now()}.json`);
  };

  const headerActions = (
    <>
      <button
        type="button"
        onClick={handleExportJson}
        title="Export graph JSON"
        className="focus-ring flex h-9 min-w-9 items-center justify-center rounded-md text-foreground opacity-50 transition-all hover:opacity-100 hover-surface active:scale-90 sm:h-8 sm:min-w-8"
        aria-label="Export graph JSON"
        data-testid="graph-export-json"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 6h8" />
          <path d="M8 12h8" />
          <path d="M8 18h5" />
          <path d="M4 4h16v16H4z" />
        </svg>
      </button>
      {previewRows.length > 0 ? (
        <button
          type="button"
          onClick={() => setIsPreviewVisible((current) => !current)}
          title={isPreviewVisible ? "Hide data preview" : "Show data preview"}
          className="focus-ring flex h-9 min-w-9 items-center justify-center rounded-md text-foreground opacity-50 transition-all hover:opacity-100 hover-surface active:scale-90 sm:h-8 sm:min-w-8"
          aria-label={isPreviewVisible ? "Hide data preview" : "Show data preview"}
          data-testid="graph-preview-toggle"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      ) : null}
    </>
  );

  const handleDownload = () => {
    if (graph.kind === "table") {
      const csv = buildCsv(columns, graph.data);
      // eslint-disable-next-line react-hooks/purity -- event handler, not render-time
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${exportStem}_${Date.now()}.csv`);
      return;
    }

    if (!svgRef.current) return;
    const serialized = new XMLSerializer().serializeToString(svgRef.current);
    // eslint-disable-next-line react-hooks/purity -- event handler, not render-time
    downloadBlob(new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }), `${exportStem}_${Date.now()}.svg`);
  };

  if (graph.kind === "table") {
    return (
      <ToolCard
        title={headerTitle}
        subtitle={headerSubtitle}
        status={hasRows ? "success" : "idle"}
        actions={headerActions}
        onDownload={columns.length > 0 ? handleDownload : undefined}
        downloadTooltip="Download as CSV"
        icon={<span aria-hidden="true">#</span>}
      >
        <div className="w-full overflow-x-auto p-(--space-3)">
          {sourceLabel ? (
            <p className="px-(--space-1) pb-(--space-2) text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/52" data-testid="graph-source">
              Source: {sourceLabel}
            </p>
          ) : null}
          {hasRows ? (
            <table className="w-full text-sm border-collapse" data-testid="graph-table">
              <thead>
                <tr className="accent-fill">
                  {columns.map((column) => (
                    <th key={column} className="px-(--space-inset-default) py-(--space-inset-compact) text-left text-xs font-bold uppercase tracking-wider">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {graph.data.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`} className={rowIndex % 2 === 0 ? "bg-surface" : "bg-surface-muted"}>
                    {columns.map((column) => (
                      <td key={`${rowIndex}-${column}`} className="border-b border-border px-(--space-inset-default) py-(--space-inset-compact) align-top">
                        {formatValue(row[column] ?? null)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex min-h-28 items-center justify-center text-xs opacity-60" data-testid="graph-empty-state">No data available yet.</div>
          )}
        </div>
      </ToolCard>
    );
  }

  const width = 760;
  const height = 420;
  const margin = { top: 24, right: 24, bottom: 72, left: 64 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const points = buildSeriesPoints(graph);
  const isBarLike = graph.kind === "bar" || graph.kind === "grouped-bar" || graph.kind === "stacked-bar" || graph.kind === "histogram";
  const isXYPlot = graph.kind === "line" || graph.kind === "area" || graph.kind === "scatter" || graph.kind === "bubble";
  const yValues = points.map((point) => point.yValue);
  const [yMinBase, yMaxBase] = getContinuousDomain(yValues);
  const yMin = isBarLike ? Math.min(0, yMinBase) : yMinBase;
  const yMax = isBarLike ? Math.max(0, yMaxBase) : yMaxBase;
  const yTicks = buildYTicks(yMin, yMax, 4);

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

  const xAxisLabel = graph.x?.label ?? graph.x?.field ?? "X";
  const yAxisLabel = graph.y?.label ?? graph.y?.field ?? "Value";
  const groupedPoints = seriesKeys.map((seriesKey) => ({
    key: seriesKey,
    points: points.filter((point) => point.seriesKey === seriesKey),
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
  const bubbleRadius = (value: GraphValue) => {
    const numeric = toNumber(value, graph.size?.type) ?? sizeMin;
    const normalized = (numeric - sizeMin) / (sizeMax - sizeMin || 1);
    return 5 + normalized * 11;
  };

  const barGroups = (graph.kind === "bar" || graph.kind === "grouped-bar")
    ? categoricalDomain.map((domainValue) => {
        return seriesKeys.map((seriesKey) => ({
          domainValue,
          seriesKey,
          total: points
            .filter((point) => point.xValue === domainValue && point.seriesKey === seriesKey)
            .reduce((sum, point) => sum + point.yValue, 0),
        }));
      })
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
  const heatmapColor = (value: number) => {
    const normalized = (value - heatmapMin) / (heatmapMax - heatmapMin || 1);
    return `rgba(15, 118, 110, ${0.18 + normalized * 0.72})`;
  };
  const hasRenderableGraph = graph.kind === "heatmap"
    ? heatmapXDomain.length > 0 && heatmapYDomain.length > 0
    : points.length > 0;
  const xTickValues = categoricalX
    ? categoricalDomain.filter((_, index, list) => list.length <= 6 || index % Math.ceil(list.length / 6) === 0)
    : buildYTicks(xMin, xMax, 4);

  return (
    <ToolCard
      title={headerTitle}
      subtitle={headerSubtitle}
      status={validationIssue ? "error" : hasRows ? "success" : "idle"}
      actions={headerActions}
      expandable={hasRows}
      onDownload={hasRows ? handleDownload : undefined}
      downloadTooltip="Download as SVG"
      icon={<span aria-hidden="true">/</span>}
    >
      <div className="w-full p-(--space-3)">
        {validationIssue ? (
          <div
            className="flex min-h-32 items-center justify-center rounded-theme border-theme bg-surface-muted/40 px-(--space-inset-default) text-center text-sm text-foreground/74"
            data-testid="graph-invalid-state"
          >
            {validationIssue}
          </div>
        ) : hasRows && hasRenderableGraph ? (
          <div className="space-y-(--space-stack-default)">
            {sourceLabel ? (
              <p className="px-(--space-2) text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/52" data-testid="graph-source">
                Source: {sourceLabel}
              </p>
            ) : null}
            {graph.series ? (
              <div className="flex flex-wrap gap-(--space-3) px-(--space-2) text-[11px] uppercase tracking-wider text-foreground/65" data-testid="graph-legend">
                {seriesKeys.map((seriesKey) => (
                  <span key={seriesKey} className="inline-flex items-center gap-(--space-2)">
                    <span className="h-(--space-2) w-(--space-2) rounded-full" style={{ backgroundColor: getSeriesColor(seriesKeys, seriesKey) }} />
                    {seriesKey}
                  </span>
                ))}
              </div>
            ) : null}
            {summary ? (
              <p className="px-(--space-2) text-sm leading-6 text-foreground/78" data-testid="graph-summary">
                {summary}
              </p>
            ) : null}
            <PanZoomViewport
              ariaLabel={`${headerTitle} graph`}
              contentWidth={width}
              contentHeight={height}
              testId="graph-viewport"
            >
              <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="h-full w-full overflow-visible" data-testid="graph-svg" data-graph-kind={graph.kind}>
                <rect x="0" y="0" width={width} height={height} fill="transparent" />
                {yTicks.map((tick) => (
                  <g key={`y-${tick}`}>
                    <line x1={margin.left} x2={width - margin.right} y1={yScale(tick)} y2={yScale(tick)} stroke="currentColor" strokeOpacity="0.12" />
                    <text x={margin.left - 10} y={yScale(tick) + 4} fontSize="11" textAnchor="end" fill="currentColor" opacity="0.65">
                      {formatValue(tick)}
                    </text>
                  </g>
                ))}
                <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + innerHeight} stroke="currentColor" strokeOpacity="0.4" />
                <line x1={margin.left} x2={width - margin.right} y1={margin.top + innerHeight} y2={margin.top + innerHeight} stroke="currentColor" strokeOpacity="0.4" />
                <text x={margin.left + innerWidth / 2} y={height - 18} textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.72">
                  {xAxisLabel}
                </text>
                <text x={18} y={margin.top + innerHeight / 2} textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.72" transform={`rotate(-90 18 ${margin.top + innerHeight / 2})`}>
                  {yAxisLabel}
                </text>

                {categoricalX
                  ? (xTickValues as GraphValue[]).map((tick) => {
                      const x = isBarLike
                        ? categoricalXScale(tick) + innerWidth / Math.max(categoricalDomain.length, 1) / 2
                        : categoricalXScale(tick);
                      return (
                        <g key={`x-${String(tick)}`}>
                          <line x1={x} x2={x} y1={margin.top + innerHeight} y2={margin.top + innerHeight + 6} stroke="currentColor" strokeOpacity="0.4" />
                          <text x={x} y={height - 42} fontSize="11" textAnchor="middle" fill="currentColor" opacity="0.7">
                            {formatValue(tick, graph.x?.type)}
                          </text>
                        </g>
                      );
                    })
                  : (xTickValues as number[]).map((tick) => (
                      <g key={`x-${tick}`}>
                        <line x1={continuousXScale(tick)} x2={continuousXScale(tick)} y1={margin.top + innerHeight} y2={margin.top + innerHeight + 6} stroke="currentColor" strokeOpacity="0.4" />
                        <text x={continuousXScale(tick)} y={height - 42} fontSize="11" textAnchor="middle" fill="currentColor" opacity="0.7">
                          {formatValue(tick, graph.x?.type)}
                        </text>
                      </g>
                    ))}

                {graph.kind === "line" || graph.kind === "area"
                  ? groupedPoints.map((group) => {
                      const orderedPoints = group.points.slice().sort((left, right) => {
                        if (useContinuousX) {
                          const leftValue = toNumber(left.xValue, graph.x?.type) ?? 0;
                          const rightValue = toNumber(right.xValue, graph.x?.type) ?? 0;
                          return leftValue - rightValue;
                        }
                        const leftIndex = categoricalDomain.findIndex((entry) => entry === left.xValue);
                        const rightIndex = categoricalDomain.findIndex((entry) => entry === right.xValue);
                        return leftIndex - rightIndex;
                      });
                      const path = orderedPoints
                        .map((point, index) => {
                          const x = useContinuousX
                            ? continuousXScale(toNumber(point.xValue, graph.x?.type) ?? 0)
                            : categoricalXScale(point.xValue);
                          const y = yScale(point.yValue);
                          return `${index === 0 ? "M" : "L"} ${x} ${y}`;
                        })
                        .join(" ");
                      return (
                        <g key={group.key}>
                          {graph.kind === "area" ? (
                            <path
                              d={`${path} L ${useContinuousX
                                ? continuousXScale(toNumber(orderedPoints[orderedPoints.length - 1]?.xValue ?? 0, graph.x?.type) ?? 0)
                                : categoricalXScale(orderedPoints[orderedPoints.length - 1]?.xValue ?? null)} ${yScale(0)} L ${useContinuousX
                                ? continuousXScale(toNumber(orderedPoints[0]?.xValue ?? 0, graph.x?.type) ?? 0)
                                : categoricalXScale(orderedPoints[0]?.xValue ?? null)} ${yScale(0)} Z`}
                              fill={getSeriesColor(seriesKeys, group.key)}
                              fillOpacity="0.18"
                            />
                          ) : null}
                          <path d={path} fill="none" stroke={getSeriesColor(seriesKeys, group.key)} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" data-series-path={group.key} />
                          {orderedPoints.map((point, index) => (
                            <circle
                              key={`${group.key}-${index}`}
                              cx={useContinuousX
                                ? continuousXScale(toNumber(point.xValue, graph.x?.type) ?? 0)
                                : categoricalXScale(point.xValue)}
                              cy={yScale(point.yValue)}
                              r="4"
                              fill={getSeriesColor(seriesKeys, group.key)}
                              data-point={group.key}
                            />
                          ))}
                        </g>
                      );
                    })
                  : null}

                {graph.kind === "bar" || graph.kind === "grouped-bar" || graph.kind === "histogram"
                  ? barGroups.map((group, groupIndex) => {
                      const band = innerWidth / Math.max(categoricalDomain.length, 1);
                      const groupPadding = band * 0.16;
                      const availableWidth = Math.max(band - groupPadding * 2, 16);
                      const barWidth = availableWidth / Math.max(seriesKeys.length, 1);
                      return group.map((entry, seriesIndex) => {
                        const x = margin.left + groupIndex * band + groupPadding + seriesIndex * barWidth;
                        const baseline = yScale(0);
                        const top = yScale(entry.total);
                        return (
                          <rect
                            key={`${entry.seriesKey}-${String(entry.domainValue)}`}
                            x={x}
                            y={Math.min(top, baseline)}
                            width={Math.max(barWidth - 4, 2)}
                            height={Math.abs(baseline - top)}
                            fill={getSeriesColor(seriesKeys, entry.seriesKey)}
                            rx="3"
                            data-bar={entry.seriesKey}
                          />
                        );
                      });
                    })
                  : null}

                {graph.kind === "stacked-bar"
                  ? stackedBarGroups.map((group, groupIndex) => {
                      const band = innerWidth / Math.max(categoricalDomain.length, 1);
                      const groupPadding = band * 0.18;
                      const width = Math.max(band - groupPadding * 2 - 4, 8);
                      let runningTotal = 0;
                      return group.series.map((entry) => {
                        const x = margin.left + groupIndex * band + groupPadding;
                        const start = runningTotal;
                        const end = runningTotal + entry.total;
                        runningTotal = end;
                        const baseline = yScale(start);
                        const top = yScale(end);
                        return (
                          <rect
                            key={`${entry.seriesKey}-${String(group.domainValue)}`}
                            x={x}
                            y={Math.min(top, baseline)}
                            width={width}
                            height={Math.abs(baseline - top)}
                            fill={getSeriesColor(seriesKeys, entry.seriesKey)}
                            rx="3"
                            data-bar={entry.seriesKey}
                          />
                        );
                      });
                    })
                  : null}

                {graph.kind === "scatter" || graph.kind === "bubble"
                  ? groupedPoints.map((group) => (
                      <g key={group.key}>
                        {group.points.map((point, index) => {
                          const numericX = toNumber(point.xValue, graph.x?.type);
                          const x = numericX !== undefined && !categoricalX ? continuousXScale(numericX) : categoricalXScale(point.xValue);
                          const radius = graph.kind === "bubble" && sizeField
                            ? bubbleRadius(graph.data.find((row) => {
                                const xValue = row[graph.x?.field ?? ""];
                                const yValue = row[graph.y?.field ?? ""];
                                const seriesValue = graph.series ? String(row[graph.series.field] ?? "Unspecified") : "Series 1";
                                return xValue === point.xValue && yValue === point.yValue && seriesValue === group.key;
                              })?.[sizeField] ?? null)
                            : 5;
                          return (
                            <circle
                              key={`${group.key}-${index}`}
                              cx={x}
                              cy={yScale(point.yValue)}
                              r={radius}
                              fill={getSeriesColor(seriesKeys, group.key)}
                              fillOpacity={graph.kind === "bubble" ? "0.55" : "0.88"}
                              data-point={group.key}
                            />
                          );
                        })}
                      </g>
                    ))
                  : null}

                {graph.kind === "heatmap" && heatmapFields
                  ? graph.data.map((row, index) => {
                      const xIndex = heatmapXDomain.findIndex((entry) => entry === row[heatmapFields.xField]);
                      const yIndex = heatmapYDomain.findIndex((entry) => entry === row[heatmapFields.yField]);
                      const cellWidth = innerWidth / Math.max(heatmapXDomain.length, 1);
                      const cellHeight = innerHeight / Math.max(heatmapYDomain.length, 1);
                      const x = margin.left + xIndex * cellWidth;
                      const y = margin.top + yIndex * cellHeight;
                      const value = Number(row[heatmapFields.colorField] ?? 0);
                      return (
                        <rect
                          key={`heat-${index}`}
                          x={x}
                          y={y}
                          width={Math.max(cellWidth - 2, 2)}
                          height={Math.max(cellHeight - 2, 2)}
                          fill={heatmapColor(value)}
                          rx="3"
                          data-heat-cell="true"
                        />
                      );
                    })
                  : null}
              </svg>
            </PanZoomViewport>
            {previewRows.length > 0 && isPreviewVisible ? (
              <div className="overflow-x-auto rounded-theme border-theme bg-surface-muted/45 p-(--space-2)" data-testid="graph-data-preview">
                <p className="px-(--space-2) pb-(--space-2) text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/52">
                  Data preview
                </p>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="text-foreground/58">
                      {previewColumns.map((column) => (
                        <th key={column} className="px-(--space-3) py-(--space-2) text-left font-semibold uppercase tracking-wider">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, rowIndex) => (
                      <tr key={`preview-${rowIndex}`} className={rowIndex % 2 === 0 ? "bg-surface/70" : "bg-transparent"}>
                        {previewColumns.map((column) => (
                          <td key={`${rowIndex}-${column}`} className="border-t border-border/60 px-(--space-3) py-(--space-2) align-top text-foreground/78">
                            {formatValue(row[column] ?? null, column === graph.x?.field ? graph.x?.type : column === graph.y?.field ? graph.y?.type : undefined)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-32 items-center justify-center text-xs opacity-60" data-testid="graph-empty-state">No data available yet.</div>
        )}
      </div>
    </ToolCard>
  );
}