import type Anthropic from "@anthropic-ai/sdk";

import {
  emitProviderEvent,
  classifyProviderError,
} from "@/lib/chat/provider-policy";
import type { IntelligenceProviderId } from "@/lib/ai/providers/types";

import type {
  BlogArticlePipelineModel,
  BlogImagePromptDesign,
  BlogQaReport,
  ComposeBlogArticleInput,
  ComposedBlogArticle,
  ResolvedBlogArticle,
} from "@/core/use-cases/BlogArticlePipelineModel";

type JsonObject = Record<string, unknown>;

interface JsonRequestOptions {
  userContent: string;
  systemInstructions: string;
  maxTokens: number;
  expectedShape: string;
  abortSignal?: AbortSignal;
}

interface TextRequestOptions {
  userContent: string;
  systemInstructions: string;
  maxTokens: number;
  abortSignal?: AbortSignal;
}

function extractFirstText(response: Anthropic.Message): string {
  const textBlock = response.content.find((block) => block.type === "text");
  const text = textBlock?.text?.trim();

  if (!text) {
    throw new Error("Article pipeline provider returned no text response.");
  }

  return text;
}

function extractJsonObject(text: string): JsonObject {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fencedMatch?.[1]?.trim() ?? text;
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Article pipeline provider did not return valid JSON.");
  }

  return JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as JsonObject;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Article pipeline provider returned invalid ${label}.`);
  }

  return value.trim();
}

function createJsonSystemPrompt(instructions: string): string {
  return `${instructions}\nReturn JSON only. Do not wrap the response in markdown code fences.`;
}

function preview(text: string): string {
  return JSON.stringify(text.slice(0, 280));
}

function getRepairMaxTokens(initialStopReason: Anthropic.Message["stop_reason"], maxTokens: number): number {
  if (initialStopReason === "max_tokens") {
    return Math.max(maxTokens + 2000, Math.ceil(maxTokens * 1.75), 5200);
  }

  return Math.max(maxTokens + 800, Math.ceil(maxTokens * 1.25), 3200);
}

function isJsonTruncationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /did not return valid json/i.test(error.message)
    && /stop reason: max_tokens/i.test(error.message);
}

export class AnthropicBlogArticlePipelineModel implements BlogArticlePipelineModel {
  constructor(
    private readonly client: Anthropic,
    private readonly provider: IntelligenceProviderId,
    private readonly model: string,
  ) {}

  private async requestJsonObject(options: JsonRequestOptions): Promise<JsonObject> {
    const startTime = Date.now();

    emitProviderEvent({
      kind: "attempt_start",
      provider: this.provider,
      surface: "blog_production",
      model: this.model,
      attempt: 1,
    });

    let initialResponse: Anthropic.Message;
    try {
      initialResponse = await this.client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens,
        system: createJsonSystemPrompt(options.systemInstructions),
        messages: [{
          role: "user",
          content: options.userContent,
        }],
      }, {
        signal: options.abortSignal,
      });
    } catch (error) {
      emitProviderEvent({
        kind: "attempt_failure",
        provider: this.provider,
        surface: "blog_production",
        model: this.model,
        attempt: 1,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        errorClassification: classifyProviderError(error),
      });
      throw error;
    }

    emitProviderEvent({
      kind: "attempt_success",
      provider: this.provider,
      surface: "blog_production",
      model: this.model,
      attempt: 1,
      durationMs: Date.now() - startTime,
    });

    const initialText = extractFirstText(initialResponse);
    const repairMaxTokens = getRepairMaxTokens(initialResponse.stop_reason, options.maxTokens);

    try {
      return extractJsonObject(initialText);
    } catch {
      // JSON parse failed — attempt repair call
      const repairStartTime = Date.now();

      emitProviderEvent({
        kind: "attempt_start",
        provider: this.provider,
        surface: "blog_production",
        model: this.model,
        attempt: 2,
      });

      let repairedResponse: Anthropic.Message;
      try {
        repairedResponse = await this.client.messages.create({
          model: this.model,
          max_tokens: repairMaxTokens,
          system: createJsonSystemPrompt(
            "You repair or complete prior assistant output into a single valid JSON object. Preserve the original meaning and markdown content, but regenerate missing sections when the earlier response was truncated.",
          ),
          messages: [{
            role: "user",
            content: [
              `Return exactly one valid JSON object with this shape: ${options.expectedShape}`,
              "Original system instructions:",
              options.systemInstructions,
              "Original user request:",
              options.userContent,
              "Previous response draft to repair or complete:",
              initialText,
              "If the previous response was truncated, regenerate the complete JSON object from the original request while preserving any valid completed content.",
            ].join("\n\n"),
          }],
        }, {
          signal: options.abortSignal,
        });
      } catch (error) {
        emitProviderEvent({
          kind: "attempt_failure",
          provider: this.provider,
          surface: "blog_production",
          model: this.model,
          attempt: 2,
          durationMs: Date.now() - repairStartTime,
          error: error instanceof Error ? error.message : String(error),
          errorClassification: classifyProviderError(error),
        });
        throw error;
      }

      emitProviderEvent({
        kind: "attempt_success",
        provider: this.provider,
        surface: "blog_production",
        model: this.model,
        attempt: 2,
        durationMs: Date.now() - repairStartTime,
      });

      const repairedText = extractFirstText(repairedResponse);

      try {
        return extractJsonObject(repairedText);
      } catch {
        throw new Error(
          `Article pipeline provider did not return valid JSON. Initial stop reason: ${initialResponse.stop_reason ?? "unknown"}. Repair stop reason: ${repairedResponse.stop_reason ?? "unknown"}. Initial response preview: ${preview(initialText)}. Repair response preview: ${preview(repairedText)}.`,
        );
      }
    }
  }

  private async requestText(options: TextRequestOptions): Promise<string> {
    const startTime = Date.now();

    emitProviderEvent({
      kind: "attempt_start",
      provider: this.provider,
      surface: "blog_production",
      model: this.model,
      attempt: 1,
    });

    let initialResponse: Anthropic.Message;
    try {
      initialResponse = await this.client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens,
        system: options.systemInstructions,
        messages: [{
          role: "user",
          content: options.userContent,
        }],
      }, {
        signal: options.abortSignal,
      });
    } catch (error) {
      emitProviderEvent({
        kind: "attempt_failure",
        provider: this.provider,
        surface: "blog_production",
        model: this.model,
        attempt: 1,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        errorClassification: classifyProviderError(error),
      });
      throw error;
    }

    emitProviderEvent({
      kind: "attempt_success",
      provider: this.provider,
      surface: "blog_production",
      model: this.model,
      attempt: 1,
      durationMs: Date.now() - startTime,
    });

    const initialText = extractFirstText(initialResponse);

    if (initialResponse.stop_reason !== "max_tokens") {
      return initialText;
    }

    const repairStartTime = Date.now();

    emitProviderEvent({
      kind: "attempt_start",
      provider: this.provider,
      surface: "blog_production",
      model: this.model,
      attempt: 2,
    });

    let repairedResponse: Anthropic.Message;
    try {
      repairedResponse = await this.client.messages.create({
        model: this.model,
        max_tokens: getRepairMaxTokens(initialResponse.stop_reason, options.maxTokens),
        system: [
          options.systemInstructions,
          "Finish the response cleanly.",
          "Return only the completed output with no commentary or code fences.",
        ].join("\n\n"),
        messages: [{
          role: "user",
          content: [
            "Original request:",
            options.userContent,
            "Existing partial draft:",
            initialText,
            "Regenerate the full final output so it is complete and self-contained.",
          ].join("\n\n"),
        }],
      }, {
        signal: options.abortSignal,
      });
    } catch (error) {
      emitProviderEvent({
        kind: "attempt_failure",
        provider: this.provider,
        surface: "blog_production",
        model: this.model,
        attempt: 2,
        durationMs: Date.now() - repairStartTime,
        error: error instanceof Error ? error.message : String(error),
        errorClassification: classifyProviderError(error),
      });
      throw error;
    }

    emitProviderEvent({
      kind: "attempt_success",
      provider: this.provider,
      surface: "blog_production",
      model: this.model,
      attempt: 2,
      durationMs: Date.now() - repairStartTime,
    });

    const repairedText = extractFirstText(repairedResponse);

    if (repairedResponse.stop_reason === "max_tokens") {
      throw new Error(
        `Article pipeline provider returned truncated text output. Initial stop reason: ${initialResponse.stop_reason ?? "unknown"}. Repair stop reason: ${repairedResponse.stop_reason ?? "unknown"}. Initial response preview: ${preview(initialText)}. Repair response preview: ${preview(repairedText)}.`,
      );
    }

    return repairedText;
  }

  private async resolveQaWithSplitPasses(
    article: ComposedBlogArticle,
    report: BlogQaReport,
    options?: { abortSignal?: AbortSignal },
  ): Promise<ResolvedBlogArticle> {
    const resolvedContent = await this.requestText({
      maxTokens: 9000,
      systemInstructions: [
        "You revise blog article markdown to resolve editorial QA findings.",
        "Return only the final markdown body.",
        "Do not wrap the response in JSON or code fences.",
        "Do not repeat the title inside the content body.",
        "Preserve the article's structure and strengths while making only the changes needed to resolve the findings.",
      ].join("\n"),
      userContent: [
        `Title: ${article.title}`,
        `Description: ${article.description}`,
        `Original content:\n${article.content}`,
        `QA report: ${JSON.stringify(report)}`,
      ].join("\n\n"),
      abortSignal: options?.abortSignal,
    });

    try {
      const metadata = await this.requestJsonObject({
        maxTokens: 1400,
        systemInstructions: [
          "You summarize QA resolution outcomes for a revised blog article.",
          "Keep the title unchanged unless a QA finding clearly requires renaming it.",
          "Keep the description concise and publication-ready.",
          "Keep the resolution summary to at most two sentences.",
        ].join("\n"),
        userContent: [
          `Original title: ${article.title}`,
          `Original description: ${article.description}`,
          `Revised content:\n${resolvedContent}`,
          `QA report: ${JSON.stringify(report)}`,
          "Return { title, description, resolutionSummary }.",
        ].join("\n\n"),
        expectedShape: "{ title, description, resolutionSummary }",
        abortSignal: options?.abortSignal,
      });

      return {
        title: requireString(metadata.title, "resolved title"),
        description: requireString(metadata.description, "resolved description"),
        content: resolvedContent,
        resolutionSummary: requireString(metadata.resolutionSummary, "resolution summary"),
      };
    } catch {
      return {
        title: article.title,
        description: article.description,
        content: resolvedContent,
        resolutionSummary: "Resolved the editorial QA findings in the article draft.",
      };
    }
  }

  async composeArticle(
    input: ComposeBlogArticleInput,
    options?: { abortSignal?: AbortSignal },
  ): Promise<ComposedBlogArticle> {
    const payload = await this.requestJsonObject({
      maxTokens: 4200,
      systemInstructions:
        "You create professional blog drafts in structured markdown. Include headings, lists, links, quotes, tables, emphasis, or code fences where they improve readability. Never repeat the title inside the content body.",
      userContent: [
        `Brief: ${input.brief}`,
        input.audience ? `Audience: ${input.audience}` : null,
        input.objective ? `Objective: ${input.objective}` : null,
        input.tone ? `Tone: ${input.tone}` : null,
        "Return { title, description, content }.",
      ].filter(Boolean).join("\n"),
      expectedShape: "{ title, description, content }",
      abortSignal: options?.abortSignal,
    });

    return {
      title: requireString(payload.title, "title"),
      description: requireString(payload.description, "description"),
      content: requireString(payload.content, "content"),
    };
  }

  async reviewArticle(
    article: ComposedBlogArticle,
    options?: { abortSignal?: AbortSignal },
  ): Promise<BlogQaReport> {
    const payload = await this.requestJsonObject({
      maxTokens: 1800,
      systemInstructions:
        "You are an editorial QA reviewer. Review the article for clarity, structure, factual restraint, accessibility, and business usefulness. Use high severity for publication blockers only.",
      userContent: [
        `Title: ${article.title}`,
        `Description: ${article.description}`,
        `Content:\n${article.content}`,
        "Return { approved, summary, findings: [{ id, severity, issue, recommendation }] }.",
      ].join("\n\n"),
      expectedShape: "{ approved, summary, findings: [{ id, severity, issue, recommendation }] }",
      abortSignal: options?.abortSignal,
    });
    const findings = Array.isArray(payload.findings)
      ? payload.findings.map((finding, index) => {
        const record = finding as JsonObject;
        return {
          id: requireString(record.id ?? `finding_${index + 1}`, "finding id"),
          severity: requireString(record.severity, "finding severity") as "low" | "medium" | "high",
          issue: requireString(record.issue, "finding issue"),
          recommendation: requireString(record.recommendation, "finding recommendation"),
        };
      })
      : [];

    return {
      approved: Boolean(payload.approved),
      summary: requireString(payload.summary, "qa summary"),
      findings,
    };
  }

  async resolveQa(
    article: ComposedBlogArticle,
    report: BlogQaReport,
    options?: { abortSignal?: AbortSignal },
  ): Promise<ResolvedBlogArticle> {
    try {
      const payload = await this.requestJsonObject({
        maxTokens: 5200,
        systemInstructions:
          "You revise blog articles to resolve editorial QA findings while preserving the article's main intent and keeping structured markdown.",
        userContent: [
          `Title: ${article.title}`,
          `Description: ${article.description}`,
          `Content:\n${article.content}`,
          `QA report: ${JSON.stringify(report)}`,
          "Return { title, description, content, resolutionSummary }.",
        ].join("\n\n"),
        expectedShape: "{ title, description, content, resolutionSummary }",
        abortSignal: options?.abortSignal,
      });

      return {
        title: requireString(payload.title, "resolved title"),
        description: requireString(payload.description, "resolved description"),
        content: requireString(payload.content, "resolved content"),
        resolutionSummary: requireString(payload.resolutionSummary, "resolution summary"),
      };
    } catch (error) {
      if (!isJsonTruncationError(error)) {
        throw error;
      }

      return this.resolveQaWithSplitPasses(article, report, options);
    }
  }

  async designHeroImagePrompt(
    article: ComposedBlogArticle,
    options?: { abortSignal?: AbortSignal },
  ): Promise<BlogImagePromptDesign> {
    const payload = await this.requestJsonObject({
      maxTokens: 1400,
      systemInstructions:
        "You design editorial hero-image prompts for blog posts. Produce a safe descriptive prompt, accessible alt text, and recommend size and quality using only 1024x1024, 1536x1024, 1024x1536, auto and low, medium, high, auto.",
      userContent: [
        `Title: ${article.title}`,
        `Description: ${article.description}`,
        `Content:\n${article.content}`,
        "Return { prompt, altText, size, quality, summary }.",
      ].join("\n\n"),
      expectedShape: "{ prompt, altText, size, quality, summary }",
      abortSignal: options?.abortSignal,
    });

    return {
      prompt: requireString(payload.prompt, "image prompt"),
      altText: requireString(payload.altText, "image altText"),
      size: requireString(payload.size, "image size") as BlogImagePromptDesign["size"],
      quality: requireString(payload.quality, "image quality") as BlogImagePromptDesign["quality"],
      summary: requireString(payload.summary, "image summary"),
    };
  }
}
