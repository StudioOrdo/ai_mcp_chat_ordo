import type {
  GraphAxisType,
  GraphEncoding,
  GraphKind,
  GraphRow,
  GraphSourceMeta,
  GraphSpec,
  GraphValue,
} from "@/core/entities/rich-content";
import type { GraphDataSourceInput, ResolvedGraphDataSource } from "@/lib/graphs/graph-data-sources";

type AggregateOp = "sum" | "avg" | "count" | "min" | "max" | "median";

type GraphFieldEncodingInput = {
  field?: string;
  type?: GraphAxisType;
  label?: string;
  title?: string;
  aggregate?: AggregateOp;
};

type GraphTransformInput =
  | {
      type: "filter";
      field?: string;
      operator?: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in";
      value?: unknown;
    }
  | {
      type: "aggregate";
      groupBy?: string[];
      measures?: Array<{ field?: string; op?: AggregateOp; as?: string }>;
    }
  | {
      type: "sort";
      field?: string;
      direction?: "asc" | "desc";
    }
  | {
      type: "limit";
      value?: number;
    }
  | {
      type: "bin";
      field?: string;
      as?: string;
      maxBins?: number;
    }
  | {
      type: "fold";
      fields?: string[];
      as?: [string, string];
    }
  | {
      type: "calculate";
      as?: string;
      expression?: string;
    };

type TopLevelGraphDataInput = {
  rows?: GraphRow[];
  source?: GraphDataSourceInput;
};

type StudioGraphSpecInput = {
  graphType?: GraphKind;
  data?: {
    values?: GraphRow[];
  };
  columns?: string[];
  x?: GraphFieldEncodingInput;
  y?: GraphFieldEncodingInput;
  color?: GraphFieldEncodingInput;
  size?: GraphFieldEncodingInput;
  tooltip?: Array<string | GraphFieldEncodingInput>;
  transforms?: GraphTransformInput[];
  xField?: string;
  yField?: string;
  seriesField?: string;
  xType?: GraphAxisType;
  yType?: GraphAxisType;
  seriesType?: GraphAxisType;
  xLabel?: string;
  yLabel?: string;
  seriesLabel?: string;
};

type VegaLiteGraphSpecInput = {
  mark?: "line" | "area" | "bar" | "point" | "circle" | "rect" | "table";
  data?: {
    values?: GraphRow[];
  };
  encoding?: {
    x?: GraphFieldEncodingInput;
    y?: GraphFieldEncodingInput;
    color?: GraphFieldEncodingInput;
    size?: GraphFieldEncodingInput;
    tooltip?: Array<string | GraphFieldEncodingInput>;
  };
  transform?: GraphTransformInput[];
  columns?: string[];
};

export type GenerateGraphInput = {
  title?: string;
  caption?: string;
  summary?: string;
  downloadFileName?: string;
  data?: TopLevelGraphDataInput;
  spec?: StudioGraphSpecInput | VegaLiteGraphSpecInput;
  vegaLite?: VegaLiteGraphSpecInput;
};

export type ResolvedGraphPayload = {
  graph: GraphSpec;
  title?: string;
  caption?: string;
  summary?: string;
  downloadFileName?: string;
  dataPreview?: GraphRow[];
  source?: GraphSourceMeta;
};

type ResolveGenerateGraphPayloadOptions = {
  sourceData?: ResolvedGraphDataSource;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function isGraphValue(value: unknown): value is GraphValue {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function normalizeRow(row: Record<string, unknown>): GraphRow {
  const normalized: GraphRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (isGraphValue(value)) normalized[key] = value;
  }
  return normalized;
}

function asRowArray(value: unknown): GraphRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject).map(normalizeRow);
}

function asRowsContainer(value: unknown): GraphRow[] {
  if (!isObject(value)) return [];
  return asRowArray(value.values);
}

function buildPreview(rows: GraphRow[]): GraphRow[] | undefined {
  return rows.length > 0 ? rows.slice(0, 5) : undefined;
}

function deriveColumns(rows: GraphRow[], requestedColumns?: string[]): string[] {
  if (requestedColumns && requestedColumns.length > 0) return requestedColumns;

  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }

  return columns;
}

function inferAxisType(rows: GraphRow[], field: string, fallback: GraphAxisType): GraphAxisType {
  for (const row of rows) {
    const value = row[field];
    if (value === null || value === undefined) continue;
    if (typeof value === "number") return "quantitative";
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed) && /[-/:T]/.test(value)) return "temporal";
      return fallback;
    }
    return fallback;
  }
  return fallback;
}

function normalizeEncoding(
  input: GraphFieldEncodingInput | undefined,
  fallbackField: string | undefined,
  fallbackType: GraphAxisType | undefined,
  fallbackLabel: string | undefined,
  rows: GraphRow[],
  inferredFallback: GraphAxisType,
): GraphEncoding | undefined {
  const field = asString(input?.field) ?? fallbackField;
  if (!field) return undefined;
  return {
    field,
    label: asString(input?.label) ?? asString(input?.title) ?? fallbackLabel,
    type: (asString(input?.type) as GraphAxisType | undefined) ?? fallbackType ?? inferAxisType(rows, field, inferredFallback),
    aggregate: asString(input?.aggregate) as AggregateOp | undefined,
  };
}

function normalizeTooltip(input: unknown, rows: GraphRow[]): GraphEncoding[] | undefined {
  if (!Array.isArray(input) || input.length === 0) return undefined;

  const tooltip = input.flatMap((entry) => {
    if (typeof entry === "string") {
      return [{ field: entry, type: inferAxisType(rows, entry, "nominal") }];
    }
    if (!isObject(entry)) return [];
    const field = asString(entry.field);
    if (!field) return [];
    return [{
      field,
      label: asString(entry.label) ?? asString(entry.title),
      type: (asString(entry.type) as GraphAxisType | undefined) ?? inferAxisType(rows, field, "nominal"),
      aggregate: asString(entry.aggregate) as AggregateOp | undefined,
    }];
  });

  return tooltip.length > 0 ? tooltip : undefined;
}

function toComparable(value: GraphValue): number | string {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "string") {
    const asDate = Date.parse(value);
    if (!Number.isNaN(asDate) && /[-/:T]/.test(value)) return asDate;
    const asNumeric = Number(value);
    if (Number.isFinite(asNumeric) && value.trim() !== "") return asNumeric;
    return value;
  }
  return "";
}

function toNumeric(value: GraphValue, field: string): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error(`Field '${field}' must contain numeric values for this graph or transform.`);
}

function ensureKnownField(field: string, knownFields: Set<string>, context: string) {
  if (knownFields.size > 0 && !knownFields.has(field)) {
    throw new Error(`${context} references unknown field '${field}'.`);
  }
}

function filterRows(rows: GraphRow[], transform: Extract<GraphTransformInput, { type: "filter" }>, knownFields: Set<string>): GraphRow[] {
  const field = asString(transform.field);
  const operator = transform.operator;
  if (!field || !operator) throw new Error("Graph filter transforms require field and operator.");
  ensureKnownField(field, knownFields, "Graph filter");

  return rows.filter((row) => {
    const left = row[field] ?? null;
    const right = transform.value as GraphValue | GraphValue[];
    switch (operator) {
      case "=":
        return left === right;
      case "!=":
        return left !== right;
      case ">":
        return toComparable(left) > toComparable(right as GraphValue);
      case ">=":
        return toComparable(left) >= toComparable(right as GraphValue);
      case "<":
        return toComparable(left) < toComparable(right as GraphValue);
      case "<=":
        return toComparable(left) <= toComparable(right as GraphValue);
      case "in":
        return Array.isArray(right) ? right.includes(left) : false;
    }
  });
}

function aggregateValues(values: number[], op: AggregateOp): number {
  if (values.length === 0) return 0;
  switch (op) {
    case "count":
      return values.length;
    case "sum":
      return values.reduce((sum, value) => sum + value, 0);
    case "avg":
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "median": {
      const sorted = [...values].sort((left, right) => left - right);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
    }
  }
}

function aggregateRows(rows: GraphRow[], transform: Extract<GraphTransformInput, { type: "aggregate" }>, knownFields: Set<string>): GraphRow[] {
  const groupBy = asStringArray(transform.groupBy);
  const measures = Array.isArray(transform.measures) ? transform.measures : [];
  if (measures.length === 0) throw new Error("Graph aggregate transforms require at least one measure.");

  for (const field of groupBy) ensureKnownField(field, knownFields, "Graph aggregate");

  const groups = new Map<string, GraphRow[]>();
  for (const row of rows) {
    const key = JSON.stringify(groupBy.map((field) => row[field] ?? null));
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([key, groupedRows]) => {
    const row: GraphRow = {};
    const groupValues = JSON.parse(key) as GraphValue[];
    groupBy.forEach((field, index) => {
      row[field] = groupValues[index] ?? null;
    });

    for (const measure of measures) {
      const op = asString(measure.op) as AggregateOp | undefined;
      const outputField = asString(measure.as);
      if (!op || !outputField) throw new Error("Graph aggregate measures require op and as.");
      if (measure.field) ensureKnownField(measure.field, knownFields, "Graph aggregate");
      const values = op === "count"
        ? groupedRows.map(() => 1)
        : groupedRows.map((entry) => toNumeric(entry[measure.field as string] ?? null, measure.field as string));
      row[outputField] = aggregateValues(values, op);
    }

    return row;
  });
}

function sortRows(rows: GraphRow[], transform: Extract<GraphTransformInput, { type: "sort" }>, knownFields: Set<string>): GraphRow[] {
  const field = asString(transform.field);
  if (!field) throw new Error("Graph sort transforms require a field.");
  ensureKnownField(field, knownFields, "Graph sort");
  const direction = transform.direction === "desc" ? -1 : 1;

  return [...rows].sort((left, right) => {
    const leftValue = toComparable(left[field] ?? null);
    const rightValue = toComparable(right[field] ?? null);
    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return 1 * direction;
    return 0;
  });
}

function limitRows(rows: GraphRow[], transform: Extract<GraphTransformInput, { type: "limit" }>): GraphRow[] {
  const limit = asNumber(transform.value);
  if (limit === undefined || limit < 0) throw new Error("Graph limit transforms require a non-negative numeric value.");
  return rows.slice(0, limit);
}

function binRows(rows: GraphRow[], transform: Extract<GraphTransformInput, { type: "bin" }>, knownFields: Set<string>): GraphRow[] {
  const field = asString(transform.field);
  const outputField = asString(transform.as) ?? "bin";
  const maxBins = Math.max(1, Math.floor(asNumber(transform.maxBins) ?? 8));
  if (!field) throw new Error("Graph bin transforms require a field.");
  ensureKnownField(field, knownFields, "Graph bin");

  const numericValues = rows.map((row) => toNumeric(row[field] ?? null, field));
  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  const step = min === max ? 1 : (max - min) / maxBins;

  return rows.map((row) => {
    const value = toNumeric(row[field] ?? null, field);
    const index = step === 0 ? 0 : Math.min(maxBins - 1, Math.floor((value - min) / step));
    const start = min + index * step;
    const end = min + (index + 1) * step;
    return {
      ...row,
      [outputField]: `${start.toFixed(2)}-${end.toFixed(2)}`,
      [`${outputField}_start`]: Number(start.toFixed(4)),
      [`${outputField}_end`]: Number(end.toFixed(4)),
    };
  });
}

function foldRows(rows: GraphRow[], transform: Extract<GraphTransformInput, { type: "fold" }>, knownFields: Set<string>): GraphRow[] {
  const fields = asStringArray(transform.fields);
  if (fields.length === 0) throw new Error("Graph fold transforms require at least one field.");
  for (const field of fields) ensureKnownField(field, knownFields, "Graph fold");
  const [keyField, valueField] = transform.as ?? ["key", "value"];

  return rows.flatMap((row) => {
    const base = Object.fromEntries(Object.entries(row).filter(([key]) => !fields.includes(key)));
    return fields.map((field) => ({
      ...base,
      [keyField]: field,
      [valueField]: row[field] ?? null,
    }));
  });
}

type CalcToken =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" }
  | { type: "paren"; value: "(" | ")" };

function tokenizeExpression(expression: string): CalcToken[] {
  const tokens: CalcToken[] = [];
  let index = 0;

  while (index < expression.length) {
    const slice = expression.slice(index);
    const whitespace = slice.match(/^\s+/);
    if (whitespace) {
      index += whitespace[0].length;
      continue;
    }

    const numberMatch = slice.match(/^\d+(?:\.\d+)?/);
    if (numberMatch) {
      tokens.push({ type: "number", value: Number(numberMatch[0]) });
      index += numberMatch[0].length;
      continue;
    }

    const identifierMatch = slice.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifierMatch) {
      tokens.push({ type: "identifier", value: identifierMatch[0] });
      index += identifierMatch[0].length;
      continue;
    }

    const char = expression[index];
    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }

    throw new Error("Graph calculate transforms only support identifiers, numbers, parentheses, and + - * / operators.");
  }

  return tokens;
}

function evaluateExpression(expression: string, row: GraphRow, knownFields: Set<string>): number {
  const tokens = tokenizeExpression(expression);
  let index = 0;

  const parseFactor = (): number => {
    const token = tokens[index];
    if (!token) throw new Error("Unexpected end of calculate expression.");

    if (token.type === "operator" && token.value === "-") {
      index += 1;
      return -parseFactor();
    }

    if (token.type === "number") {
      index += 1;
      return token.value;
    }

    if (token.type === "identifier") {
      ensureKnownField(token.value, knownFields, "Graph calculate");
      index += 1;
      return toNumeric(row[token.value] ?? null, token.value);
    }

    if (token.type === "paren" && token.value === "(") {
      index += 1;
      const value = parseExpression();
      const closing = tokens[index];
      if (!closing || closing.type !== "paren" || closing.value !== ")") {
        throw new Error("Unclosed parenthesis in calculate expression.");
      }
      index += 1;
      return value;
    }

    throw new Error("Invalid calculate expression.");
  };

  const parseTerm = (): number => {
    let value = parseFactor();
    while (tokens[index]?.type === "operator" && (tokens[index].value === "*" || tokens[index].value === "/")) {
      const operator = tokens[index].value;
      index += 1;
      const right = parseFactor();
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  };

  const parseExpression = (): number => {
    let value = parseTerm();
    while (tokens[index]?.type === "operator" && (tokens[index].value === "+" || tokens[index].value === "-")) {
      const operator = tokens[index].value;
      index += 1;
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };

  const result = parseExpression();
  if (index !== tokens.length) throw new Error("Invalid calculate expression.");
  return result;
}

function calculateRows(rows: GraphRow[], transform: Extract<GraphTransformInput, { type: "calculate" }>, knownFields: Set<string>): GraphRow[] {
  const outputField = asString(transform.as);
  const expression = asString(transform.expression);
  if (!outputField || !expression) throw new Error("Graph calculate transforms require as and expression.");

  return rows.map((row) => ({
    ...row,
    [outputField]: evaluateExpression(expression, row, knownFields),
  }));
}

function applyTransforms(rows: GraphRow[], transforms: GraphTransformInput[]): GraphRow[] {
  let current = rows;
  let knownFields = new Set(deriveColumns(rows));

  for (const transform of transforms) {
    if (!transform || typeof transform !== "object" || !("type" in transform)) {
      throw new Error("Graph transforms must be valid objects with a type.");
    }

    switch (transform.type) {
      case "filter":
        current = filterRows(current, transform, knownFields);
        break;
      case "aggregate":
        current = aggregateRows(current, transform, knownFields);
        break;
      case "sort":
        current = sortRows(current, transform, knownFields);
        break;
      case "limit":
        current = limitRows(current, transform);
        break;
      case "bin":
        current = binRows(current, transform, knownFields);
        break;
      case "fold":
        current = foldRows(current, transform, knownFields);
        break;
      case "calculate":
        current = calculateRows(current, transform, knownFields);
        break;
      default:
        throw new Error(`Unsupported graph transform '${String((transform as { type?: unknown }).type)}'.`);
    }

    knownFields = new Set(deriveColumns(current));
  }

  return current;
}

function ensureFieldPresence(rows: GraphRow[], field: string, label: string) {
  if (rows.length === 0) return;
  const hasField = rows.some((row) => Object.prototype.hasOwnProperty.call(row, field));
  if (!hasField) throw new Error(`${label} must reference a field present in the supplied data.`);
}

function ensureNumericField(rows: GraphRow[], field: string, label: string) {
  if (rows.length === 0) return;
  const hasNumericValue = rows.some((row) => {
    try {
      toNumeric(row[field] ?? null, field);
      return true;
    } catch {
      return false;
    }
  });
  if (!hasNumericValue) throw new Error(`${label} must reference at least one numeric value.`);
}

function buildHistogramRows(rows: GraphRow[], x: GraphEncoding): { rows: GraphRow[]; x: GraphEncoding; y: GraphEncoding } {
  const numericValues = rows.map((row) => toNumeric(row[x.field] ?? null, x.field));
  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  const maxBins = Math.min(8, Math.max(1, numericValues.length));
  const step = min === max ? 1 : (max - min) / maxBins;
  const buckets = new Map<string, number>();

  for (const value of numericValues) {
    const index = step === 0 ? 0 : Math.min(maxBins - 1, Math.floor((value - min) / step));
    const start = min + index * step;
    const end = min + (index + 1) * step;
    const label = `${start.toFixed(2)}-${end.toFixed(2)}`;
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }

  return {
    rows: Array.from(buckets.entries()).map(([bin, count]) => ({ bin, count })),
    x: { field: "bin", type: "ordinal", label: x.label ?? x.field },
    y: { field: "count", type: "quantitative", label: "Count" },
  };
}

function buildHeatmapRows(rows: GraphRow[], x: GraphEncoding, y: GraphEncoding, color?: GraphEncoding): { rows: GraphRow[]; color: GraphEncoding } {
  if (color) {
    ensureNumericField(rows, color.field, "generate_graph heatmap color");
    return { rows, color };
  }

  const buckets = new Map<string, GraphRow>();
  for (const row of rows) {
    const key = JSON.stringify([row[x.field] ?? null, row[y.field] ?? null]);
    const existing = buckets.get(key);
    if (existing) {
      existing.count = toNumeric(existing.count ?? 0, "count") + 1;
    } else {
      buckets.set(key, {
        [x.field]: row[x.field] ?? null,
        [y.field]: row[y.field] ?? null,
        count: 1,
      });
    }
  }

  return {
    rows: Array.from(buckets.values()),
    color: { field: "count", type: "quantitative", label: "Count" },
  };
}

function resolveTopLevelRows(input: Record<string, unknown>, options?: ResolveGenerateGraphPayloadOptions): { rows: GraphRow[]; source?: GraphSourceMeta } {
  const topLevelRows = isObject(input.data) ? asRowArray(input.data.rows) : [];
  const dataSource = isObject(input.data) && isObject(input.data.source)
    ? (input.data.source as GraphDataSourceInput)
    : undefined;

  if (!dataSource) {
    return { rows: topLevelRows };
  }

  if (!options?.sourceData) {
    throw new Error("generate_graph data.source requests require a resolved tool result. Execute the tool server-side before attempting to render the graph.");
  }

  return {
    rows: options.sourceData.rows,
    source: options.sourceData.source,
  };
}

function getSpecTransforms(spec: Record<string, unknown>): GraphTransformInput[] {
  if (Array.isArray(spec.transforms)) return spec.transforms as GraphTransformInput[];
  if (Array.isArray(spec.transform)) return spec.transform as GraphTransformInput[];
  return [];
}

function resolveExplicitSpec(spec: Record<string, unknown>, fallbackRows: GraphRow[], source?: GraphSourceMeta): GraphSpec {
  const kind = asString(spec.graphType) as GraphKind | undefined;
  if (!kind) throw new Error("generate_graph spec.graphType is required.");

  const rawRows = (() => {
    const nestedRows = asRowsContainer(spec.data);
    return nestedRows.length > 0 ? nestedRows : fallbackRows;
  })();
  const rows = applyTransforms(rawRows, getSpecTransforms(spec));
  const x = normalizeEncoding(isObject(spec.x) ? (spec.x as GraphFieldEncodingInput) : undefined, asString(spec.xField), asString(spec.xType) as GraphAxisType | undefined, asString(spec.xLabel), rows, kind === "scatter" || kind === "bubble" || kind === "histogram" ? "quantitative" : "ordinal");
  const y = normalizeEncoding(isObject(spec.y) ? (spec.y as GraphFieldEncodingInput) : undefined, asString(spec.yField), asString(spec.yType) as GraphAxisType | undefined, asString(spec.yLabel), rows, "quantitative");
  const color = normalizeEncoding(isObject(spec.color) ? (spec.color as GraphFieldEncodingInput) : undefined, asString(spec.seriesField), asString(spec.seriesType) as GraphAxisType | undefined, asString(spec.seriesLabel), rows, "nominal");
  const size = normalizeEncoding(isObject(spec.size) ? (spec.size as GraphFieldEncodingInput) : undefined, undefined, undefined, undefined, rows, "quantitative");
  const tooltip = normalizeTooltip(spec.tooltip, rows);

  switch (kind) {
    case "table":
      return {
        kind,
        data: rows,
        columns: deriveColumns(rows, asStringArray(spec.columns)),
        tooltip,
        source,
      };
    case "histogram": {
      if (!x) throw new Error("generate_graph histogram specs require x.");
      ensureFieldPresence(rows, x.field, "generate_graph histogram x");
      ensureNumericField(rows, x.field, "generate_graph histogram x");
      const histogram = buildHistogramRows(rows, x);
      return {
        kind,
        data: histogram.rows,
        columns: deriveColumns(histogram.rows),
        x: histogram.x,
        y: histogram.y,
        tooltip,
        source,
      };
    }
    case "heatmap": {
      if (!x || !y) throw new Error("generate_graph heatmap specs require x and y.");
      ensureFieldPresence(rows, x.field, "generate_graph heatmap x");
      ensureFieldPresence(rows, y.field, "generate_graph heatmap y");
      const heatmap = buildHeatmapRows(rows, x, y, color);
      return {
        kind,
        data: heatmap.rows,
        columns: deriveColumns(heatmap.rows),
        x,
        y,
        color: heatmap.color,
        tooltip,
        source,
      };
    }
    case "line":
    case "area":
    case "bar":
    case "grouped-bar":
    case "stacked-bar":
    case "scatter":
    case "bubble": {
      if (!x || !y) throw new Error(`generate_graph ${kind} specs require both x and y.`);
      ensureFieldPresence(rows, x.field, `generate_graph ${kind} x`);
      ensureFieldPresence(rows, y.field, `generate_graph ${kind} y`);
      ensureNumericField(rows, y.field, `generate_graph ${kind} y`);
      if (kind === "grouped-bar" || kind === "stacked-bar") {
        if (!color) throw new Error(`generate_graph ${kind} specs require color or seriesField.`);
        ensureFieldPresence(rows, color.field, `generate_graph ${kind} color`);
      }
      if (kind === "bubble") {
        if (!size) throw new Error("generate_graph bubble specs require size.");
        ensureFieldPresence(rows, size.field, "generate_graph bubble size");
        ensureNumericField(rows, size.field, "generate_graph bubble size");
      }
      if (color) ensureFieldPresence(rows, color.field, `generate_graph ${kind} color`);

      return {
        kind,
        data: rows,
        columns: deriveColumns(rows),
        x,
        y,
        series: color,
        color,
        size,
        tooltip,
        source,
      };
    }
  }
}

function resolveVegaLiteSpec(spec: Record<string, unknown>, fallbackRows: GraphRow[], source?: GraphSourceMeta): GraphSpec {
  const mark = asString(spec.mark);
  if (!mark) throw new Error("generate_graph vegaLite.mark is required.");

  const rawRows = (() => {
    const nestedRows = asRowsContainer(spec.data);
    return nestedRows.length > 0 ? nestedRows : fallbackRows;
  })();
  const rows = applyTransforms(rawRows, getSpecTransforms(spec));
  const encoding = isObject(spec.encoding) ? spec.encoding : {};
  const x = normalizeEncoding(isObject(encoding.x) ? (encoding.x as GraphFieldEncodingInput) : undefined, undefined, undefined, undefined, rows, mark === "point" || mark === "circle" ? "quantitative" : "ordinal");
  const y = normalizeEncoding(isObject(encoding.y) ? (encoding.y as GraphFieldEncodingInput) : undefined, undefined, undefined, undefined, rows, "quantitative");
  const color = normalizeEncoding(isObject(encoding.color) ? (encoding.color as GraphFieldEncodingInput) : undefined, undefined, undefined, undefined, rows, "nominal");
  const size = normalizeEncoding(isObject(encoding.size) ? (encoding.size as GraphFieldEncodingInput) : undefined, undefined, undefined, undefined, rows, "quantitative");
  const tooltip = normalizeTooltip(encoding.tooltip, rows);

  const graphType: GraphKind = (() => {
    switch (mark) {
      case "line":
        return "line";
      case "area":
        return "area";
      case "bar":
        return color ? "grouped-bar" : "bar";
      case "point":
      case "circle":
        return size ? "bubble" : "scatter";
      case "rect":
        return "heatmap";
      case "table":
        return "table";
      default:
        throw new Error(`Unsupported graph mark '${mark}'.`);
    }
  })();

  return resolveExplicitSpec(
    {
      graphType,
      columns: spec.columns,
      x,
      y,
      color,
      size,
      tooltip,
      data: { values: rows },
    },
    rows,
    source,
  );
}

function buildGraphFromSpec(spec: Record<string, unknown>, fallbackRows: GraphRow[], source?: GraphSourceMeta): GraphSpec {
  if (typeof spec.graphType === "string") return resolveExplicitSpec(spec, fallbackRows, source);
  if (typeof spec.mark === "string") return resolveVegaLiteSpec(spec, fallbackRows, source);
  throw new Error("generate_graph requires a structured spec with either graphType or mark.");
}

export function resolveGenerateGraphPayload(
  input: GenerateGraphInput | Record<string, unknown>,
  options?: ResolveGenerateGraphPayloadOptions,
): ResolvedGraphPayload {
  const title = asString(input.title);
  const caption = asString(input.caption);
  const summary = asString(input.summary);
  const downloadFileName = asString(input.downloadFileName);
  const spec = isObject(input.spec) ? input.spec : undefined;
  const vegaLite = isObject(input.vegaLite) ? input.vegaLite : undefined;
  const { rows: topLevelRows, source } = resolveTopLevelRows(input, options);

  if (spec && vegaLite) {
    throw new Error("generate_graph accepts either spec with data.rows or vegaLite, but not both in the same call.");
  }

  if (!spec && !vegaLite) {
    throw new Error("generate_graph requires either structured mode (data.rows + spec) or advanced mode (vegaLite).");
  }

  const graph = spec
    ? buildGraphFromSpec(spec, topLevelRows, source)
    : buildGraphFromSpec(vegaLite as Record<string, unknown>, topLevelRows, source);

  return {
    graph,
    title,
    caption,
    summary,
    downloadFileName,
    dataPreview: buildPreview(graph.data),
    source,
  };
}
