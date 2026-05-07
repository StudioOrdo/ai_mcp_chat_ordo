export const INLINE_TYPES = {
  TEXT: "text",
  BOLD: "bold",
  CODE: "code-inline",
  LINK: "library-link",
  ACTION_LINK: "action-link",
} as const;

export type ActionLinkType = "conversation" | "route" | "send" | "tool" | "corpus" | "external" | "job" | "operation";

export const VALID_ACTION_TYPES: ReadonlySet<string> = new Set<string>(["conversation", "route", "send", "tool", "corpus", "external", "job", "operation"]);

export const BLOCK_TYPES = {
  PARAGRAPH: "paragraph",
  HEADING: "heading",
  LIST: "list",
  BLOCKQUOTE: "blockquote",
  JOB_STATUS: "job-status",
  OPERATION_CARD: "operation-card",
  CODE: "code-block",
  GRAPH: "graph",
  TABLE: "table",
  DIVIDER: "divider",
  OPERATOR_BRIEF: "operator-brief",
  AUDIO: "audio",
} as const;

export type OperatorBriefSection = {
  label: "NOW" | "NEXT" | "WAIT";
  summary: InlineNode[];
  items?: InlineNode[][];
};

export type OperationCardStatusTone = "neutral" | "active" | "blocked" | "danger" | "success";

export interface OperationCardModel {
  operationId: string;
  title: string;
  kind: string;
  status: string;
  statusLabel: string;
  statusTone: OperationCardStatusTone;
  riskLevel: string;
  riskLabel: string;
  summary: string | null;
  progressPercent: number | null;
  updatedAt: string | null;
  latestEventLabel: string | null;
  artifactCount: number;
  actionCount: number;
  actions: ActionLinkInlineNode[];
}

export type GraphValue = string | number | boolean | null;

export type GraphRow = Record<string, GraphValue>;

export type GraphAxisType = "quantitative" | "temporal" | "nominal" | "ordinal";

export type GraphEncoding = {
  field: string;
  type: GraphAxisType;
  label?: string;
  aggregate?: "sum" | "avg" | "count" | "min" | "max" | "median";
};

export type GraphKind =
  | "line"
  | "area"
  | "bar"
  | "grouped-bar"
  | "stacked-bar"
  | "scatter"
  | "bubble"
  | "histogram"
  | "heatmap"
  | "table";

export type GraphSourceMeta = {
  sourceType: string;
  label: string;
  rowCount: number;
};

export type GraphSpec = {
  kind: GraphKind;
  data: GraphRow[];
  columns?: string[];
  x?: GraphEncoding;
  y?: GraphEncoding;
  series?: GraphEncoding;
  color?: GraphEncoding;
  size?: GraphEncoding;
  tooltip?: GraphEncoding[];
  source?: GraphSourceMeta;
};

export type TextInlineNode = { type: typeof INLINE_TYPES.TEXT; text: string };
export type BoldInlineNode = { type: typeof INLINE_TYPES.BOLD; content: InlineNode[] };
export type CodeInlineNode = { type: typeof INLINE_TYPES.CODE; text: string };
export type LibraryLinkInlineNode = { type: typeof INLINE_TYPES.LINK; slug: string };
export type ActionLinkInlineNode = {
  type: typeof INLINE_TYPES.ACTION_LINK;
  label: string;
  actionType: ActionLinkType;
  value: string;
  params?: Record<string, string>;
};

export type InlineNode =
  | TextInlineNode
  | BoldInlineNode
  | CodeInlineNode
  | LibraryLinkInlineNode
  | ActionLinkInlineNode;

export type BlockNode =
  | { type: typeof BLOCK_TYPES.PARAGRAPH; content: InlineNode[] }
  | { type: typeof BLOCK_TYPES.HEADING; level: 1 | 2 | 3; content: InlineNode[] }
  | { type: typeof BLOCK_TYPES.LIST; items: InlineNode[][] }
  | { type: typeof BLOCK_TYPES.BLOCKQUOTE; content: InlineNode[] }
  | {
      type: typeof BLOCK_TYPES.JOB_STATUS;
      jobId: string;
      label: string;
      toolName: string;
      title?: string;
      subtitle?: string;
      status: "queued" | "running" | "succeeded" | "failed" | "canceled";
      progressPercent?: number | null;
      progressLabel?: string | null;
      summary?: string;
      error?: string;
      actions?: InlineNode[];
    }
  | {
      type: typeof BLOCK_TYPES.OPERATION_CARD;
      operation: OperationCardModel;
    }
  | {
      type: typeof BLOCK_TYPES.CODE;
      code: string;
      language?: string;
      title?: string;
      caption?: string;
      downloadFileName?: string;
    }
  | {
      type: typeof BLOCK_TYPES.GRAPH;
      graph: GraphSpec;
      title?: string;
      caption?: string;
      summary?: string;
      downloadFileName?: string;
      dataPreview?: GraphRow[];
      source?: GraphSourceMeta;
    }
  | { type: typeof BLOCK_TYPES.TABLE; header?: InlineNode[][]; rows: InlineNode[][][] }
  | { type: typeof BLOCK_TYPES.DIVIDER }
  | { type: typeof BLOCK_TYPES.OPERATOR_BRIEF; sections: OperatorBriefSection[] }
  | {
      type: typeof BLOCK_TYPES.AUDIO;
      text: string;
      title: string;
      assetId?: string;
      provider?: string;
      generationStatus?: string;
      estimatedDurationSeconds?: number;
      estimatedGenerationSeconds?: number;
    };

export interface RichContent {
  blocks: BlockNode[];
}
