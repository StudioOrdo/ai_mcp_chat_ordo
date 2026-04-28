/**
 * Analytics MCP Tool — Transport Layer
 *
 * Sprint 11: This module is the thin MCP transport wrapper. All domain logic
 * (SQL queries, statistical computation, data transformation) has been
 * extracted to analytics-domain.ts.
 *
 * The 3 exported entry points delegate to domain functions and remain
 * the stable public API for both MCP callers and src/ consumers.
 */
import type { AnalyticsToolDeps, AnalyticsMetric, TimeRange, CohortName, CohortMetric } from "./analytics-domain";
import {
  buildOverview,
  buildFunnel,
  buildEngagement,
  buildToolUsage,
  buildDropOff,
  buildRoutingReview,
  getCohortValues,
  buildStats,
  parseEventMetadata,
} from "./analytics-domain";

// Re-export the AnalyticsToolDeps type so existing consumers don't break
export type { AnalyticsToolDeps } from "./analytics-domain";

// ---------------------------------------------------------------------------
// MCP tool entry points
// ---------------------------------------------------------------------------

export async function conversationAnalytics(
  deps: AnalyticsToolDeps,
  args: { metric: AnalyticsMetric; time_range?: TimeRange; limit?: number },
): Promise<unknown> {
  const timeRange = args.time_range ?? "30d";

  switch (args.metric) {
    case "overview":
      return buildOverview(deps, timeRange);
    case "funnel":
      return buildFunnel(deps, timeRange);
    case "engagement":
      return buildEngagement(deps, timeRange);
    case "tool_usage":
      return buildToolUsage(deps, timeRange);
    case "drop_off":
      return buildDropOff(deps, timeRange);
    case "routing_review":
      return buildRoutingReview(deps, timeRange, args.limit);
    default:
      throw new Error(`Unsupported analytics metric: ${args.metric}`);
  }
}

export async function conversationInspect(
  deps: AnalyticsToolDeps,
  args: { conversation_id?: string; user_id?: string; limit?: number },
): Promise<unknown> {
  const limit = Math.min(Math.max(args.limit ?? 5, 1), 20);

  if (args.conversation_id) {
    const conversationId = args.conversation_id;
    const conversation = deps.db
      .prepare(`SELECT * FROM conversations WHERE id = ?`)
      .get(conversationId) as import("./analytics-domain").ConversationRow | undefined;

    if (!conversation) {
      return { error: "Conversation not found." };
    }

    const messages = deps.db
      .prepare(
        `SELECT id, role, content, created_at
         FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at ASC`,
      )
      .all(conversationId) as import("./analytics-domain").MessageRow[];
    const events = deps.db
      .prepare(
        `SELECT event_type, metadata, created_at
         FROM conversation_events
         WHERE conversation_id = ?
         ORDER BY created_at ASC`,
      )
      .all(conversationId) as Array<{ event_type: string; metadata: string; created_at: string }>;

    return {
      conversation: {
        id: conversation.id,
        user_id: conversation.user_id,
        title: conversation.title,
        status: conversation.status,
        message_count: conversation.message_count,
        session_source: conversation.session_source,
        converted_from: conversation.converted_from,
        lane: conversation.lane,
        lane_confidence: conversation.lane_confidence,
        recommended_next_step: conversation.recommended_next_step,
        detected_need_summary: conversation.detected_need_summary,
        lane_last_analyzed_at: conversation.lane_last_analyzed_at,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
      },
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content_preview: message.content.slice(0, 200),
        created_at: message.created_at,
      })),
      events: events.map((event) => ({
        event_type: event.event_type,
        metadata: parseEventMetadata({
          conversation_id: conversationId,
          event_type: event.event_type,
          metadata: event.metadata,
          created_at: event.created_at,
        }),
        created_at: event.created_at,
      })),
      routing_events: {
        lane_changed_count: events.filter((event) => event.event_type === "lane_changed").length,
        lane_uncertain_count: events.filter((event) => event.event_type === "lane_uncertain").length,
      },
    };
  }

  if (args.user_id) {
    const conversations = deps.db
      .prepare(
        `SELECT * FROM conversations
         WHERE user_id = ?
         ORDER BY updated_at DESC
         LIMIT ?`,
      )
      .all(args.user_id, limit) as import("./analytics-domain").ConversationRow[];

    return {
      user_id: args.user_id,
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        status: conversation.status,
        message_count: conversation.message_count,
        session_source: conversation.session_source,
        lane: conversation.lane,
        updated_at: conversation.updated_at,
      })),
    };
  }

  throw new Error("conversation_inspect requires conversation_id or user_id.");
}

export async function conversationCohort(
  deps: AnalyticsToolDeps,
  args: { cohort_a: CohortName; cohort_b: CohortName; metric: CohortMetric },
): Promise<unknown> {
  const valuesA = getCohortValues(deps, args.cohort_a, args.metric);
  const valuesB = getCohortValues(deps, args.cohort_b, args.metric);
  const minSample = Math.min(valuesA.length, valuesB.length);

  return {
    metric: args.metric,
    cohort_a: {
      name: args.cohort_a,
      ...buildStats(valuesA),
    },
    cohort_b: {
      name: args.cohort_b,
      ...buildStats(valuesB),
    },
    low_sample_warning: minSample < 30,
  };
}

// ---------------------------------------------------------------------------
// Tool schemas — Sprint 17: extracted from the MCP operations server transport shell
// ---------------------------------------------------------------------------

export function getAnalyticsToolSchemas() {
  return [
    {
      name: "conversation_analytics",
      description: "Aggregate conversation analytics for overview, funnel, engagement, tool usage, drop-off review, and routing review queues.",
      inputSchema: {
        type: "object" as const,
        properties: {
          metric: {
            type: "string",
            description: "Analytics metric: overview, funnel, engagement, tool_usage, drop_off, or routing_review.",
          },
          time_range: {
            type: "string",
            description: "Time window: 24h, 7d, 30d, or all.",
          },
          limit: {
            type: "number",
            description: "Optional per-queue limit for routing_review results.",
          },
        },
        required: ["metric"],
        additionalProperties: false,
      },
    },
    {
      name: "conversation_inspect",
      description: "Inspect one conversation or the most recent conversations for a user, with previews and event timeline.",
      inputSchema: {
        type: "object" as const,
        properties: {
          conversation_id: { type: "string", description: "Conversation ID to inspect." },
          user_id: { type: "string", description: "User ID to inspect if conversation_id is omitted." },
          limit: { type: "number", description: "Max conversations to return when using user_id." },
        },
        additionalProperties: false,
      },
    },
    {
      name: "conversation_cohort",
      description: "Compare two cohorts across message count, tool usage, session duration, or return rate.",
      inputSchema: {
        type: "object" as const,
        properties: {
          cohort_a: { type: "string", description: "First cohort: anonymous, authenticated, or converted." },
          cohort_b: { type: "string", description: "Second cohort: anonymous, authenticated, or converted." },
          metric: { type: "string", description: "Comparison metric: message_count, tool_usage, session_duration, or return_rate." },
        },
        required: ["cohort_a", "cohort_b", "metric"],
        additionalProperties: false,
      },
    },
  ];
}