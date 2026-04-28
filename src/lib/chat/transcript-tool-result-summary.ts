import { resolveGenerateChartPayload } from "@/core/use-cases/tools/chart-payload";
import { resolveGenerateGraphPayload } from "@/core/use-cases/tools/graph-payload";
import { isCapabilityResultEnvelope } from "@/lib/capabilities/capability-result-envelope";
import {
  isComposeBlogArticleResultPayload,
  isDraftContentResultPayload,
  isGenerateBlogImagePromptResultPayload,
  isGenerateBlogImageResultPayload,
  isPublishContentResultPayload,
  isProduceBlogArticleResultPayload,
  isQaBlogArticleResultPayload,
  isResolveBlogArticleQaResultPayload,
} from "@/lib/blog/blog-tool-payloads";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function summarizeToolResultForTranscript(name: string, result: unknown): string | null {
  const payload = isCapabilityResultEnvelope(result)
    ? result.payload
    : result;

  if (!isRecord(payload)) {
    return null;
  }

  if (name === "generate_chart") {
    try {
      const chart = resolveGenerateChartPayload(payload);
      const title = typeof chart.title === "string" && chart.title.trim().length > 0
        ? chart.title.trim()
        : "Chart";
      const lead = chart.code.split("\n")[0]?.trim() ?? "Mermaid";
      return `${name}: ${title} (${lead})`;
    } catch {
      const title = typeof payload.title === "string" && payload.title.trim().length > 0
        ? payload.title.trim()
        : "Chart";
      const assetId = typeof payload.assetId === "string" && payload.assetId.trim().length > 0
        ? payload.assetId.trim()
        : null;
      return assetId ? `${name}: ${title} (${assetId})` : `${name}: ${title}`;
    }
  }

  if (name === "generate_graph") {
    if (isRecord(payload.graph) && typeof payload.graph.kind === "string") {
      const title = typeof payload.title === "string" && payload.title.trim().length > 0
        ? payload.title.trim()
        : "Graph";
      return `${name}: ${title} (${payload.graph.kind})`;
    }

    try {
      const graph = resolveGenerateGraphPayload(payload);
      const title = typeof graph.title === "string" && graph.title.trim().length > 0
        ? graph.title.trim()
        : "Graph";
      return `${name}: ${title} (${graph.graph.kind})`;
    } catch {
      const title = typeof payload.title === "string" && payload.title.trim().length > 0
        ? payload.title.trim()
        : "Graph";
      const assetId = typeof payload.assetId === "string" && payload.assetId.trim().length > 0
        ? payload.assetId.trim()
        : null;
      return assetId ? `${name}: ${title} (${assetId})` : `${name}: ${title}`;
    }
  }

  if (name === "generate_audio" && payload.action === "generate_audio") {
    const title = typeof payload.title === "string" && payload.title.trim().length > 0
      ? payload.title.trim()
      : "Audio";
    const duration = typeof payload.estimatedDurationSeconds === "number"
      ? `${Math.round(payload.estimatedDurationSeconds)}s`
      : null;
    return duration ? `${name}: ${title} (${duration})` : `${name}: ${title}`;
  }

  if (
    name === "compose_media"
    && (payload.action === "compose_media"
      || typeof payload.planId === "string"
      || typeof payload.primaryAssetId === "string")
  ) {
    const planId = typeof payload.planId === "string" && payload.planId.trim().length > 0
      ? payload.planId.trim()
      : "plan";
    const primaryAssetId = typeof payload.primaryAssetId === "string" && payload.primaryAssetId.trim().length > 0
      ? payload.primaryAssetId.trim()
      : null;
    return primaryAssetId
      ? `${name}: ${planId} -> ${primaryAssetId}`
      : `${name}: ${planId}`;
  }

  if (name === "generate_blog_image_prompt" && isGenerateBlogImagePromptResultPayload(payload)) {
    return `${name}: ${payload.summary}`;
  }

  if (name === "generate_blog_image" && isGenerateBlogImageResultPayload(payload)) {
    if (typeof payload.summary === "string" && payload.summary.trim().length > 0) {
      return `${name}: ${payload.summary.trim()}`;
    }

    const label = typeof payload.title === "string" && payload.title.trim().length > 0
      ? payload.title.trim()
      : payload.assetId;
    return `${name}: ${label}`;
  }

  if (name === "compose_blog_article" && isComposeBlogArticleResultPayload(payload)) {
    return `${name}: ${payload.summary}`;
  }

  if (name === "qa_blog_article" && isQaBlogArticleResultPayload(payload)) {
    const findings = payload.findings.length;
    const findingsLabel = findings === 1 ? "1 finding" : `${findings} findings`;
    return `${name}: ${payload.summary} (${findingsLabel})`;
  }

  if (name === "resolve_blog_article_qa" && isResolveBlogArticleQaResultPayload(payload)) {
    return `${name}: ${payload.resolutionSummary}`;
  }

  if (name === "produce_blog_article" && isProduceBlogArticleResultPayload(payload)) {
    return `${name}: ${payload.summary}`;
  }

  if (name === "draft_content" && isDraftContentResultPayload(payload)) {
    return `${name}: Drafted "${payload.title}" at /journal/${payload.slug}`;
  }

  if (name === "publish_content" && isPublishContentResultPayload(payload)) {
    return `${name}: Published "${payload.title}" at /journal/${payload.slug}`;
  }

  return null;
}