import React, { forwardRef, useMemo } from "react";

import type { GraphSpec } from "@/core/entities/rich-content";

import { computeGraphGeometry, GRAPH_SVG_HEIGHT, GRAPH_SVG_WIDTH } from "./graph-geometry";
import { getGraphValidationIssue } from "./graph-validation";

const AXIS_COLOR = "#111827";

function renderTableGraph(graph: GraphSpec, width: number, height: number) {
  const geometry = computeGraphGeometry(graph, width, height);
  const table = geometry.table;

  if (!table) {
    return null;
  }

  return (
    <>
      <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
      <rect x={table.margin} y={table.margin} width={table.tableWidth} height={table.headerHeight} fill="#e5e7eb" rx="8" />
      {table.columns.map((column, columnIndex) => {
        const x = table.margin + columnIndex * table.columnWidth;
        return (
          <g key={column}>
            <text x={x + 10} y={table.margin + 22} fontSize="12" fontWeight="700" fill={AXIS_COLOR}>
              {column}
            </text>
            {columnIndex > 0 ? (
              <line
                x1={x}
                x2={x}
                y1={table.margin}
                y2={table.margin + table.headerHeight + table.rowHeight * table.rows.length}
                stroke="#d1d5db"
              />
            ) : null}
          </g>
        );
      })}
      {table.rows.map((row, rowIndex) => {
        const y = table.margin + table.headerHeight + rowIndex * table.rowHeight;
        return (
          <g key={`row-${rowIndex}`}>
            <rect
              x={table.margin}
              y={y}
              width={table.tableWidth}
              height={table.rowHeight}
              fill={rowIndex % 2 === 0 ? "#ffffff" : "#f9fafb"}
            />
            <line
              x1={table.margin}
              x2={table.margin + table.tableWidth}
              y1={y + table.rowHeight}
              y2={y + table.rowHeight}
              stroke="#d1d5db"
            />
            {table.columns.map((column, columnIndex) => {
              const x = table.margin + columnIndex * table.columnWidth;
              return (
                <text
                  key={`${rowIndex}-${column}`}
                  x={x + 10}
                  y={y + 22}
                  fontSize="12"
                  fill="#374151"
                >
                  {geometry.formatValue(row[column] ?? null)}
                </text>
              );
            })}
          </g>
        );
      })}
    </>
  );
}

export interface GraphSvgProps {
  graph: GraphSpec;
  width?: number;
  height?: number;
  testId?: string;
}

export const GraphSvg = forwardRef<SVGSVGElement, GraphSvgProps>(function GraphSvg(
  { graph, width = GRAPH_SVG_WIDTH, height = GRAPH_SVG_HEIGHT, testId = "graph-svg" },
  ref,
) {
  const validationIssue = getGraphValidationIssue(graph);
  if (validationIssue) {
    throw new Error(validationIssue);
  }

  const geometry = useMemo(() => computeGraphGeometry(graph, width, height), [graph, width, height]);

  if (graph.kind === "table") {
    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        xmlns="http://www.w3.org/2000/svg"
        data-testid={testId}
        data-graph-kind={graph.kind}
      >
        {renderTableGraph(graph, width, height)}
      </svg>
    );
  }

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      data-testid={testId}
      data-graph-kind={graph.kind}
    >
      <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
      {geometry.yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line
            x1={geometry.margin.left}
            x2={width - geometry.margin.right}
            y1={geometry.yScale(tick)}
            y2={geometry.yScale(tick)}
            stroke={AXIS_COLOR}
            strokeOpacity="0.12"
          />
          <text
            x={geometry.margin.left - 10}
            y={geometry.yScale(tick) + 4}
            fontSize="11"
            textAnchor="end"
            fill={AXIS_COLOR}
            fillOpacity="0.65"
          >
            {geometry.formatValue(tick)}
          </text>
        </g>
      ))}
      <line
        x1={geometry.margin.left}
        x2={geometry.margin.left}
        y1={geometry.margin.top}
        y2={geometry.margin.top + geometry.innerHeight}
        stroke={AXIS_COLOR}
        strokeOpacity="0.4"
      />
      <line
        x1={geometry.margin.left}
        x2={width - geometry.margin.right}
        y1={geometry.margin.top + geometry.innerHeight}
        y2={geometry.margin.top + geometry.innerHeight}
        stroke={AXIS_COLOR}
        strokeOpacity="0.4"
      />
      <text x={geometry.margin.left + geometry.innerWidth / 2} y={height - 18} textAnchor="middle" fontSize="12" fill={AXIS_COLOR} fillOpacity="0.72">
        {geometry.xAxisLabel}
      </text>
      <text
        x={18}
        y={geometry.margin.top + geometry.innerHeight / 2}
        textAnchor="middle"
        fontSize="12"
        fill={AXIS_COLOR}
        fillOpacity="0.72"
        transform={`rotate(-90 18 ${geometry.margin.top + geometry.innerHeight / 2})`}
      >
        {geometry.yAxisLabel}
      </text>

      {geometry.categoricalX
        ? geometry.xTicks.map((tick) => {
            const x = geometry.xPositionForTick(tick);
            return (
              <g key={`x-${String(tick)}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={geometry.margin.top + geometry.innerHeight}
                  y2={geometry.margin.top + geometry.innerHeight + 6}
                  stroke={AXIS_COLOR}
                  strokeOpacity="0.4"
                />
                <text x={x} y={height - 42} fontSize="11" textAnchor="middle" fill={AXIS_COLOR} fillOpacity="0.7">
                  {geometry.formatValue(tick, graph.x?.type)}
                </text>
              </g>
            );
          })
        : geometry.xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={geometry.xPositionForTick(tick)}
                x2={geometry.xPositionForTick(tick)}
                y1={geometry.margin.top + geometry.innerHeight}
                y2={geometry.margin.top + geometry.innerHeight + 6}
                stroke={AXIS_COLOR}
                strokeOpacity="0.4"
              />
              <text x={geometry.xPositionForTick(tick)} y={height - 42} fontSize="11" textAnchor="middle" fill={AXIS_COLOR} fillOpacity="0.7">
                {geometry.formatValue(tick, graph.x?.type)}
              </text>
            </g>
          ))}

      {graph.kind === "line" || graph.kind === "area"
        ? geometry.orderedGroupedPoints.map((group) => {
            const orderedPoints = group.points;
            const path = orderedPoints
              .map((point, index) => {
                const x = geometry.xPositionForPoint(point);
                const y = geometry.yScale(point.yValue);
                return `${index === 0 ? "M" : "L"} ${x} ${y}`;
              })
              .join(" ");

            return (
              <g key={group.key}>
                {graph.kind === "area" ? (
                  <path
                    d={`${path} L ${geometry.xPositionForPoint(orderedPoints[orderedPoints.length - 1] ?? { xValue: null, yValue: 0, seriesKey: group.key })} ${geometry.yScale(0)} L ${geometry.xPositionForPoint(orderedPoints[0] ?? { xValue: null, yValue: 0, seriesKey: group.key })} ${geometry.yScale(0)} Z`}
                    fill={geometry.getSeriesColor(group.key)}
                    fillOpacity="0.18"
                  />
                ) : null}
                <path d={path} fill="none" stroke={geometry.getSeriesColor(group.key)} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                {orderedPoints.map((point, index) => (
                  <circle
                    key={`${group.key}-${index}`}
                    cx={geometry.xPositionForPoint(point)}
                    cy={geometry.yScale(point.yValue)}
                    r="4"
                    fill={geometry.getSeriesColor(group.key)}
                  />
                ))}
              </g>
            );
          })
        : null}

      {graph.kind === "bar" || graph.kind === "grouped-bar" || graph.kind === "histogram"
        ? geometry.barGroups.map((group, groupIndex) => {
            const band = geometry.innerWidth / Math.max(geometry.categoricalDomain.length, 1);
            const groupPadding = band * 0.16;
            const availableWidth = Math.max(band - groupPadding * 2, 16);
            const barWidth = availableWidth / Math.max(geometry.seriesKeys.length, 1);
            return group.map((entry, seriesIndex) => {
              const x = geometry.margin.left + groupIndex * band + groupPadding + seriesIndex * barWidth;
              const baseline = geometry.yScale(0);
              const top = geometry.yScale(entry.total);
              return (
                <rect
                  key={`${entry.seriesKey}-${String(entry.domainValue)}`}
                  x={x}
                  y={Math.min(top, baseline)}
                  width={Math.max(barWidth - 4, 2)}
                  height={Math.abs(baseline - top)}
                  fill={geometry.getSeriesColor(entry.seriesKey)}
                  rx="3"
                />
              );
            });
          })
        : null}

      {graph.kind === "stacked-bar"
        ? geometry.stackedBarGroups.map((group, groupIndex) => {
            const band = geometry.innerWidth / Math.max(geometry.categoricalDomain.length, 1);
            const groupPadding = band * 0.18;
            const stackedWidth = Math.max(band - groupPadding * 2 - 4, 8);
            let runningTotal = 0;
            return group.series.map((entry) => {
              const x = geometry.margin.left + groupIndex * band + groupPadding;
              const start = runningTotal;
              const end = runningTotal + entry.total;
              runningTotal = end;
              const baseline = geometry.yScale(start);
              const top = geometry.yScale(end);
              return (
                <rect
                  key={`${entry.seriesKey}-${String(group.domainValue)}`}
                  x={x}
                  y={Math.min(top, baseline)}
                  width={stackedWidth}
                  height={Math.abs(baseline - top)}
                  fill={geometry.getSeriesColor(entry.seriesKey)}
                  rx="3"
                />
              );
            });
          })
        : null}

      {graph.kind === "scatter" || graph.kind === "bubble"
        ? geometry.groupedPoints.map((group) => (
            <g key={group.key}>
              {group.points.map((point, index) => {
                return (
                  <circle
                    key={`${group.key}-${index}`}
                    cx={geometry.xPositionForPoint(point)}
                    cy={geometry.yScale(point.yValue)}
                    r={graph.kind === "bubble" ? geometry.bubbleRadiusForPoint(point) : 5}
                    fill={geometry.getSeriesColor(group.key)}
                    fillOpacity={graph.kind === "bubble" ? "0.55" : "0.88"}
                  />
                );
              })}
            </g>
          ))
        : null}

      {graph.kind === "heatmap" && geometry.heatmapFields
        ? geometry.heatmapCells.map((cell) => {
            return (
              <rect
                key={`heat-${cell.index}`}
                x={cell.x}
                y={cell.y}
                width={cell.width}
                height={cell.height}
                fill={geometry.heatmapColorForValue(cell.value)}
                rx="3"
              />
            );
          })
        : null}
    </svg>
  );
});

export { GRAPH_SVG_WIDTH, GRAPH_SVG_HEIGHT };