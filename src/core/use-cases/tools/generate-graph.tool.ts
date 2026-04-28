import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import { ANALYTICS_GRAPH_SOURCE_TYPES } from "@/lib/analytics/analytics-dataset-registry";
import { GenerateGraphCommand } from "./UiTools";
import type { GenerateStoredGraphInput } from "@/lib/media/server/graph-generation-service";

export function parseGenerateGraphInput(value: unknown): GenerateStoredGraphInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("generate_graph input must be an object.");
  }
  return value as GenerateStoredGraphInput;
}

export const generateGraphTool: ToolDescriptor = {
  name: "generate_graph",
  schema: {
    description: "Generate a quantitative graph or data table for time-series questions, comparisons across segments or categories, distributions, outlier analysis, and explicit requests for a graph, trend, plot, values over time, or custom visualization. Prefer the structured spec with graphType plus x/y/color/size encodings and validated transforms. Use data.source only for approved server-owned datasets such as analytics_funnel, lead_queue, routing_review, conversation_activity, affiliate_my_* referral datasets, and the admin_affiliate_* referral datasets.",
    input_schema: {
      type: "object",
      properties: {
        assetId: {
          type: "string",
          description: "Optional pre-allocated asset identifier.",
        },
        title: {
          type: "string",
          description: "Primary graph title shown in the UI card header.",
        },
        caption: {
          type: "string",
          description: "Secondary subtitle or explanatory caption shown beneath the title.",
        },
        summary: {
          type: "string",
          description: "Short textual takeaway shown with the graph for fast scanning and accessibility.",
        },
        downloadFileName: {
          type: "string",
          description: "Optional filename stem to use when the user downloads the rendered graph.",
        },
        data: {
          type: "object",
          description: "Top-level data payload. Use rows for inline datasets. Use source only for approved server-owned datasets that the backend resolves before rendering.",
          properties: {
            rows: {
              type: "array",
              items: {
                type: "object",
              },
            },
            source: {
              type: "object",
              properties: {
                sourceType: {
                  type: "string",
                  enum: [...ANALYTICS_GRAPH_SOURCE_TYPES],
                },
                params: { type: "object" },
              },
            },
          },
        },
        spec: {
          type: "object",
          description: "Structured graph definition. Use this with data.rows or data.source. Backward-compatible xField/yField forms still work, but x/y/color/size/tooltip encodings are preferred. Example: data.rows=[{week:'2026-03-01', qualified:4},{week:'2026-03-08', qualified:7}] with spec={graphType:'line', x:{field:'week', type:'temporal'}, y:{field:'qualified', type:'quantitative'}}.",
          properties: {
            graphType: {
              type: "string",
              enum: ["line", "area", "bar", "grouped-bar", "stacked-bar", "scatter", "bubble", "histogram", "heatmap", "table"],
            },
            data: {
              type: "object",
              properties: {
                values: {
                  type: "array",
                  items: {
                    type: "object",
                  },
                },
              },
            },
            xField: { type: "string" },
            yField: { type: "string" },
            seriesField: { type: "string" },
            columns: {
              type: "array",
              items: { type: "string" },
            },
            xType: {
              type: "string",
              enum: ["quantitative", "temporal", "nominal", "ordinal"],
            },
            yType: {
              type: "string",
              enum: ["quantitative", "temporal", "nominal", "ordinal"],
            },
            seriesType: {
              type: "string",
              enum: ["quantitative", "temporal", "nominal", "ordinal"],
            },
            xLabel: { type: "string" },
            yLabel: { type: "string" },
            seriesLabel: { type: "string" },
            x: {
              type: "object",
              properties: {
                field: { type: "string" },
                type: {
                  type: "string",
                  enum: ["quantitative", "temporal", "nominal", "ordinal"],
                },
                title: { type: "string" },
                label: { type: "string" },
                aggregate: { type: "string", enum: ["sum", "avg", "count", "min", "max", "median"] },
              },
            },
            y: {
              type: "object",
              properties: {
                field: { type: "string" },
                type: {
                  type: "string",
                  enum: ["quantitative", "temporal", "nominal", "ordinal"],
                },
                title: { type: "string" },
                label: { type: "string" },
                aggregate: { type: "string", enum: ["sum", "avg", "count", "min", "max", "median"] },
              },
            },
            color: {
              type: "object",
              properties: {
                field: { type: "string" },
                type: {
                  type: "string",
                  enum: ["quantitative", "temporal", "nominal", "ordinal"],
                },
                title: { type: "string" },
                label: { type: "string" },
                aggregate: { type: "string", enum: ["sum", "avg", "count", "min", "max", "median"] },
              },
            },
            size: {
              type: "object",
              properties: {
                field: { type: "string" },
                type: {
                  type: "string",
                  enum: ["quantitative", "temporal", "nominal", "ordinal"],
                },
                title: { type: "string" },
                label: { type: "string" },
                aggregate: { type: "string", enum: ["sum", "avg", "count", "min", "max", "median"] },
              },
            },
            tooltip: {
              type: "array",
              items: {
                anyOf: [
                  { type: "string" },
                  {
                    type: "object",
                    properties: {
                      field: { type: "string" },
                      type: {
                        type: "string",
                        enum: ["quantitative", "temporal", "nominal", "ordinal"],
                      },
                      title: { type: "string" },
                      label: { type: "string" },
                    },
                  },
                ],
              },
            },
            transforms: {
              type: "array",
              items: {
                type: "object",
              },
            },
            encoding: {
              type: "object",
              description: "Legacy alias for Sprint 0 callers. Prefer x/y/color/size directly on spec.",
              properties: {
                x: {
                  type: "object",
                  properties: {
                    field: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["quantitative", "temporal", "nominal", "ordinal"],
                    },
                    title: { type: "string" },
                  },
                },
                y: {
                  type: "object",
                  properties: {
                    field: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["quantitative", "temporal", "nominal", "ordinal"],
                    },
                    title: { type: "string" },
                  },
                },
                color: {
                  type: "object",
                  properties: {
                    field: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["quantitative", "temporal", "nominal", "ordinal"],
                    },
                    title: { type: "string" },
                  },
                },
              },
            },
          },
          required: ["graphType"],
        },
        vegaLite: {
          type: "object",
          description: "Advanced mode. Provide a validated Vega-Lite-style subset with mark, data.values, encoding, and optional transform. Prefer structured spec mode first; use this only when the graph needs a lower-level declarative shape.",
          properties: {
            mark: {
              type: "string",
              enum: ["line", "area", "bar", "point", "circle", "rect", "table"],
            },
            data: {
              type: "object",
              properties: {
                values: {
                  type: "array",
                  items: {
                    type: "object",
                  },
                },
              },
            },
            columns: {
              type: "array",
              items: { type: "string" },
            },
            encoding: {
              type: "object",
              properties: {
                x: {
                  type: "object",
                  properties: {
                    field: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["quantitative", "temporal", "nominal", "ordinal"],
                    },
                    title: { type: "string" },
                  },
                },
                y: {
                  type: "object",
                  properties: {
                    field: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["quantitative", "temporal", "nominal", "ordinal"],
                    },
                    title: { type: "string" },
                  },
                },
                color: {
                  type: "object",
                  properties: {
                    field: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["quantitative", "temporal", "nominal", "ordinal"],
                    },
                    title: { type: "string" },
                  },
                },
                size: {
                  type: "object",
                  properties: {
                    field: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["quantitative", "temporal", "nominal", "ordinal"],
                    },
                    title: { type: "string" },
                  },
                },
              },
            },
            transform: {
              type: "array",
              items: {
                type: "object",
              },
            },
          },
          required: ["mark"],
        },
      },
    },
  },
  command: new GenerateGraphCommand(),
  roles: ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
  category: "ui",
};