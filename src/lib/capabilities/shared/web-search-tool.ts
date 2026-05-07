import type OpenAI from "openai";

export interface WebSearchToolDeps {
  openai: OpenAI;
}

export interface WebSearchResult {
  answer: string;
  citations: Array<{
    url: string;
    title: string;
    start_index: number;
    end_index: number;
  }>;
  sources: string[];
  model: string;
}

export interface WebSearchError {
  error: string;
  code?: number;
}

export function validateAdminWebSearchArgs(args: {
  query: string;
  allowed_domains?: string[];
  model?: string;
}): WebSearchError | null {
  if (!args.query || args.query.trim().length === 0) {
    return { error: "query is required and must be non-empty" };
  }

  if (args.query.length > 2000) {
    return { error: "query exceeds maximum length of 2000 characters" };
  }

  return null;
}

export async function adminWebSearch(
  deps: WebSearchToolDeps,
  args: {
    query: string;
    allowed_domains?: string[];
    model?: string;
  },
): Promise<WebSearchResult | WebSearchError> {
  // 1. Validate query [WEBSEARCH-090]
  const validationError = validateAdminWebSearchArgs(args);
  if (validationError) {
    return validationError;
  }

  const model = args.model || "gpt-5";

  // 2. Build tool config [WEBSEARCH-050]
  const toolConfig: Record<string, unknown> = { type: "web_search" };
  if (args.allowed_domains && args.allowed_domains.length > 0) {
    toolConfig.filters = { allowed_domains: args.allowed_domains };
  }

  // 3. Call Responses API [WEBSEARCH-020]
  try {
    const response = await deps.openai.responses.create({
      model,
      input: args.query,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [toolConfig as any],
      include: ["web_search_call.action.sources"],
    });

    // 4. Extract answer text
    const messageItem = response.output.find(
      (item: { type: string }) => item.type === "message",
    );
    if (!messageItem || !("content" in messageItem)) {
      return { error: "No answer text in response" };
    }

    const content = (
      messageItem as {
        content: Array<{
          type: string;
          text?: string;
          annotations?: unknown[];
        }>;
      }
    ).content;
    const textContent = content.find((c) => c.type === "output_text");
    if (!textContent || !textContent.text) {
      return { error: "No answer text in response" };
    }

    // 5. Extract citations [WEBSEARCH-030]
    const annotations = (textContent.annotations || []) as Array<{
      type: string;
      url?: string;
      title?: string;
      start_index?: number;
      end_index?: number;
    }>;
    const citations = annotations
      .filter((a) => a.type === "url_citation")
      .map((a) => ({
        url: a.url || "",
        title: a.title || "",
        start_index: a.start_index || 0,
        end_index: a.end_index || 0,
      }));

    // 6. Extract sources [WEBSEARCH-040]
    const sources: string[] = [];
    for (const item of response.output) {
      if (item.type === "web_search_call" && "action" in item) {
        const action = item.action as {
          sources?: Array<{ url: string }>;
        };
        if (action.sources) {
          for (const s of action.sources) {
            if (s.url && !sources.includes(s.url)) {
              sources.push(s.url);
            }
          }
        }
      }
    }

    return { answer: textContent.text, citations, sources, model };
  } catch (err: unknown) {
    // 7. Handle API errors gracefully [WEBSEARCH-070]
    if (err && typeof err === "object" && "status" in err) {
      const apiErr = err as { status: number; message?: string };
      return {
        error: apiErr.message || "OpenAI API error",
        code: apiErr.status,
      };
    }
    return {
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
