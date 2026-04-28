import type { CapabilitySchemaFacet } from "./capability-definition";

type InputSchema = CapabilitySchemaFacet["inputSchema"];

// Keep these schema literals dependency-light so catalog initialization does not
// import tool modules that pull in runtime registries or command constructors.
function emptyObjectSchema(): InputSchema {
  return {
    type: "object",
    properties: {},
  };
}

const ADMIN_REFERRAL_EXCEPTION_KINDS = [
  "invalid_referral_source",
  "missing_referral_join",
  "disabled_referral_code",
  "credit_review_backlog",
] as const;

const BLOG_IMAGE_SIZES = ["1024x1024", "1536x1024", "1024x1536", "auto"] as const;
const BLOG_IMAGE_QUALITIES = ["low", "medium", "high", "auto"] as const;
const BLOG_IMAGE_PRESETS = ["portrait", "landscape", "square", "hd", "artistic"] as const;
const JOURNAL_STATUSES = ["draft", "review", "approved", "published"] as const;
const JOURNAL_SECTIONS = ["essay", "briefing"] as const;
const ANALYTICS_GRAPH_SOURCE_TYPES = [
  "analytics_funnel",
  "lead_queue",
  "routing_review",
  "conversation_activity",
  "affiliate_my_overview",
  "affiliate_my_timeseries",
  "affiliate_my_pipeline",
  "affiliate_my_recent_activity",
  "admin_affiliate_overview",
  "admin_affiliate_leaderboard",
  "admin_affiliate_pipeline",
  "admin_referral_exceptions",
] as const;

const FACTORY_ASSET_KINDS = ["image", "chart", "graph", "audio", "video"] as const;
const FACTORY_QA_CRITERIA = [
  "accuracy",
  "accessibility",
  "tone_match",
  "performance",
  "brand_compliance",
  "completeness",
  "uniqueness",
] as const;

const ARTICLE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    post_id: {
      type: "string",
      description: "Optional existing blog post ID for artifact persistence.",
    },
    title: { type: "string", description: "Article title." },
    description: { type: "string", description: "Article description." },
    content: { type: "string", description: "Structured markdown article content." },
  },
  required: ["title", "description", "content"],
} as const satisfies InputSchema;

const GENERATE_CHART_INPUT_SCHEMA = {
  type: "object",
  properties: {
    assetId: {
      type: "string",
      description: "Optional pre-allocated asset identifier.",
    },
    code: {
      type: "string",
      description:
        "Optional raw Mermaid code for advanced diagrams. Must start with a Mermaid type such as 'flowchart TD', 'graph LR', 'pie', 'mindmap', or 'xychart-beta'.",
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
              shape: {
                type: "string",
                enum: ["rect", "round", "circle", "diamond", "hexagon"],
              },
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
} as const satisfies InputSchema;

const GENERATE_GRAPH_INPUT_SCHEMA = {
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
      description:
        "Short textual takeaway shown with the graph for fast scanning and accessibility.",
    },
    downloadFileName: {
      type: "string",
      description: "Optional filename stem to use when the user downloads the rendered graph.",
    },
    data: {
      type: "object",
      description:
        "Top-level data payload. Use rows for inline datasets. Use source only for approved server-owned datasets that the backend resolves before rendering.",
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
      description:
        "Structured graph definition. Use this with data.rows or data.source. Backward-compatible xField/yField forms still work, but x/y/color/size/tooltip encodings are preferred. Example: data.rows=[{week:'2026-03-01', qualified:4},{week:'2026-03-08', qualified:7}] with spec={graphType:'line', x:{field:'week', type:'temporal'}, y:{field:'qualified', type:'quantitative'}}.",
      properties: {
        graphType: {
          type: "string",
          enum: [
            "line",
            "area",
            "bar",
            "grouped-bar",
            "stacked-bar",
            "scatter",
            "bubble",
            "histogram",
            "heatmap",
            "table",
          ],
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
            aggregate: {
              type: "string",
              enum: ["sum", "avg", "count", "min", "max", "median"],
            },
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
            aggregate: {
              type: "string",
              enum: ["sum", "avg", "count", "min", "max", "median"],
            },
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
            aggregate: {
              type: "string",
              enum: ["sum", "avg", "count", "min", "max", "median"],
            },
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
            aggregate: {
              type: "string",
              enum: ["sum", "avg", "count", "min", "max", "median"],
            },
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
      description:
        "Advanced mode. Provide a validated Vega-Lite-style subset with mark, data.values, encoding, and optional transform. Prefer structured spec mode first; use this only when the graph needs a lower-level declarative shape.",
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
} as const satisfies InputSchema;

const LIST_DEFERRED_JOBS_INPUT_SCHEMA = {
  type: "object",
  properties: {
    active_only: {
      type: "boolean",
      description:
        "When true or omitted, return only queued and running jobs. When false, include recent terminal jobs too.",
    },
    limit: {
      type: "number",
      description: "Maximum number of jobs to return, between 1 and 25.",
    },
  },
} as const satisfies InputSchema;

const LIST_CONVERSATION_MEDIA_ASSETS_INPUT_SCHEMA = {
  type: "object",
  properties: {
    kinds: {
      type: "array",
      description: "Optional media kinds to include in the result.",
      items: {
        type: "string",
        enum: ["audio", "chart", "graph", "image", "video", "subtitle", "waveform"],
      },
    },
    limit: {
      type: "number",
      description: "Maximum number of assets to return, between 1 and 25.",
    },
  },
} as const satisfies InputSchema;

export const CATALOG_INPUT_SCHEMAS = {
  admin_search: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (minimum 2 characters).",
      },
      entityTypes: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional filter to search only specific entity types. Valid values: user, lead, consultation, deal, training, conversation, job, prompt, journal.",
      },
    },
    required: ["query"],
  },
  admin_prioritize_leads: {
    type: "object",
    properties: {
      max_results: {
        type: "number",
        description: "Optional number of ranked leads to return (1-5, default 3).",
      },
    },
  },
  admin_prioritize_offer: {
    type: "object",
    properties: {
      max_results: {
        type: "number",
        description: "Reserved for future use. Present for schema stability.",
      },
    },
  },
  admin_triage_routing_risk: {
    type: "object",
    properties: {
      max_results: {
        type: "number",
        description: "Optional number of risks to return (1-5, default 3).",
      },
    },
  },
  approve_journal_post: {
    type: "object",
    properties: {
      post_id: { type: "string", description: "The journal post identifier" },
      change_note: { type: "string", description: "Optional revision note for the workflow transition" },
    },
    required: ["post_id"],
  },
  compose_blog_article: {
    type: "object",
    properties: {
      brief: { type: "string", description: "The content brief." },
      audience: { type: "string", description: "Optional target audience." },
      objective: { type: "string", description: "Optional business objective." },
      tone: { type: "string", description: "Optional editorial tone." },
    },
    required: ["brief"],
  },
  generate_audio: {
    type: "object",
    properties: {
      text: { type: "string" },
      title: { type: "string" },
      assetId: { type: "string" },
    },
    required: ["text", "title"],
  },
  generate_blog_image: {
    type: "object",
    properties: {
      post_id: {
        type: "string",
        description: "Optional blog post ID to attach and link as the hero image.",
      },
      prompt: {
        type: "string",
        description: "The image-generation prompt to send to the provider.",
      },
      alt_text: {
        type: "string",
        description: "Accessible alt text stored on the blog asset.",
      },
      preset: {
        type: "string",
        enum: [...BLOG_IMAGE_PRESETS],
        description: "Optional generation preset that guides size and strategy selection.",
      },
      size: {
        type: "string",
        enum: [...BLOG_IMAGE_SIZES],
        description:
          "Requested output size. If omitted, the system applies preset-aware and prompt-aware heuristics.",
      },
      quality: {
        type: "string",
        enum: [...BLOG_IMAGE_QUALITIES],
        description: "Requested output quality. Default: high.",
      },
      enhance_prompt: {
        type: "boolean",
        description: "Whether provider-side prompt enhancement is allowed. Default: true.",
      },
      set_as_hero: {
        type: "boolean",
        description:
          "When true, the generated asset becomes the canonical hero image for the target post. When false, it is stored as an admin-only candidate.",
      },
      variation_group_id: {
        type: "string",
        description: "Optional editorial grouping identifier for related hero-image candidates.",
      },
    },
    required: ["prompt", "alt_text"],
  },
  generate_blog_image_prompt: ARTICLE_INPUT_SCHEMA,
  generate_chart: GENERATE_CHART_INPUT_SCHEMA,
  generate_graph: GENERATE_GRAPH_INPUT_SCHEMA,
  get_admin_affiliate_summary: emptyObjectSchema(),
  get_checklist: {
    type: "object",
    properties: {
      book_slug: { type: "string", description: "Optional specific book." },
    },
  },
  get_corpus_summary: emptyObjectSchema(),
  get_deferred_job_status: {
    type: "object",
    properties: {
      job_id: { type: "string", description: "The deferred job ID to inspect." },
    },
    required: ["job_id"],
  },
  get_journal_post: {
    type: "object",
    properties: {
      post_id: { type: "string", description: "The journal post identifier" },
      slug: { type: "string", description: "The journal post slug (alternative to post_id)" },
    },
  },
  get_journal_workflow_summary: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Maximum number of active jobs to summarize, clamped to 1-50",
      },
    },
  },
  get_my_affiliate_summary: emptyObjectSchema(),
  get_my_job_status: {
    type: "object",
    properties: {
      job_id: {
        type: "string",
        description: "The job ID to inspect for this signed-in account.",
      },
    },
    required: ["job_id"],
  },
  get_my_profile: emptyObjectSchema(),
  get_my_referral_qr: emptyObjectSchema(),
  get_section: {
    type: "object",
    properties: {
      document_slug: { type: "string" },
      section_slug: { type: "string" },
    },
    required: ["document_slug", "section_slug"],
  },
  inspect_runtime_logs: {
    type: "object",
    properties: {
      log_file: {
        type: "string",
        enum: ["deferred_job", "mcp_process", "native_process", "remote_service"],
        description: "The name of the log file to inspect."
      },
      limit: {
        type: "number",
        description: "Maximum number of recent log lines to return (default: 50, max: 200)."
      },
      level: {
        type: "string",
        enum: ["info", "warn", "error"],
        description: "Optional filter for log level."
      },
      grep: {
        type: "string",
        description: "Optional text to search for within the raw log line."
      }
    },
    required: ["log_file"]
  },
  inspect_theme: emptyObjectSchema(),
  list_admin_referral_exceptions: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Optional maximum number of exception items to return. Defaults to 12 and is capped at 50.",
      },
      kind: {
        type: "string",
        enum: [...ADMIN_REFERRAL_EXCEPTION_KINDS],
        description: "Optional exception filter. Use only one of the declared exception kinds.",
      },
    },
  },
  list_conversation_media_assets: LIST_CONVERSATION_MEDIA_ASSETS_INPUT_SCHEMA,
  list_deferred_jobs: LIST_DEFERRED_JOBS_INPUT_SCHEMA,
  list_journal_posts: {
    type: "object",
    properties: {
      search: { type: "string", description: "Optional title or slug search term" },
      status: {
        type: "string",
        enum: [...JOURNAL_STATUSES],
        description: "Optional workflow status filter",
      },
      section: {
        type: "string",
        enum: [...JOURNAL_SECTIONS],
        description: "Optional journal section filter",
      },
      limit: {
        type: "number",
        description: "Maximum number of posts to return, clamped to 1-50",
      },
    },
  },
  list_journal_revisions: {
    type: "object",
    properties: {
      post_id: { type: "string", description: "The journal post identifier" },
    },
    required: ["post_id"],
  },
  list_my_jobs: LIST_DEFERRED_JOBS_INPUT_SCHEMA,
  list_my_referral_activity: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Optional maximum number of activity items to return. Defaults to 12 and is capped at 50.",
      },
    },
  },
  list_practitioners: {
    type: "object",
    properties: {
      query: { type: "string", description: "Optional name filter." },
    },
  },
  prepare_journal_post_for_publish: {
    type: "object",
    properties: {
      post_id: { type: "string", description: "The journal post identifier" },
      run_qa: {
        type: "boolean",
        description: "Whether to run article QA as part of the readiness check",
      },
      active_job_limit: {
        type: "number",
        description: "Maximum number of active jobs to include in the readiness summary, clamped to 1-50",
      },
    },
    required: ["post_id"],
  },
  produce_product: {
    type: "object",
    properties: {
      brief: {
        type: "object",
        description: "Validated ProductBrief payload for the factory orchestration pipeline.",
        properties: {
          id: { type: "string", description: "Unique product brief identifier." },
          schemaVersion: { type: "number", enum: [1] },
          title: { type: "string", description: "Human-readable release title." },
          topic: { type: "string", description: "Primary production topic or focus area." },
          description: { type: "string", description: "Optional scope summary for the production run." },
          audience: { type: "string", description: "Optional target audience." },
          tone: { type: "string", description: "Optional target tone or voice." },
          assetKinds: {
            type: "array",
            description: "Asset kinds that must be generated by the pipeline.",
            items: { type: "string", enum: [...FACTORY_ASSET_KINDS] },
          },
          qaCriteria: {
            type: "array",
            description: "QA criteria that the release must satisfy.",
            items: { type: "string", enum: [...FACTORY_QA_CRITERIA] },
          },
          targetChannels: {
            type: "array",
            description: "Publishing channels for the final release.",
            items: { type: "string" },
          },
          executionPreferences: {
            type: "object",
            properties: {
              autoRetryOnFailure: { type: "boolean" },
              parallelizeAssets: { type: "boolean" },
              maxAssetCount: { type: "number" },
            },
            required: ["autoRetryOnFailure", "parallelizeAssets"],
          },
          createdAt: { type: "string", description: "Timestamp when the brief was created." },
          createdBy: { type: "string", description: "Identity that authored the brief." },
          sourceConversationId: {
            type: "string",
            description: "Optional source conversation that originated the brief.",
          },
        },
        required: [
          "id",
          "schemaVersion",
          "title",
          "topic",
          "assetKinds",
          "qaCriteria",
          "targetChannels",
          "executionPreferences",
          "createdAt",
          "createdBy",
        ],
      },
      previousWorkOrderIds: {
        type: "array",
        description: "Optional prior work order ids that this run supersedes or continues.",
        items: { type: "string" },
      },
    },
    required: ["brief"],
  },
  produce_blog_article: {
    type: "object",
    properties: {
      brief: { type: "string", description: "The content brief." },
      audience: { type: "string", description: "Optional target audience." },
      objective: { type: "string", description: "Optional business objective." },
      tone: { type: "string", description: "Optional editorial tone." },
      enhance_image_prompt: {
        type: "boolean",
        description: "Allow provider-side prompt enhancement for the generated hero image.",
      },
    },
    required: ["brief"],
  },
  publish_journal_post: {
    type: "object",
    properties: {
      post_id: { type: "string", description: "The journal post identifier" },
      slug: { type: "string", description: "The journal post slug (alternative to post_id)" },
      change_note: { type: "string", description: "Optional revision note recorded before publish" },
    },
  },
  qa_blog_article: ARTICLE_INPUT_SCHEMA,
  resolve_blog_article_qa: {
    ...ARTICLE_INPUT_SCHEMA,
    properties: {
      ...ARTICLE_INPUT_SCHEMA.properties,
      qa_report: {
        type: "object",
        description: "The normalized QA report returned by qa_blog_article.",
      },
    },
    required: ["title", "description", "content", "qa_report"],
  },
  restore_journal_revision: {
    type: "object",
    properties: {
      post_id: { type: "string", description: "The journal post identifier" },
      revision_id: { type: "string", description: "The revision identifier to restore" },
      change_note: { type: "string", description: "Optional revision note for the restore action" },
    },
    required: ["post_id", "revision_id"],
  },
  search_my_conversations: {
    type: "object",
    properties: {
      query: { type: "string", description: "The search query." },
      max_results: { type: "number", description: "Max results (1-10)." },
    },
    required: ["query"],
  },
  select_journal_hero_image: {
    type: "object",
    properties: {
      post_id: { type: "string", description: "The journal post identifier" },
      asset_id: { type: "string", description: "The hero image asset identifier" },
    },
    required: ["post_id", "asset_id"],
  },
  submit_journal_review: {
    type: "object",
    properties: {
      post_id: { type: "string", description: "The journal post identifier" },
      change_note: { type: "string", description: "Optional revision note for the workflow transition" },
    },
    required: ["post_id"],
  },
  update_journal_draft: {
    type: "object",
    properties: {
      post_id: { type: "string", description: "The journal post identifier" },
      content: { type: "string", description: "Replacement markdown body for the journal draft" },
      change_note: { type: "string", description: "Optional revision note for the draft-body change" },
    },
    required: ["post_id", "content"],
  },
  update_journal_metadata: {
    type: "object",
    properties: {
      post_id: { type: "string", description: "The journal post identifier" },
      slug: { type: "string", description: "Optional replacement slug" },
      title: { type: "string", description: "Optional replacement title" },
      description: { type: "string", description: "Optional replacement description" },
      standfirst: {
        type: "string",
        description: "Optional replacement standfirst. Pass an empty string to clear it.",
      },
      section: {
        type: "string",
        enum: [...JOURNAL_SECTIONS, "unset"],
        description: "Optional replacement section or unset to clear it",
      },
      change_note: {
        type: "string",
        description: "Optional revision note for the metadata change",
      },
    },
    required: ["post_id"],
  },
  update_my_profile: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Updated display name for the account.",
      },
      email: {
        type: "string",
        description: "Updated email address for the account.",
      },
      credential: {
        type: ["string", "null"],
        description:
          "Credential or short public descriptor used for referrals. Use null to clear it.",
      },
    },
  },
} as const satisfies Record<string, InputSchema>;