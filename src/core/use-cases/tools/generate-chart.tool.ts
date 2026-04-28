import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import { GenerateChartCommand } from "./UiTools";
import type { GenerateStoredChartInput } from "@/lib/media/server/chart-generation-service";

export function parseGenerateChartInput(value: unknown): GenerateStoredChartInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("generate_chart input must be an object.");
  }
  return value as GenerateStoredChartInput;
}

export const generateChartTool: ToolDescriptor = {
  name: "generate_chart",
  schema: {
    description: "Generate a visual Mermaid.js chart. Prefer the structured spec for common chart families like flowcharts, pie charts, quadrants, xy charts, and mindmaps. Use raw Mermaid code only for advanced layouts. Do not send prose or summaries in the code field.",
    input_schema: {
      type: "object",
      properties: {
        assetId: {
          type: "string",
          description: "Optional pre-allocated asset identifier.",
        },
        code: {
          type: "string",
          description: "Optional raw Mermaid code for advanced diagrams. Must start with a Mermaid type such as 'flowchart TD', 'graph LR', 'pie', 'mindmap', or 'xychart-beta'.",
        },
        title: {
          type: "string",
          description: "Primary chart title shown in the UI card header.",
        },
        caption: {
          type: "string",
          description: "Secondary subtitle or explanatory caption shown beneath the title.",
        },
        downloadFileName: {
          type: "string",
          description: "Optional filename stem to use when the user downloads the rendered chart.",
        },
        spec: {
          type: "object",
          description: "Preferred structured chart definition for common chart types.",
          properties: {
            chartType: {
              type: "string",
              enum: ["flowchart", "pie", "quadrant", "xychart", "mindmap"],
            },
            direction: {
              type: "string",
              enum: ["TD", "TB", "BT", "RL", "LR"],
            },
            title: {
              type: "string",
              description: "Chart-level title embedded inside the Mermaid diagram when supported.",
            },
            nodes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  shape: { type: "string", enum: ["rect", "round", "circle", "diamond", "hexagon"] },
                  className: { type: "string" },
                },
              },
            },
            edges: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: { type: "string" },
                  to: { type: "string" },
                  label: { type: "string" },
                  lineStyle: { type: "string", enum: ["solid", "dashed", "thick"] },
                  arrowStyle: { type: "string", enum: ["arrow", "none"] },
                },
              },
            },
            subgraphs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  nodes: { type: "array", items: { type: "string" } },
                },
              },
            },
            classDefs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  styles: { type: "array", items: { type: "string" } },
                },
              },
            },
            showData: { type: "boolean" },
            slices: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  value: { type: "number" },
                },
              },
            },
            xAxis: {
              type: "object",
              properties: {
                minLabel: { type: "string" },
                maxLabel: { type: "string" },
                label: { type: "string" },
                values: { type: "array", items: { type: "string" } },
              },
            },
            yAxis: {
              type: "object",
              properties: {
                minLabel: { type: "string" },
                maxLabel: { type: "string" },
                label: { type: "string" },
                min: { type: "number" },
                max: { type: "number" },
              },
            },
            quadrants: {
              type: "object",
              properties: {
                topRight: { type: "string" },
                topLeft: { type: "string" },
                bottomLeft: { type: "string" },
                bottomRight: { type: "string" },
              },
            },
            points: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  x: { type: "number" },
                  y: { type: "number" },
                },
              },
            },
            series: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["bar", "line"] },
                  label: { type: "string" },
                  data: { type: "array", items: { type: "number" } },
                },
              },
            },
            root: { type: "string" },
            branches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  children: { type: "array", items: { type: "object" } },
                },
              },
            },
          },
        },
      },
    },
  },
  command: new GenerateChartCommand(),
  roles: ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
  category: "ui",
};
